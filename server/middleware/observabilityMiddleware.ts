import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { observableLogger, performanceTracker } from '../core/utils/observability.js';

/**
 * Request logging middleware that adds comprehensive observability
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID if not present
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Set request ID in response header for tracing
  res.setHeader('X-Request-ID', requestId);
  
  // Get user ID if available
  const userId = req.user?.id || 'anonymous';
  
  // Set logging context
  observableLogger.setContext({
    requestId,
    userId,
    source: 'api'
  });
  
  // Start performance tracking for this request
  const operationId = `request-${requestId}`;
  performanceTracker.startOperation(operationId, `${req.method} ${req.path}`, {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // Log incoming request
  observableLogger.logRequest(req.method, req.originalUrl, {
    query: req.query,
    body: sanitizeRequestBody(req.body),
    headers: sanitizeHeaders(req.headers),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Record start time for response time calculation
  const startTime = Date.now();
  
  // Override the res.end method to capture response details
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding?: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log response
    observableLogger.logResponse(req.method, req.originalUrl, res.statusCode, duration, {
      contentLength: res.getHeader('content-length'),
      responseTime: duration
    });
    
    // End performance tracking
    performanceTracker.endOperation(operationId, res.statusCode < 400);
    
    // Clear logging context
    observableLogger.clearContext();
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Error logging middleware that captures detailed error information
 */
export function errorLoggingMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  // Set error context if not already set
  if (!observableLogger.getContext().requestId) {
    observableLogger.setContext({
      requestId: req.headers['x-request-id'] as string || uuidv4(),
      userId: req.user?.id || 'anonymous',
      source: 'api'
    });
  }
  
  // Log the error with full context
  observableLogger.error(`Request error: ${err.message}`, {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: sanitizeHeaders(req.headers),
      query: req.query,
      body: sanitizeRequestBody(req.body),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    },
    statusCode: res.statusCode
  });
  
  // Continue with normal error handling
  next(err);
}

/**
 * Performance monitoring middleware for API endpoints
 */
export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for non-API routes
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }
  
  const startTime = process.hrtime.bigint();
  
  // Monitor response completion
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationNs = endTime - startTime;
    const durationMs = Number(durationNs) / 1000000; // Convert nanoseconds to milliseconds
    
    // Log slow requests (>1000ms)
    if (durationMs > 1000) {
      observableLogger.warn(`Slow API request detected`, {
        method: req.method,
        url: req.originalUrl,
        duration: durationMs,
        statusCode: res.statusCode,
        route: req.route?.path || 'unknown'
      });
    }
    
    // Log failed requests (4xx, 5xx)
    if (res.statusCode >= 400) {
      const level = res.statusCode >= 500 ? 'error' : 'warn';
      observableLogger[level](`API request failed`, {
        method: req.method,
        url: req.originalUrl,
        duration: durationMs,
        statusCode: res.statusCode,
        route: req.route?.path || 'unknown'
      });
    }
  });
  
  next();
}

/**
 * Security logging middleware for authentication and authorization events
 */
export function securityLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Log authentication attempts
  if (req.path === '/api/auth/login') {
    observableLogger.info('Authentication attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      username: req.body?.username
    });
  }
  
  // Log successful authentication
  if (req.user) {
    observableLogger.debug('Authenticated request', {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      method: req.method,
      url: req.originalUrl
    });
  }
  
  // Monitor for potential security issues
  const originalJson = res.json;
  res.json = function(body: any) {
    // Log authentication failures
    if (req.path === '/api/auth/login' && res.statusCode === 401) {
      observableLogger.warn('Authentication failed', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        username: req.body?.username,
        statusCode: res.statusCode
      });
    }
    
    // Log authorization failures
    if (res.statusCode === 403) {
      observableLogger.warn('Authorization denied', {
        userId: req.user?.id || 'anonymous',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        statusCode: res.statusCode
      });
    }
    
    return originalJson.call(this, body);
  };
  
  next();
}

/**
 * Sanitize sensitive information from request body
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

/**
 * Sanitize sensitive information from headers
 */
function sanitizeHeaders(headers: any): any {
  if (!headers) return headers;
  
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '***REDACTED***';
    }
  }
  
  return sanitized;
}