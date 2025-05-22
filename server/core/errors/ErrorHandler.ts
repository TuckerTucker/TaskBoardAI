import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { logger } from '@core/utils';
import { ApiResponse } from '@core/schemas';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  path: string;
  method: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logger = logger.child({ component: 'ErrorHandler' });

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Express error handling middleware
  handleError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const context: ErrorContext = {
      requestId: req.headers['x-request-id'] as string,
      userId: (req as any).user?.id,
      path: req.path,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    if (error instanceof AppError) {
      this.handleAppError(error, res, context);
    } else {
      this.handleGenericError(error, res, context);
    }
  };

  private handleAppError(error: AppError, res: Response, context: ErrorContext): void {
    this.logger.error('Application error', {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        details: error.details,
        stack: error.stack
      },
      context
    });

    const response: ApiResponse = {
      success: false,
      error: error.message,
      timestamp: context.timestamp
    };

    // Add error code if available
    if (error.code) {
      (response as any).code = error.code;
    }

    // Add details for validation errors in development
    if (error.details && process.env.NODE_ENV === 'development') {
      (response as any).details = error.details;
    }

    res.status(error.statusCode).json(response);
  }

  private handleGenericError(error: Error, res: Response, context: ErrorContext): void {
    this.logger.error('Unexpected error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });

    const response: ApiResponse = {
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      timestamp: context.timestamp
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      (response as any).stack = error.stack;
    }

    res.status(500).json(response);
  }

  // Handle unhandled promise rejections
  handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
    this.logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });

    // Graceful shutdown
    process.exit(1);
  };

  // Handle uncaught exceptions
  handleUncaughtException = (error: Error): void => {
    this.logger.error('Uncaught exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });

    // Graceful shutdown
    process.exit(1);
  };

  // Setup global error handlers
  setupGlobalHandlers(): void {
    process.on('unhandledRejection', this.handleUnhandledRejection);
    process.on('uncaughtException', this.handleUncaughtException);

    this.logger.info('Global error handlers configured');
  }

  // Cleanup global handlers (useful for testing)
  removeGlobalHandlers(): void {
    process.removeListener('unhandledRejection', this.handleUnhandledRejection);
    process.removeListener('uncaughtException', this.handleUncaughtException);

    this.logger.info('Global error handlers removed');
  }

  // Create middleware function for Express
  middleware() {
    return this.handleError;
  }

  // Handle async route errors
  asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  // Validate and sanitize error for client response
  sanitizeError(error: any): { message: string; code?: string; details?: any } {
    if (error instanceof AppError) {
      return {
        message: error.message,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.details : undefined
      };
    }

    // For non-AppError instances, provide generic message in production
    return {
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message || 'Unknown error'
    };
  }

  // Create structured error response
  createErrorResponse(error: any, requestId?: string): ApiResponse {
    const sanitized = this.sanitizeError(error);
    
    const response: ApiResponse = {
      success: false,
      error: sanitized.message,
      timestamp: new Date().toISOString()
    };

    if (sanitized.code) {
      (response as any).code = sanitized.code;
    }

    if (sanitized.details) {
      (response as any).details = sanitized.details;
    }

    if (requestId) {
      (response as any).requestId = requestId;
    }

    return response;
  }
}