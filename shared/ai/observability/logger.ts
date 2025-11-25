/**
 * Structured Logger for Capsule Generation
 * 
 * Provides consistent, structured logging with context.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  generationId?: string;
  capsuleId?: string;
  stage?: string;
  attempt?: number;
  provider?: string;
  model?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context: LogContext;
}

// =============================================================================
// Logger Class
// =============================================================================

export class GenerationLogger {
  private context: LogContext;
  private minLevel: LogLevel;
  private entries: LogEntry[] = [];
  private maxEntries: number;
  
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  constructor(options: {
    context?: LogContext;
    minLevel?: LogLevel;
    maxEntries?: number;
  } = {}) {
    this.context = options.context || {};
    this.minLevel = options.minLevel || "info";
    this.maxEntries = options.maxEntries || 1000;
  }
  
  // ---------------------------------------------------------------------------
  // Context Management
  // ---------------------------------------------------------------------------
  
  withContext(additionalContext: LogContext): GenerationLogger {
    const newLogger = new GenerationLogger({
      context: { ...this.context, ...additionalContext },
      minLevel: this.minLevel,
      maxEntries: this.maxEntries,
    });
    // Share entries array
    newLogger.entries = this.entries;
    return newLogger;
  }
  
  setContext(key: string, value: unknown): void {
    this.context[key] = value;
  }
  
  // ---------------------------------------------------------------------------
  // Logging Methods
  // ---------------------------------------------------------------------------
  
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }
  
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }
  
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }
  
  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }
  
  // ---------------------------------------------------------------------------
  // Core Logging
  // ---------------------------------------------------------------------------
  
  private log(level: LogLevel, message: string, additionalContext?: LogContext): void {
    // Check minimum level
    if (GenerationLogger.LEVEL_PRIORITY[level] < GenerationLogger.LEVEL_PRIORITY[this.minLevel]) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context: { ...this.context, ...additionalContext },
    };
    
    // Store entry
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    
    // Output to console
    this.outputToConsole(entry);
  }
  
  private outputToConsole(entry: LogEntry): void {
    const prefix = this.formatPrefix(entry);
    const contextStr = this.formatContext(entry.context);
    
    switch (entry.level) {
      case "debug":
        console.debug(prefix, entry.message, contextStr);
        break;
      case "info":
        console.info(prefix, entry.message, contextStr);
        break;
      case "warn":
        console.warn(prefix, entry.message, contextStr);
        break;
      case "error":
        console.error(prefix, entry.message, contextStr);
        break;
    }
  }
  
  private formatPrefix(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const genId = entry.context.generationId 
      ? `[${entry.context.generationId.slice(0, 8)}]` 
      : "";
    const stage = entry.context.stage ? `[${entry.context.stage}]` : "";
    
    return `${time} ${level} ${genId}${stage}`;
  }
  
  private formatContext(context: LogContext): string {
    // Filter out already-displayed context keys
    const keysToExclude = ["generationId", "capsuleId", "stage"];
    const rest: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (!keysToExclude.includes(key)) {
        rest[key] = value;
      }
    }
    
    if (Object.keys(rest).length === 0) {
      return "";
    }
    
    return JSON.stringify(rest);
  }
  
  // ---------------------------------------------------------------------------
  // Entry Retrieval
  // ---------------------------------------------------------------------------
  
  getEntries(): readonly LogEntry[] {
    return this.entries;
  }
  
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(e => e.level === level);
  }
  
  getRecentEntries(count: number): LogEntry[] {
    return this.entries.slice(-count);
  }
  
  clearEntries(): void {
    this.entries = [];
  }
  
  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  
  toJSON(): LogEntry[] {
    return [...this.entries];
  }
  
  toFormattedString(): string {
    return this.entries
      .map(e => `${this.formatPrefix(e)} ${e.message}`)
      .join("\n");
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createLogger(options: {
  generationId?: string;
  capsuleId?: string;
  minLevel?: LogLevel;
}): GenerationLogger {
  return new GenerationLogger({
    context: {
      generationId: options.generationId,
      capsuleId: options.capsuleId,
    },
    minLevel: options.minLevel,
  });
}

// =============================================================================
// Singleton Default Logger
// =============================================================================

let defaultLogger: GenerationLogger | null = null;

export function getDefaultLogger(): GenerationLogger {
  if (!defaultLogger) {
    defaultLogger = new GenerationLogger({ minLevel: "info" });
  }
  return defaultLogger;
}

export function setDefaultLogLevel(level: LogLevel): void {
  defaultLogger = new GenerationLogger({ minLevel: level });
}
