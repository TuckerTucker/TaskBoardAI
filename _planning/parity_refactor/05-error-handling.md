# 5. Error Handling System

## Objective
Create a comprehensive error handling system that provides consistent error messages, logging, and recovery mechanisms across all interfaces.

## Implementation Tasks

### 5.1 Error Class Hierarchy

**`server/core/errors/errors.ts`:**
```typescript
/**
 * Base error class for TaskBoardAI
 */
export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: any;
  isOperational: boolean;

  constructor(message: string, options: {
    code?: string;
    statusCode?: number;
    details?: any;
    isOperational?: boolean;
  } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'INTERNAL_ERROR';
    this.statusCode = options.statusCode || 500;
    this.details = options.details;
    this.isOperational = options.isOperational !== false;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a resource isn't found
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown when a business rule is violated
 */
export class BusinessError extends AppError {
  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION', details?: any) {
    super(message, {
      code,
      statusCode: 400,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown for resource conflicts
 */
export class ConflictError extends BusinessError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', details);
    this.statusCode = 409;
  }
}

/**
 * Error thrown when an unauthorized action is attempted
 */
export class UnauthorizedError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown when a forbidden action is attempted
 */
export class ForbiddenError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown when a dependency fails
 */
export class DependencyError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'DEPENDENCY_ERROR',
      statusCode: 500,
      details,
      isOperational: true
    });
  }
}

/**
 * Error thrown when a configuration issue is detected
 */
export class ConfigurationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      statusCode: 500,
      details,
      isOperational: true
    });
  }
}
```

### 5.2 Error Handler Middleware for Express

**`server/core/errors/middleware.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from './errors';
import { logger } from '@core/utils/logger';

/**
 * Express middleware for handling errors
 */
export function errorHandler(
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  // Set local variables; only provide error in development
  const isDev = process.env.NODE_ENV === 'development';
  
  // Handle different error types
  let responseError: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  
  // Log the error
  if (err instanceof AppError) {
    // Application errors
    if (err.isOperational) {
      logger.info('Operational error handled', {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode
      });
    } else {
      logger.error('Application error', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
    }
    
    responseError = {
      code: err.code,
      message: err.message,
      details: err.details,
      ...(isDev && { stack: err.stack })
    };
    
    res.status(err.statusCode);
  } else if (err instanceof ZodError) {
    // Zod validation errors
    logger.info('Validation error', {
      issues: err.issues
    });
    
    responseError = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.format(),
      ...(isDev && { stack: err.stack })
    };
    
    res.status(400);
  } else if (err.name === 'SyntaxError' && (err as any).status === 400) {
    // JSON parsing errors
    logger.info('JSON parse error', {
      message: err.message
    });
    
    responseError = {
      code: 'INVALID_JSON',
      message: 'Invalid JSON provided',
      ...(isDev && { stack: err.stack })
    };
    
    res.status(400);
  } else {
    // Unknown/unexpected errors
    logger.error('Unhandled error', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    responseError = {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred',
      ...(isDev && { stack: err.stack })
    };
    
    res.status(500);
  }
  
  // Respond with JSON
  res.json({ error: responseError });
}

/**
 * Express middleware for handling 404 Not Found
 */
export function notFoundHandler(req: Request, res: Response) {
  logger.info('Route not found', {
    method: req.method,
    url: req.originalUrl
  });
  
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
}

/**
 * Express middleware for validating request body against a Zod schema
 */
export function validateBody(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(new ValidationError('Invalid request body'));
      }
    }
  };
}

/**
 * Express middleware for validating request query against a Zod schema
 */
export function validateQuery(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(new ValidationError('Invalid query parameters'));
      }
    }
  };
}

/**
 * Express middleware for validating request params against a Zod schema
 */
export function validateParams(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(new ValidationError('Invalid path parameters'));
      }
    }
  };
}
```

### 5.3 Error Handler for MCP

