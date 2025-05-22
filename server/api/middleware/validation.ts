import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@core/errors';
import { logger } from '@core/utils';

const validationLogger = logger.child({ component: 'ValidationMiddleware' });

// Middleware to validate request body size
export const validateBodySize = (maxSize: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      const error = new ValidationError(`Request body too large. Maximum size: ${maxSize} bytes`);
      return next(error);
    }
    
    next();
  };
};

// Middleware to validate content type
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.get('content-type');
    
    if (req.method !== 'GET' && req.method !== 'DELETE' && contentType) {
      const baseType = contentType.split(';')[0];
      if (!allowedTypes.includes(baseType)) {
        const error = new ValidationError(`Unsupported content type: ${baseType}. Allowed types: ${allowedTypes.join(', ')}`);
        return next(error);
      }
    }
    
    next();
  };
};

// Middleware to validate pagination parameters
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query;
  
  if (page && (isNaN(Number(page)) || Number(page) < 1)) {
    const error = new ValidationError('Page must be a positive integer');
    return next(error);
  }
  
  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    const error = new ValidationError('Limit must be a positive integer between 1 and 100');
    return next(error);
  }
  
  next();
};

// Middleware to validate UUID parameters
export const validateUUIDParam = (paramName: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const paramValue = req.params[paramName];
    
    if (!paramValue || !uuidRegex.test(paramValue)) {
      const error = new ValidationError(`Invalid ${paramName}: must be a valid UUID`);
      return next(error);
    }
    
    next();
  };
};

// Middleware to validate search query
export const validateSearchQuery = (req: Request, res: Response, next: NextFunction) => {
  const { q } = req.query;
  
  if (q && (typeof q !== 'string' || q.trim().length === 0)) {
    const error = new ValidationError('Search query "q" must be a non-empty string');
    return next(error);
  }
  
  if (q && q.length > 255) {
    const error = new ValidationError('Search query cannot exceed 255 characters');
    return next(error);
  }
  
  next();
};

// Middleware to sanitize and validate array query parameters
export const validateArrayParam = (paramName: string, allowedValues?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const param = req.query[paramName];
    
    if (param) {
      let values: string[];
      
      if (Array.isArray(param)) {
        values = param as string[];
      } else if (typeof param === 'string') {
        values = param.split(',').map(v => v.trim()).filter(v => v.length > 0);
      } else {
        const error = new ValidationError(`Invalid ${paramName}: must be a string or array of strings`);
        return next(error);
      }
      
      if (allowedValues) {
        const invalidValues = values.filter(v => !allowedValues.includes(v));
        if (invalidValues.length > 0) {
          const error = new ValidationError(
            `Invalid ${paramName} values: ${invalidValues.join(', ')}. Allowed values: ${allowedValues.join(', ')}`
          );
          return next(error);
        }
      }
      
      // Replace query parameter with sanitized array
      req.query[paramName] = values;
    }
    
    next();
  };
};

// Middleware to validate date parameters
export const validateDateParam = (paramName: string, required: boolean = false) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const param = req.query[paramName];
    
    if (required && !param) {
      const error = new ValidationError(`${paramName} is required`);
      return next(error);
    }
    
    if (param) {
      const date = new Date(param as string);
      if (isNaN(date.getTime())) {
        const error = new ValidationError(`Invalid ${paramName}: must be a valid ISO date string`);
        return next(error);
      }
      
      // Replace with ISO string for consistency
      req.query[paramName] = date.toISOString();
    }
    
    next();
  };
};

// Composite middleware for common board route validations
export const validateBoardRouteParams = [
  validateUUIDParam('boardId'),
  validatePagination
];

// Composite middleware for card route validations
export const validateCardRouteParams = [
  validateUUIDParam('boardId'),
  validateUUIDParam('cardId'),
  validatePagination
];

// Composite middleware for column route validations
export const validateColumnRouteParams = [
  validateUUIDParam('boardId'),
  validateUUIDParam('columnId')
];

// Middleware to log validation events
export const logValidation = (req: Request, res: Response, next: NextFunction) => {
  validationLogger.debug('Request validation', {
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  
  next();
};