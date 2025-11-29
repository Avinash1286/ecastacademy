/**
 * Structured Logging Infrastructure
 * 
 * Provides consistent, structured logging across the application.
 * In production, logs can be shipped to services like Datadog, Logtail, etc.
 * 
 * Features:
 * - Structured JSON logging in production
 * - Pretty-printed logs in development
 * - Request correlation via requestId
 * - Log levels: error, warn, info, debug
 * - Sensitive data redaction
 * - Performance timing
 */

// Log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Get configured log level from environment
const getConfiguredLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
};

// Check if a log level should be output
const shouldLog = (level: LogLevel): boolean => {
  const configuredLevel = getConfiguredLevel();
  return LOG_LEVELS[level] <= LOG_LEVELS[configuredLevel];
};

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'creditCard',
  'ssn',
  'pdfBase64',
  'pdfData',
];

/**
 * Redact sensitive data from objects
 */
function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Redact long base64-like strings
    if (obj.length > 500 && /^[A-Za-z0-9+/=]+$/.test(obj.slice(0, 100))) {
      return '[REDACTED_BASE64]';
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitive(value, depth + 1);
      }
    }
    return redacted;
  }
  
  return obj;
}

/**
 * Log context that can be passed through requests
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  [key: string]: unknown;
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easy to parse by log aggregators)
    return JSON.stringify(entry);
  }
  
  // Pretty format for development
  const { timestamp, level, message, context, data, error, duration } = entry;
  const levelColors: Record<LogLevel, string> = {
    error: '\x1b[31m', // Red
    warn: '\x1b[33m',  // Yellow
    info: '\x1b[36m',  // Cyan
    debug: '\x1b[90m', // Gray
  };
  const reset = '\x1b[0m';
  
  let output = `${levelColors[level]}[${level.toUpperCase()}]${reset} ${timestamp} ${message}`;
  
  if (context?.requestId) {
    output += ` ${'\x1b[90m'}(${context.requestId})${reset}`;
  }
  
  if (duration !== undefined) {
    output += ` ${'\x1b[33m'}${duration}ms${reset}`;
  }
  
  if (data) {
    output += `\n  Data: ${JSON.stringify(redactSensitive(data), null, 2)}`;
  }
  
  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    // Show stack trace in non-production environments
    if (error.stack && getConfiguredLevel() === 'debug') {
      output += `\n  ${error.stack}`;
    }
  }
  
  return output;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext, data?: unknown, error?: Error): void {
  if (!shouldLog(level)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context ? redactSensitive(context) as LogContext : undefined,
    data: data ? redactSensitive(data) : undefined,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
  };
  
  const formatted = formatLogEntry(entry);
  
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Logger class for scoped logging
 */
export class Logger {
  private context: LogContext;
  
  constructor(context: LogContext = {}) {
    this.context = context;
  }
  
  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
  
  /**
   * Log an error message
   */
  error(message: string, data?: unknown, error?: Error): void {
    log('error', message, this.context, data, error);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    log('warn', message, this.context, data);
  }
  
  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    log('info', message, this.context, data);
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    log('debug', message, this.context, data);
  }
  
  /**
   * Time an async operation
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      log('info', `${label} completed in ${duration}ms`, this.context, { duration }, undefined);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      log('error', `${label} failed after ${duration}ms`, this.context, { duration }, error as Error);
      throw error;
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  return new Logger({ requestId, userId });
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  // Use crypto for secure random generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Export convenience functions
export const logError = (message: string, data?: unknown, error?: Error) => logger.error(message, data, error);
export const logWarn = (message: string, data?: unknown) => logger.warn(message, data);
export const logInfo = (message: string, data?: unknown) => logger.info(message, data);
export const logDebug = (message: string, data?: unknown) => logger.debug(message, data);
