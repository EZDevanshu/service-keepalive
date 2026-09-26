/**
 * Supported HTTP methods for keep-alive pings.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Strategy for calculating delays between retry attempts.
 */
export type RetryStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Logging verbosity levels.
 */
export type LogLevel = 'quiet' | 'normal' | 'verbose';

/**
 * Custom logger interface.
 */
export interface LoggerInterface {
  info(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

/**
 * Result of an individual HTTP ping execution.
 */
export interface PingResult {
  /** Identifier of the service pinged */
  serviceName: string;
  /** Target URL */
  url: string;
  /** HTTP method used */
  method: HttpMethod;
  /** HTTP response status code (0 if network error / timeout) */
  status: number;
  /** HTTP response status text */
  statusText: string;
  /** Whether the ping was deemed successful */
  ok: boolean;
  /** Round-trip duration in milliseconds */
  durationMs: number;
  /** Which attempt number succeeded or failed (1-indexed) */
  attempt: number;
  /** ISO timestamp when the ping was executed */
  timestamp: Date;
  /** Error message if request failed */
  error?: string;
  /** Sanitized response headers if available and requested */
  headers?: Record<string, string>;
}

/**
 * Information passed during a retry event.
 */
export interface RetryInfo {
  serviceName: string;
  url: string;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  error: string;
}

/**
 * Configuration options for an individual KeepAlive target.
 */
export interface KeepAliveConfig {
  /** Target service URL to ping (must be a valid http or https URL) */
  url: string;
  /** Optional friendly name for the service (defaults to URL hostname) */
  name?: string;
  /** Interval between consecutive pings (e.g. '10m', '30s', '1h', or number in ms). Default: '10m' */
  interval?: string | number;
  /** Request timeout duration (e.g. '30s', '10s', or number in ms). Default: '30s' */
  timeout?: string | number;
  /** HTTP method to use. Default: 'GET' */
  method?: HttpMethod;
  /** Custom request headers */
  headers?: Record<string, string>;
  /** Optional request body payload (for POST/PUT requests) */
  body?: string | null;
  /** Number of retry attempts on failure. Default: 3 */
  retries?: number;
  /** Base delay between retries (e.g. '5s', '1000ms'). Default: '5s' */
  retryDelay?: string | number;
  /** Backoff strategy for retries. Default: 'exponential' */
  retryStrategy?: RetryStrategy;
  /** Whether to add random jitter to retry delays. Default: true */
  retryJitter?: boolean;
  /** Maximum upper bound for retry delay. Default: '60s' */
  maxRetryDelay?: string | number;
  /**
   * Status code(s) considered successful.
   * Can be an array of status codes or a predicate function.
   * Default: any 2xx status (200-299)
   */
  expectedStatusCodes?: number[] | ((status: number) => boolean);
  /** Custom logger or false to disable logging. Default: built-in console logger */
  logger?: LoggerInterface | false;
  /** Output verbosity level. Default: 'normal' */
  logLevel?: LogLevel;
  /** Whether the underlying timer should not prevent the Node process from exiting. Default: false */
  unrefTimer?: boolean;
}

/**
 * Configuration options for managing multiple services.
 */
export interface MultiKeepAliveConfig {
  /** List of service configurations to keep alive */
  services: KeepAliveConfig[];
  /** Default options applied to all services unless explicitly overridden */
  defaults?: Partial<KeepAliveConfig>;
  /** Global logger or false */
  logger?: LoggerInterface | false;
  /** Global log level */
  logLevel?: LogLevel;
}

/**
 * Resolved internal configuration with guaranteed types and parsed milliseconds.
 */
export interface ResolvedServiceConfig {
  name: string;
  url: string;
  intervalMs: number;
  timeoutMs: number;
  method: HttpMethod;
  headers: Record<string, string>;
  body: string | null;
  retries: number;
  retryDelayMs: number;
  retryStrategy: RetryStrategy;
  retryJitter: boolean;
  maxRetryDelayMs: number;
  expectedStatusCodes: number[] | ((status: number) => boolean);
  logger: LoggerInterface | null;
  logLevel: LogLevel;
  unrefTimer: boolean;
}

/**
 * CLI Options parsed from command line flags.
 */
export interface CliOptions {
  url?: string;
  interval?: string;
  timeout?: string;
  method?: string;
  retries?: string | number;
  retryDelay?: string;
  headers?: string[];
  config?: string;
  quiet?: boolean;
  verbose?: boolean;
  once?: boolean;
  help?: boolean;
  version?: boolean;
}

/**
 * Events emitted by the KeepAlive instance.
 */
export interface KeepAliveEvents {
  start: (serviceName: string) => void;
  stop: (serviceName: string) => void;
  ping: (info: { name: string; url: string; attempt: number }) => void;
  success: (result: PingResult) => void;
  failure: (result: PingResult) => void;
  retry: (info: RetryInfo) => void;
  error: (error: Error, serviceName: string) => void;
}
