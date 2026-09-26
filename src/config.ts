import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CliOptions,
  HttpMethod,
  KeepAliveConfig,
  LogLevel,
  MultiKeepAliveConfig,
} from './types.js';

const CONFIG_CANDIDATES = [
  'keepalive.config.json',
  '.keepaliverc.json',
  '.keepaliverc',
  'keepalive.config.js',
  'keepalive.config.mjs',
  'keepalive.config.cjs',
];

export interface LoadedConfig {
  services: KeepAliveConfig[];
  defaults?: Partial<KeepAliveConfig>;
  logLevel?: LogLevel;
}

/**
 * Parses header strings in "Key: Value" or "Key=Value" format.
 */
export function parseHeaderPairs(headers: string[] | undefined): Record<string, string> {
  if (!headers || !Array.isArray(headers)) return {};

  const result: Record<string, string> = {};
  for (const item of headers) {
    const separatorIdx = item.indexOf(':') !== -1 ? item.indexOf(':') : item.indexOf('=');
    if (separatorIdx === -1) {
      throw new Error(
        `Invalid header format "${item}". Expected format "Header-Name: Value" or "Header-Name=Value".`,
      );
    }
    const key = item.substring(0, separatorIdx).trim();
    const val = item.substring(separatorIdx + 1).trim();
    if (!key) {
      throw new Error(`Header key cannot be empty in "${item}".`);
    }
    result[key] = val;
  }
  return result;
}

/**
 * Loads configuration from a file path.
 */