**`server/core/errors/mcp.ts`:**
```typescript
import { AppError } from './errors';
import { logger } from '@core/utils/logger';

/**
 * Format an error for MCP tool response
 */
export function formatMcpError(error: unknown): {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
} {
  let errorResponse: {
    error: boolean;
    code: string;
    message: string;
    details?: any;
  };
  
  if (error instanceof AppError) {
    // Application errors
    if (error.isOperational) {
      logger.info('Operational error in MCP tool', {
        code: error.code,
        message: error.message
      });
    } else {
      logger.error('Application error in MCP tool', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    }
    
    errorResponse = {
      error: true,
      code: error.code,
      message: error.message,
      details: error.details
    };
  } else {
    // Unknown/unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Unhandled error in MCP tool', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    errorResponse = {
      error: true,
      code: 'INTERNAL_ERROR',
      message: err.message
    };
  }
  
  // Add helpful context to error responses
  let helpfulContext = '';
  
  switch (errorResponse.code) {
    case 'NOT_FOUND':
      helpfulContext = '\n\nTip: Use get-boards to list available boards, or create a new board with create-board.';
      break;
    case 'VALIDATION_ERROR':
      helpfulContext = '\n\nTip: Check the parameters you provided and try again.';
      break;
    case 'RATE_LIMIT_EXCEEDED':
      helpfulContext = '\n\nTip: Please wait a moment before trying again.';
      break;
    default:
      if (errorResponse.code.includes('BOARD')) {
        helpfulContext = '\n\nTip: Use get-boards to list available boards, or check the board ID.';
      } else if (errorResponse.code.includes('CARD')) {
        helpfulContext = '\n\nTip: Use get-board to view cards in the board.';
      }
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(errorResponse, null, 2) + helpfulContext
    }],
    isError: true
  };
}
```

### 5.4 Error Handler for CLI

**`server/core/errors/cli.ts`:**
```typescript
import chalk from 'chalk';
import { AppError } from './errors';
import { logger } from '@core/utils/logger';

/**
 * Format an error for CLI output
 */
export function formatCliError(error: unknown): {
  code: number;
  message: string;
  formattedMessage: string;
} {
  if (error instanceof AppError) {
    // Application errors
    if (error.isOperational) {
      logger.info('Operational error in CLI', {
        code: error.code,
        message: error.message
      });
    } else {
      logger.error('Application error in CLI', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Generate helpful CLI message with color
    let formattedMessage = chalk.red(`Error: ${error.message}`);
    
    // Add details if available
    if (error.details) {
      formattedMessage += '\n\n' + chalk.yellow('Details:');
      if (typeof error.details === 'string') {
        formattedMessage += '\n' + error.details;
      } else {
        formattedMessage += '\n' + JSON.stringify(error.details, null, 2);
      }
    }
    
    // Add helpful tips based on error type
    switch (error.code) {
      case 'NOT_FOUND':
        formattedMessage += '\n\n' + chalk.blue('Tip: Use "taskboard --list" to see available boards.');
        break;
      case 'VALIDATION_ERROR':
        formattedMessage += '\n\n' + chalk.blue('Tip: Check your command arguments and try again.');
        break;
      case 'CONFIGURATION_ERROR':
        formattedMessage += '\n\n' + chalk.blue('Tip: Your configuration may be invalid. Try resetting with "taskboard --reset-config".');
        break;
    }
    
    return {
      code: error.statusCode || 1,
      message: error.message,
      formattedMessage
    };
  } else {
    // Unknown/unexpected errors
    const err = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Unhandled error in CLI', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    
    const formattedMessage = chalk.red(`Unexpected error: ${err.message}`);
    
    return {
      code: 1,
      message: err.message,
      formattedMessage
    };
  }
}
```

### 5.5 Logger Utility

**`server/core/utils/logger.ts`:**
```typescript
import winston from 'winston';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.data ? '\n' + JSON.stringify(info.data, null, 2) : ''
    }`
  ),
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
);

// Define transports
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
  }),
  new winston.transports.File({
    filename: 'logs/all.log',
    format: fileFormat,
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});

// Middleware for capturing HTTP requests
export const httpLoggerMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
};

// Audit logger for security events
export function auditLog(
  action: string, 
  userId: string | null, 
  details: Record<string, any> = {}
) {
  logger.info(`AUDIT: ${action}`, {
    data: {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}
```

### 5.6 Error Translation Utilities

**`server/core/errors/translation.ts`:**
```typescript
import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  BusinessError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  DependencyError,
  ConfigurationError
} from './errors';
import { logger } from '@core/utils/logger';

/**
 * Translate repository errors to application errors
 */
export function translateRepositoryError(error: any): AppError {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }
  
  // Handle repository-specific errors
  if (error.code === 'ENOENT') {
    return new NotFoundError(
      error.message || 'Resource not found',
      { path: error.path }
    );
  }
  
  if (error.code === 'EEXIST') {
    return new ConflictError(
      error.message || 'Resource already exists',
      { path: error.path }
    );
  }
  
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return new ForbiddenError(
      error.message || 'Permission denied',
      { path: error.path }
    );
  }
  
  // Handle specific error types
  if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
    return new ValidationError(
      error.message || 'Validation error',
      error.details || error
    );
  }
  
  if (error.name === 'NotFoundError' || error.code === 'NOT_FOUND') {
    return new NotFoundError(
      error.message || 'Resource not found',
      error.details || error
    );
  }
  
  if (error.name === 'ConflictError' || error.code === 'CONFLICT') {
    return new ConflictError(
      error.message || 'Resource conflict',
      error.details || error
    );
  }
  
  // For unknown errors, log and return a generic error
  logger.error('Unhandled repository error', {
    name: error.name,
    code: error.code,
    message: error.message,
    stack: error.stack
  });
  
  return new AppError(
    error.message || 'Internal server error', 
    { isOperational: false }
  );
}

