import { ObservableLogger } from './observability.js';
import { ErrorTracker } from './errorTracking.js';
import { AlertManager } from './alerting.js';
import { AppError } from '../errors/AppError.js';

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private observableLogger: ObservableLogger;
  private errorTracker: ErrorTracker;
  private alertManager: AlertManager;

  private constructor() {
    this.observableLogger = ObservableLogger.getInstance();
    this.errorTracker = ErrorTracker.getInstance();
    this.alertManager = AlertManager.getInstance();
    this.setupProcessHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.handleCriticalError('Uncaught Exception', error, 'system');
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleCriticalError('Unhandled Promise Rejection', error, 'system');
    });

    // Handle SIGTERM gracefully
    process.on('SIGTERM', () => {
      this.observableLogger.info('Received SIGTERM, shutting down gracefully');
      this.shutdown();
    });

    // Handle SIGINT gracefully
    process.on('SIGINT', () => {
      this.observableLogger.info('Received SIGINT, shutting down gracefully');
      this.shutdown();
    });
  }

  private async handleCriticalError(type: string, error: Error, source: 'api' | 'mcp' | 'cli' | 'system'): Promise<void> {
    try {
      // Log the critical error
      this.observableLogger.error(`${type}: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        source,
        type: 'critical'
      });

      // Track the error
      await this.errorTracker.trackError(
        `${type}: ${error.message}`,
        error,
        { source, type: 'critical' },
        source,
        'error'
      );

      // Check for critical patterns and alert
      await this.alertManager.checkErrorPattern({
        id: `critical_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `${type}: ${error.message}`,
        error: error.message,
        stack: error.stack,
        source,
        context: { type: 'critical' }
      } as any);

    } catch (handlingError) {
      // If error handling fails, fall back to console
      console.error('Error in error handler:', handlingError);
      console.error('Original error:', error);
    }
  }

  async handleError(error: unknown, context?: {
    source?: 'api' | 'mcp' | 'cli' | 'system';
    operation?: string;
    userId?: string;
    requestId?: string;
    [key: string]: any;
  }): Promise<void> {
    const normalizedError = this.normalizeError(error);
    const source = context?.source || 'system';

    try {
      // Log the error with context
      this.observableLogger.error(normalizedError.message, {
        error: normalizedError.message,
        stack: normalizedError.stack,
        operation: context?.operation,
        userId: context?.userId,
        requestId: context?.requestId,
        source,
        context
      });

      // Track the error
      await this.errorTracker.trackError(
        normalizedError.message,
        normalizedError,
        context,
        source,
        'error'
      );

      // Check for error patterns that need alerting
      await this.alertManager.checkErrorPattern({
        id: `error_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'error',
        message: normalizedError.message,
        error: normalizedError.message,
        stack: normalizedError.stack,
        source,
        context,
        userId: context?.userId,
        requestId: context?.requestId
      } as any);

    } catch (handlingError) {
      // If error handling fails, log to console as fallback
      console.error('Failed to handle error:', handlingError);
      console.error('Original error:', normalizedError);
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    if (error instanceof AppError) {
      return new Error(`${error.code}: ${error.message}`);
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return new Error(String((error as any).message));
    }

    return new Error(`Unknown error: ${String(error)}`);
  }

  async handleWarning(message: string, context?: {
    source?: 'api' | 'mcp' | 'cli' | 'system';
    operation?: string;
    userId?: string;
    requestId?: string;
    [key: string]: any;
  }): Promise<void> {
    const source = context?.source || 'system';

    try {
      // Log the warning
      this.observableLogger.warn(message, {
        operation: context?.operation,
        userId: context?.userId,
        requestId: context?.requestId,
        source,
        context
      });

      // Track as a warning-level error
      await this.errorTracker.trackError(
        message,
        undefined,
        context,
        source,
        'warn'
      );

    } catch (handlingError) {
      console.error('Failed to handle warning:', handlingError);
      console.error('Original warning:', message);
    }
  }

  private async shutdown(): Promise<void> {
    try {
      this.observableLogger.info('Application shutting down...');
      
      // Give time for final log writes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Express error middleware
  expressErrorHandler() {
    return async (error: any, req: any, res: any, next: any) => {
      await this.handleError(error, {
        source: 'api',
        operation: `${req.method} ${req.path}`,
        userId: req.user?.id,
        requestId: req.headers['x-request-id'],
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent']
      });

      // Send appropriate response
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
            ...(process.env.NODE_ENV === 'development' && { 
              message: error.message,
              stack: error.stack 
            })
          }
        });
      }
    };
  }

  // CLI error handler
  async handleCliError(error: unknown, operation?: string): Promise<never> {
    await this.handleError(error, {
      source: 'cli',
      operation
    });

    if (error instanceof AppError) {
      console.error(`Error: ${error.message}`);
      process.exit(error.statusCode >= 400 && error.statusCode < 500 ? 1 : 2);
    } else {
      console.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(2);
    }
  }

  // MCP error handler
  async handleMcpError(error: unknown, toolName?: string, params?: any): Promise<void> {
    await this.handleError(error, {
      source: 'mcp',
      operation: toolName,
      toolName,
      params
    });
  }
}

// Create and export singleton instance
export const globalErrorHandler = GlobalErrorHandler.getInstance();