export async function loadConfigFile(customPath?: string): Promise<LoadedConfig | null> {
  let targetPath: string | null = null;

  if (customPath) {
    const resolved = resolve(process.cwd(), customPath);
    if (!existsSync(resolved)) {
      throw new Error(`Config file not found at: ${resolved}`);
    }
    targetPath = resolved;
  } else {
    for (const candidate of CONFIG_CANDIDATES) {
      const candidatePath = resolve(process.cwd(), candidate);
      if (existsSync(candidatePath)) {
        targetPath = candidatePath;
        break;
      }
    }
  }

  if (!targetPath) return null;

  try {
    if (targetPath.endsWith('.json') || targetPath.endsWith('.keepaliverc')) {
      const raw = readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return normalizeRawConfig(parsed);
    }

    if (targetPath.endsWith('.js') || targetPath.endsWith('.mjs') || targetPath.endsWith('.cjs')) {
      const moduleUrl = pathToFileURL(targetPath).href;
      const imported = await import(moduleUrl);
      const config = imported.default || imported;
      return normalizeRawConfig(config);
    }

    throw new Error(`Unsupported configuration file format: ${targetPath}`);
  } catch (err) {
    throw new Error(
      `Failed to parse configuration file "${targetPath}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Normalizes raw config object into LoadedConfig format.
 */
export function normalizeRawConfig(raw: unknown): LoadedConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Configuration must be a valid JSON or JS object.');
  }

  const obj = raw as Record<string, unknown>;

  // Multiple services format: { services: [...] }
  if (Array.isArray(obj['services'])) {
    const services = obj['services'] as KeepAliveConfig[];
    if (services.length === 0) {
      throw new Error('Config "services" array cannot be empty.');
    }
    return {
      services,
      defaults: (obj['defaults'] as Partial<KeepAliveConfig>) || undefined,
      logLevel: (obj['logLevel'] as LogLevel) || undefined,
    };
  }

  // Single service format: { url: '...' }
  if (typeof obj['url'] === 'string') {
    return {
      services: [obj as unknown as KeepAliveConfig],
      logLevel: (obj['logLevel'] as LogLevel) || undefined,
    };
  }

  throw new Error(
    'Configuration must contain either a "url" property or a "services" array of target endpoints.',
  );
}

/**
 * Reads environment variables into a partial KeepAliveConfig.
 */
export function loadEnvConfig(): Partial<KeepAliveConfig> {
  const env = process.env;
  const config: Partial<KeepAliveConfig> = {};

  if (env['KEEPALIVE_URL']) config.url = env['KEEPALIVE_URL'];
  if (env['KEEPALIVE_INTERVAL']) config.interval = env['KEEPALIVE_INTERVAL'];
  if (env['KEEPALIVE_TIMEOUT']) config.timeout = env['KEEPALIVE_TIMEOUT'];
  if (env['KEEPALIVE_METHOD']) config.method = env['KEEPALIVE_METHOD'].toUpperCase() as HttpMethod;
  if (env['KEEPALIVE_RETRIES']) config.retries = parseInt(env['KEEPALIVE_RETRIES'], 10);
  if (env['KEEPALIVE_RETRY_DELAY']) config.retryDelay = env['KEEPALIVE_RETRY_DELAY'];

  if (env['KEEPALIVE_HEADERS']) {
    try {
      config.headers = JSON.parse(env['KEEPALIVE_HEADERS']);
    } catch {
      // If not JSON, try key=value,key=value
      const pairs = env['KEEPALIVE_HEADERS'].split(',').map(s => s.trim());
      config.headers = parseHeaderPairs(pairs);
    }
  }

  if (env['KEEPALIVE_QUIET'] === 'true' || env['KEEPALIVE_QUIET'] === '1') {
    config.logLevel = 'quiet';
  } else if (env['KEEPALIVE_VERBOSE'] === 'true' || env['KEEPALIVE_VERBOSE'] === '1') {
    config.logLevel = 'verbose';
  }

  return config;
}

/**
 * Resolves complete runtime configuration from CLI flags, config file, and env variables.
 */
export async function resolveRuntimeConfig(
  cliOptions: CliOptions,
): Promise<MultiKeepAliveConfig | KeepAliveConfig> {
  const fileConfig = await loadConfigFile(cliOptions.config || process.env['KEEPALIVE_CONFIG']);
  const envConfig = loadEnvConfig();

  // Determine active log level
  let logLevel: LogLevel = 'normal';
  if (cliOptions.quiet) {
    logLevel = 'quiet';
  } else if (cliOptions.verbose) {
    logLevel = 'verbose';
  } else if (fileConfig?.logLevel) {
    logLevel = fileConfig.logLevel;
  } else if (envConfig.logLevel) {
    logLevel = envConfig.logLevel;
  }

  // Parse CLI headers
  const cliHeaders = parseHeaderPairs(cliOptions.headers);

  // If a multi-service config file was found and no single CLI --url was specified
  if (fileConfig && fileConfig.services.length > 1 && !cliOptions.url) {
    return {
      services: fileConfig.services,
      defaults: {
        ...fileConfig.defaults,
        logLevel,
      },
      logLevel,
    };
  }

  // Single target resolution: CLI > File (first service) > Env > Default
  const primaryServiceFromFile = fileConfig?.services[0];

  const targetUrl = cliOptions.url || primaryServiceFromFile?.url || envConfig.url;

  if (!targetUrl) {
    throw new Error(
      'Missing target URL. Provide --url <url>, set KEEPALIVE_URL, or define a config file.',
    );
  }

  const interval =
    cliOptions.interval || primaryServiceFromFile?.interval || envConfig.interval || '10m';

  const timeout =
    cliOptions.timeout || primaryServiceFromFile?.timeout || envConfig.timeout || '30s';

  const method = (
    cliOptions.method ||
    primaryServiceFromFile?.method ||
    envConfig.method ||
    'GET'
  ).toUpperCase() as HttpMethod;

  const retries =
    cliOptions.retries !== undefined
      ? typeof cliOptions.retries === 'string'
        ? parseInt(cliOptions.retries, 10)
        : cliOptions.retries
      : primaryServiceFromFile?.retries !== undefined
        ? primaryServiceFromFile.retries
        : envConfig.retries !== undefined
          ? envConfig.retries
          : 3;

  const retryDelay =
    cliOptions.retryDelay || primaryServiceFromFile?.retryDelay || envConfig.retryDelay || '5s';

  const headers: Record<string, string> = {
    ...(envConfig.headers ?? {}),
    ...(fileConfig?.defaults?.headers ?? {}),
    ...(primaryServiceFromFile?.headers ?? {}),
    ...cliHeaders,
  };

  const name = primaryServiceFromFile?.name;

  return {
    url: targetUrl,
    name,
    interval,
    timeout,
    method,
    headers,
    retries,
    retryDelay,
    logLevel,
  };
}
