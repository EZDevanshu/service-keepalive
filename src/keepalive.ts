import { EventEmitter } from 'node:events';
import {
  KeepAliveConfig,
  KeepAliveEvents,
  PingResult,
  ResolvedServiceConfig,
  RetryInfo,
} from './types.js';
import { parseDuration, formatDuration } from './utils/duration.js';
import { redactHeaders, redactUrl } from './utils/redact.js';
import { Logger } from './logger.js';
import { executePing } from './http-client.js';
import { calculateBackoff, sleep } from './retry.js';

export class KeepAlive extends EventEmitter {
  private config: ResolvedServiceConfig;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private inFlightAbortController: AbortController | null = null;
  private logger: Logger | null = null;

  constructor(options: KeepAliveConfig) {
    super();
    this.config = this.resolveConfig(options);
  }

  private resolveConfig(options: KeepAliveConfig): ResolvedServiceConfig {
    if (!options || typeof options !== 'object') {
      throw new TypeError('KeepAlive options must be an object.');
    }

    if (!options.url || typeof options.url !== 'string') {
      throw new TypeError('url is required and must be a string.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(options.url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Protocol must be http or https');
      }
    } catch {
      throw new Error(`Invalid URL: "${options.url}". Must be a valid http:// or https:// URL.`);
    }

    const name = options.name ?? parsedUrl.hostname;
    const intervalMs = parseDuration(options.interval ?? '10m', 'interval');
    const timeoutMs = parseDuration(options.timeout ?? '30s', 'timeout');
    const method = (options.method?.toUpperCase() ?? 'GET') as ResolvedServiceConfig['method'];
    const retries = Math.max(0, options.retries ?? 3);
    const retryDelayMs = parseDuration(options.retryDelay ?? '5s', 'retryDelay');
    const maxRetryDelayMs = parseDuration(options.maxRetryDelay ?? '60s', 'maxRetryDelay');
    const retryStrategy = options.retryStrategy ?? 'exponential';
    const retryJitter = options.retryJitter ?? true;
    const unrefTimer = options.unrefTimer ?? false;
    const logLevel = options.logLevel ?? 'normal';

    let loggerInstance: Logger | null = null;
    if (options.logger !== false) {
      if (options.logger && typeof options.logger === 'object') {
        // Custom logger provided
        loggerInstance = options.logger as Logger;
      } else {
        loggerInstance = new Logger({ logLevel, prefix: name });
      }
    }
    this.logger = loggerInstance;