/**
 * Translate service errors to application errors
 */
export function translateServiceError(error: any): AppError {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }
  
  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return new ValidationError(
      'Validation error',
      error.format?.() || error.errors || error
    );
  }
  
  // Handle service-specific errors
  if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
    return new ValidationError(
      error.message || 'Validation error',
      error.details || error
    );
  }
  
  if (error.name === 'NotFoundError' || error.code === 'NOT_FOUND') {
    return new NotFoundError(
      error.message || 'Resource not found',
      error.details || error
    );
  }
  
  if (error.name === 'BusinessError' || error.code === 'BUSINESS_RULE_VIOLATION') {
    return new BusinessError(
      error.message || 'Business rule violation',
      error.code,
      error.details || error
    );
  }
  
  if (error.name === 'ConflictError' || error.code === 'CONFLICT') {
    return new ConflictError(
      error.message || 'Resource conflict',
      error.details || error
    );
  }
  
  if (error.name === 'UnauthorizedError' || error.code === 'UNAUTHORIZED') {
    return new UnauthorizedError(
      error.message || 'Unauthorized',
      error.details || error
    );
  }
  
  if (error.name === 'ForbiddenError' || error.code === 'FORBIDDEN') {
    return new ForbiddenError(
      error.message || 'Forbidden',
      error.details || error
    );
  }
  
  if (error.name === 'RateLimitError' || error.code === 'RATE_LIMIT_EXCEEDED') {
    return new RateLimitError(
      error.message || 'Rate limit exceeded',
      error.details || error
    );
  }
  
  if (error.name === 'DependencyError' || error.code === 'DEPENDENCY_ERROR') {
    return new DependencyError(
      error.message || 'Dependency error',
      error.details || error
    );
  }
  
  if (error.name === 'ConfigurationError' || error.code === 'CONFIGURATION_ERROR') {
    return new ConfigurationError(
      error.message || 'Configuration error',
      error.details || error
    );
  }
  
  // For unknown errors, log and return a generic error
  logger.error('Unhandled service error', {
    name: error.name,
    code: error.code,
    message: error.message,
    stack: error.stack
  });
  
  return new AppError(
    error.message || 'Internal server error', 
    { isOperational: false }
  );
}

/**
 * Translate MCP errors to application errors
 */
export function translateMcpError(error: any): AppError {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }
  
  // Simple pass-through to service error translation for now
  return translateServiceError(error);
}

/**
 * Translate CLI errors to application errors
 */
export function translateCliError(error: any): AppError {
  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }
  
  // Simple pass-through to service error translation for now
  return translateServiceError(error);
}
```

### 5.7 Error Index File

**`server/core/errors/index.ts`:**
```typescript
// Export all error types and utilities
export * from './errors';
export * from './middleware';
export * from './mcp';
export * from './cli';
export * from './translation';
```

### 5.8 Error Testing Utilities

**`server/core/errors/testing.ts`:**
```typescript
import { AppError } from './errors';

/**
 * Error utilities for testing
 */

/**
 * Assert that a function throws a specific error type
 */
export async function expectErrorType<T extends AppError>(
  fn: () => Promise<any>, 
  errorType: new (...args: any[]) => T
): Promise<T> {
  try {
    await fn();
    throw new Error(`Expected function to throw ${errorType.name} but it did not throw`);
  } catch (error) {
    if (error instanceof errorType) {
      return error;
    }
    throw new Error(
      `Expected function to throw ${errorType.name} but it threw ${
        error instanceof Error ? error.constructor.name : typeof error
      }: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a test for handling specific error types
 */
export function createErrorTest<T extends AppError>(
  errorType: new (...args: any[]) => T,
  message: string = 'Test error',
  details?: any
): () => Promise<void> {
  return async () => {
    const error = new errorType(message, details);
    
    // Basic error properties
    expect(error).toBeInstanceOf(errorType);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe(message);
    expect(error.isOperational).toBe(true);
    
    // Stack trace
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('createErrorTest');
    
    // Details
    if (details) {
      expect(error.details).toEqual(details);
    }
    
    // Specific error properties (should be tested in subclasses)
  };
}
```

## Expected Outcome
- Comprehensive error handling system
- Consistent error responses across all interfaces
- Helpful error messages with contextual guidance
- Proper logging of errors
- Clean separation of operational and programmer errors
- Structured error hierarchies for different error types