import { EventEmitter } from 'node:events';
import {
  KeepAliveConfig,
  KeepAliveEvents,
  MultiKeepAliveConfig,
  PingResult,
  RetryInfo,
} from './types.js';
import { KeepAlive } from './keepalive.js';
import { Logger } from './logger.js';

export class MultiKeepAlive extends EventEmitter {
  private services: KeepAlive[] = [];
  private serviceMap: Map<string, KeepAlive> = new Map();
  private logger: Logger | null = null;

  constructor(options: MultiKeepAliveConfig) {
    super();

    if (!options || !Array.isArray(options.services) || options.services.length === 0) {
      throw new TypeError(
        'MultiKeepAlive requires a "services" array containing at least one service.',
      );
    }

    const { defaults = {}, logger, logLevel = 'normal' } = options;

    if (logger !== false) {
      if (logger && typeof logger === 'object') {
        this.logger = logger as Logger;
      } else {
        this.logger = new Logger({ logLevel, prefix: 'MultiKeepAlive' });
      }
    }

    for (const serviceConfig of options.services) {
      const mergedConfig: KeepAliveConfig = {
        ...defaults,
        ...serviceConfig,
        headers: {
          ...defaults.headers,
          ...serviceConfig.headers,
        },
        logLevel: serviceConfig.logLevel ?? defaults.logLevel ?? logLevel,
        logger: serviceConfig.logger !== undefined ? serviceConfig.logger : logger,
      };

      const instance = new KeepAlive(mergedConfig);
      const name = instance.getConfig().name;

      if (this.serviceMap.has(name)) {
        throw new Error(
          `Duplicate service name detected: "${name}". Each service must have a unique name.`,
        );
      }

      this.services.push(instance);
      this.serviceMap.set(name, instance);
      this.forwardEvents(instance);
    }
  }

  private forwardEvents(instance: KeepAlive): void {
    instance.on('start', (name: string) => this.emit('start', name));
    instance.on('stop', (name: string) => this.emit('stop', name));
    instance.on('ping', (info: { name: string; url: string; attempt: number }) =>
      this.emit('ping', info),
    );
    instance.on('success', (result: PingResult) => this.emit('success', result));
    instance.on('failure', (result: PingResult) => this.emit('failure', result));
    instance.on('retry', (info: RetryInfo) => this.emit('retry', info));
    instance.on('error', (err: Error, name: string) => this.emit('error', err, name));
  }

  /**
   * Starts all configured services.
   */
  public start(): this {
    this.logger?.info(`Starting keep-alive scheduler for ${this.services.length} services...`);
    for (const service of this.services) {
      service.start();
    }
    return this;
  }

  /**
   * Stops all running services.
   */
  public async stop(): Promise<void> {
    this.logger?.info(`Stopping all services...`);
    await Promise.all(this.services.map(s => s.stop()));
    this.logger?.info(`All services stopped successfully.`);
  }

  /**
   * Pings all services once in parallel and returns their results.
   */
  public async pingOnce(): Promise<PingResult[]> {
    return Promise.all(this.services.map(s => s.pingOnce()));
  }

  /**
   * Returns whether any of the services are currently running.
   */
  public isRunning(): boolean {
    return this.services.some(s => s.isRunning());
  }

  /**
   * Returns the list of all registered KeepAlive instances.
   */
  public getServices(): KeepAlive[] {
    return [...this.services];
  }

  /**
   * Returns a specific KeepAlive instance by service name.
   */
  public getService(name: string): KeepAlive | undefined {
    return this.serviceMap.get(name);
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