    return {
      name,
      url: options.url,
      intervalMs,
      timeoutMs,
      method,
      headers: options.headers ?? {},
      body: options.body ?? null,
      retries,
      retryDelayMs,
      retryStrategy,
      retryJitter,
      maxRetryDelayMs,
      expectedStatusCodes: options.expectedStatusCodes ?? ((s: number) => s >= 200 && s < 300),
      logger: loggerInstance,
      logLevel,
      unrefTimer,
    };
  }

  /**
   * Returns whether the keep-alive scheduler is actively running.
   */
  public isRunning(): boolean {
    return this.running;
  }

  /**
   * Returns the resolved service configuration.
   */
  public getConfig(): Readonly<ResolvedServiceConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Starts the keep-alive scheduler.
   * Performs an immediate ping, then continues at the configured interval.
   */
  public start(): this {
    if (this.running) {
      this.logger?.debug(`Service [${this.config.name}] is already running.`);
      return this;
    }

    this.running = true;
    this.inFlightAbortController = new AbortController();

    this.logger?.info(
      `Starting keep-alive for ${redactUrl(this.config.url)} (interval: ${formatDuration(this.config.intervalMs)}, timeout: ${formatDuration(this.config.timeoutMs)})`,
    );

    this.emit('start', this.config.name);

    // Run first ping asynchronously, then chain subsequent schedules
    void this.runPingLoop();

    return this;
  }

  /**
   * Stops the keep-alive scheduler and aborts any active requests or wait timers.
   */
  public async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.inFlightAbortController) {
      this.inFlightAbortController.abort();
      this.inFlightAbortController = null;
    }

    this.logger?.info(`Stopped keep-alive for ${this.config.name}.`);
    this.emit('stop', this.config.name);
  }

  /**
   * Executes a single ping cycle with retries without starting the recurring scheduler.
   */
  public async pingOnce(): Promise<PingResult> {
    const abortController = new AbortController();
    return this.executePingWithRetries(abortController.signal);
  }

  /**
   * Core scheduling loop. Executes a ping cycle, then schedules the next interval.
   */
  private async runPingLoop(): Promise<void> {
    if (!this.running) return;

    try {
      this.inFlightAbortController = new AbortController();
      await this.executePingWithRetries(this.inFlightAbortController.signal);
    } catch (err) {
      if (this.running) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)), this.config.name);
      }
    } finally {
      this.inFlightAbortController = null;
    }

    if (!this.running) return;

    // Schedule next execution
    this.timer = setTimeout(() => {
      void this.runPingLoop();
    }, this.config.intervalMs);

    if (this.config.unrefTimer && this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Executes the ping request, retrying on failure up to configured retry attempts.
   */
  private async executePingWithRetries(signal?: AbortSignal): Promise<PingResult> {
    const maxAttempts = 1 + this.config.retries;
    let lastResult: PingResult | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        break;
      }

      this.logger?.info(`Pinging ${redactUrl(this.config.url)}`);
      this.emit('ping', {
        name: this.config.name,
        url: this.config.url,
        attempt,
      });

      const result = await executePing({
        serviceName: this.config.name,
        url: this.config.url,
        method: this.config.method,
        headers: this.config.headers,
        body: this.config.body,
        timeoutMs: this.config.timeoutMs,
        attempt,
        expectedStatusCodes: this.config.expectedStatusCodes,
        externalSignal: signal,
      });

      lastResult = result;

      if (result.ok) {
        this.logger?.success(`${result.status} ${result.statusText} - ${result.durationMs}ms`);
        if (this.config.logLevel === 'verbose' && result.headers) {
          this.logger?.debug(`Response headers: ${JSON.stringify(redactHeaders(result.headers))}`);
        }
        this.emit('success', result);
        return result;
      }

      // If ping failed
      const errorDetail = result.error || `HTTP ${result.status}`;
      this.logger?.error(`Request failed - ${errorDetail}`);

      // If attempts remain, calculate backoff delay and wait
      if (attempt < maxAttempts && (!signal || !signal.aborted)) {
        const delayMs = calculateBackoff({
          attempt,
          baseDelayMs: this.config.retryDelayMs,
          strategy: this.config.retryStrategy,
          maxDelayMs: this.config.maxRetryDelayMs,
          jitter: this.config.retryJitter,
        });

        const retryInfo: RetryInfo = {
          serviceName: this.config.name,
          url: this.config.url,
          attempt,
          maxRetries: this.config.retries,
          delayMs,
          error: errorDetail,
        };

        if (
          this.logger &&
          'retry' in this.logger &&
          typeof (this.logger as Logger).retry === 'function'
        ) {
          (this.logger as Logger).retry(
            `Retrying ${attempt}/${this.config.retries} in ${formatDuration(delayMs)}...`,
          );
        } else {
          this.logger?.warn(
            `Retrying ${attempt}/${this.config.retries} in ${formatDuration(delayMs)}...`,
          );
        }

        this.emit('retry', retryInfo);

        try {
          await sleep(delayMs, signal);
        } catch {
          // Aborted during sleep
          break;
        }
      }
    }

    // All retries failed
    const finalResult: PingResult = lastResult ?? {
      serviceName: this.config.name,
      url: this.config.url,
      method: this.config.method,
      status: 0,
      statusText: 'Failed',
      ok: false,
      durationMs: 0,
      attempt: maxAttempts,
      timestamp: new Date(),
      error: 'All retry attempts exhausted',
    };

    this.emit('failure', finalResult);
    return finalResult;
  }

  // Type-safe event emitter methods
  public override on<K extends keyof KeepAliveEvents>(
    event: K,
    listener: KeepAliveEvents[K],
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  public override once<K extends keyof KeepAliveEvents>(
    event: K,
    listener: KeepAliveEvents[K],
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  public override off<K extends keyof KeepAliveEvents>(
    event: K,
    listener: KeepAliveEvents[K],
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  public override emit<K extends keyof KeepAliveEvents>(
    event: K,
    ...args: Parameters<KeepAliveEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
