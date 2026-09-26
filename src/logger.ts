import { LoggerInterface, LogLevel } from './types.js';

/**
 * ANSI Color Escape Codes
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function supportsColor(): boolean {
  if (typeof process === 'undefined') return false;
  if ('NO_COLOR' in process.env && process.env['NO_COLOR'] !== '') return false;
  if ('FORCE_COLOR' in process.env && process.env['FORCE_COLOR'] !== '0') return true;
  return Boolean(process.stdout && process.stdout.isTTY);
}

const isColorSupported = supportsColor();

function colorize(text: string, color: keyof typeof COLORS): string {
  if (!isColorSupported) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${h}:${m}:${s}`;
}

export class Logger implements LoggerInterface {
  private logLevel: LogLevel;
  private prefix?: string;

  constructor(options: { logLevel?: LogLevel; prefix?: string } = {}) {
    this.logLevel = options.logLevel ?? 'normal';
    this.prefix = options.prefix;
  }

  public setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setPrefix(prefix: string | undefined): void {
    this.prefix = prefix;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.logLevel === 'quiet') {
      return level === 'quiet';
    }
    if (this.logLevel === 'normal') {
      return level !== 'verbose';
    }
    return true; // verbose logs everything
  }

  private formatLine(content: string, timeColor: keyof typeof COLORS = 'gray'): string {
    const timeStr = colorize(`[${formatTimestamp()}]`, timeColor);
    const prefixStr = this.prefix ? colorize(`[${this.prefix}] `, 'cyan') : '';
    return `${timeStr} ${prefixStr}${content}`;
  }

  public info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('normal')) return;
    const formatted = this.formatLine(message);
    if (args.length > 0) {
      console.log(formatted, ...args);
    } else {
      console.log(formatted);
    }
  }

  public success(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('normal')) return;
    const symbol = colorize('✓', 'green');
    const formatted = this.formatLine(`${symbol} ${colorize(message, 'green')}`);
    if (args.length > 0) {
      console.log(formatted, ...args);
    } else {
      console.log(formatted);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('normal')) return;
    const symbol = colorize('⚠', 'yellow');
    const formatted = this.formatLine(`${symbol} ${colorize(message, 'yellow')}`);
    if (args.length > 0) {
      console.warn(formatted, ...args);
    } else {
      console.warn(formatted);
    }
  }

  public error(message: string, ...args: unknown[]): void {
    // Errors are logged even in quiet mode
    const symbol = colorize('✗', 'red');
    const formatted = this.formatLine(`${symbol} ${colorize(message, 'red')}`, 'red');
    if (args.length > 0) {
      console.error(formatted, ...args);
    } else {
      console.error(formatted);
    }
  }

  public retry(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('normal')) return;
    const symbol = colorize('↻', 'yellow');
    const formatted = this.formatLine(`${symbol} ${colorize(message, 'yellow')}`);
    if (args.length > 0) {
      console.log(formatted, ...args);
    } else {
      console.log(formatted);
    }
  }

  public debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('verbose')) return;
    const label = colorize('[DEBUG]', 'dim');
    const formatted = this.formatLine(`${label} ${colorize(message, 'dim')}`);
    if (args.length > 0) {
      console.debug(formatted, ...args);
    } else {
      console.debug(formatted);
    }
  }
}
