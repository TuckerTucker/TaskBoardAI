export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private level: LogLevel;
  private context: Record<string, any>;

  constructor(level: LogLevel = LogLevel.INFO, context: Record<string, any> = {}) {
    this.level = level;
    this.context = context;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level > this.level) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.context, ...context },
      error
    };

    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const levelName = levelNames[level];

    let output = `[${entry.timestamp}] ${levelName}: ${message}`;
    
    if (Object.keys(entry.context).length > 0) {
      output += ` | Context: ${JSON.stringify(entry.context)}`;
    }

    if (error) {
      output += ` | Error: ${error.message}`;
      if (level === LogLevel.DEBUG) {
        output += `\n${error.stack}`;
      }
    }

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
    }
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  child(context: Record<string, any>): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }
}

export const logger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);