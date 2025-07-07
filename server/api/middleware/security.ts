import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { IConfigService } from '@core/services';
import { logger } from '@core/utils';

const securityLogger = logger.child({ component: 'SecurityMiddleware' });

// Rate limiting middleware factory
export const createRateLimiter = (configService: IConfigService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await configService.getDefault();
      const { windowMs, maxRequests } = config.server.rateLimit;
      
      const limiter = rateLimit({
        windowMs,
        max: maxRequests,
        message: {
          success: false,
          error: 'Too many requests, please try again later',
          timestamp: new Date().toISOString()
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          securityLogger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent')
          });
          
          res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            timestamp: new Date().toISOString(),
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }
      });
      
      return limiter(req, res, next);
    } catch (error) {
      securityLogger.error('Rate limiter configuration failed', { error });
      next(error);
    }
  };
};

// CORS middleware factory
export const createCorsMiddleware = (configService: IConfigService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await configService.getDefault();
      const { enableCors, corsOrigins } = config.server;
      
      if (!enableCors) {
        return next();
      }
      
      const corsOptions = {
        origin: corsOrigins.includes('*') ? true : corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'X-Request-ID'
        ],
        credentials: false,
        maxAge: 86400 // 24 hours
      };
      
      return cors(corsOptions)(req, res, next);
    } catch (error) {
      securityLogger.error('CORS configuration failed', { error });
      next(error);
    }
  };
};

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.get('X-Request-ID') || 
                   req.get('X-Correlation-ID') || 
                   generateRequestId();
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.get('X-Request-ID');
  
  securityLogger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });
  
  // Override res.end to log completion
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - start;
    
    securityLogger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('Content-Length')
    });
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize common XSS patterns in request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// IP whitelist middleware (optional)
export const createIPWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP || '')) {
      securityLogger.warn('IP address blocked', { ip: clientIP, path: req.path });
      
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// Helper functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

function sanitizeString(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

// Health check middleware
export const healthCheck = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  }
  
  next();
};