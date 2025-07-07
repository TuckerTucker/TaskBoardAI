import { AppError, ValidationError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError } from './AppError';
import { ApiResponse } from '@core/schemas';
import { ZodError } from 'zod';

export interface FormattedError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
  field?: string;
  type: string;
}

export class ErrorFormatter {
  static formatError(error: unknown): FormattedError {
    if (error instanceof AppError) {
      return ErrorFormatter.formatAppError(error);
    }

    if (error instanceof ZodError) {
      return ErrorFormatter.formatZodError(error);
    }

    if (error instanceof SyntaxError) {
      return ErrorFormatter.formatSyntaxError(error);
    }

    if (error instanceof TypeError) {
      return ErrorFormatter.formatTypeError(error);
    }

    if (error instanceof Error) {
      return ErrorFormatter.formatGenericError(error);
    }

    return ErrorFormatter.formatUnknownError(error);
  }

  static formatAppError(error: AppError): FormattedError {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      type: 'application_error'
    };
  }

  static formatZodError(error: ZodError): FormattedError {
    const firstError = error.errors[0];
    const field = firstError.path.join('.');
    
    let message = `Validation failed`;
    if (field) {
      message += ` for field '${field}'`;
    }
    message += `: ${firstError.message}`;

    const details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: err.received
    }));

    return {
      message,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
      field,
      type: 'validation_error'
    };
  }

  static formatSyntaxError(error: SyntaxError): FormattedError {
    return {
      message: 'Invalid JSON format',
      code: 'SYNTAX_ERROR',
      statusCode: 400,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      type: 'syntax_error'
    };
  }

  static formatTypeError(error: TypeError): FormattedError {
    return {
      message: 'Invalid data type',
      code: 'TYPE_ERROR',
      statusCode: 400,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      type: 'type_error'
    };
  }

  static formatGenericError(error: Error): FormattedError {
    // Map common Node.js errors to appropriate HTTP status codes
    let statusCode = 500;
    let code = 'INTERNAL_ERROR';

    if (error.message.includes('ENOENT')) {
      statusCode = 404;
      code = 'FILE_NOT_FOUND';
    } else if (error.message.includes('EACCES')) {
      statusCode = 403;
      code = 'ACCESS_DENIED';
    } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
      statusCode = 503;
      code = 'RESOURCE_EXHAUSTED';
    }

    return {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      code,
      statusCode,
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        stack: error.stack
      } : undefined,
      type: 'system_error'
    };
  }

  static formatUnknownError(error: unknown): FormattedError {
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      details: process.env.NODE_ENV === 'development' ? error : undefined,
      type: 'unknown_error'
    };
  }

  static createApiResponse(error: unknown, requestId?: string): ApiResponse {
    const formatted = ErrorFormatter.formatError(error);
    
    const response: ApiResponse = {
      success: false,
      error: formatted.message,
      timestamp: new Date().toISOString()
    };

    // Add additional error information
    if (formatted.code) {
      (response as any).code = formatted.code;
    }

    if (formatted.field) {
      (response as any).field = formatted.field;
    }

    if (formatted.details) {
      (response as any).details = formatted.details;
    }

    if (requestId) {
      (response as any).requestId = requestId;
    }

    return response;
  }

  static getHttpStatusCode(error: unknown): number {
    const formatted = ErrorFormatter.formatError(error);
    return formatted.statusCode;
  }

  // Specialized formatters for common error scenarios
  static formatValidationErrors(errors: Array<{ field: string; message: string }>): FormattedError {
    const primaryError = errors[0];
    
    return {
      message: `Validation failed: ${primaryError.message}`,
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: errors,
      field: primaryError.field,
      type: 'validation_error'
    };
  }

  static formatNotFoundError(resource: string, id?: string): FormattedError {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;

    return {
      message,
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { resource, id },
      type: 'not_found_error'
    };
  }

  static formatConflictError(message: string, details?: any): FormattedError {
    return {
      message,
      code: 'CONFLICT',
      statusCode: 409,
      details,
      type: 'conflict_error'
    };
  }

  static formatUnauthorizedError(message: string = 'Authentication required'): FormattedError {
    return {
      message,
      code: 'UNAUTHORIZED',
      statusCode: 401,
      type: 'unauthorized_error'
    };
  }

  static formatForbiddenError(message: string = 'Access denied'): FormattedError {
    return {
      message,
      code: 'FORBIDDEN',
      statusCode: 403,
      type: 'forbidden_error'
    };
  }

  static formatRateLimitError(retryAfter?: number): FormattedError {
    return {
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: retryAfter ? { retryAfter } : undefined,
      type: 'rate_limit_error'
    };
  }

  // Utility method to check if error should be retried
  static isRetryableError(error: unknown): boolean {
    const formatted = ErrorFormatter.formatError(error);
    
    // Retry on server errors and certain client errors
    if (formatted.statusCode >= 500) {
      return true;
    }

    // Retry on specific error codes
    const retryableCodes = [
      'ECONNRESET',
      'ENOTFOUND', 
      'ECONNREFUSED',
      'ETIMEDOUT',
      'RESOURCE_EXHAUSTED'
    ];

    return retryableCodes.includes(formatted.code || '');
  }

  // Convert error to user-friendly message
  static toUserFriendlyMessage(error: unknown): string {
    const formatted = ErrorFormatter.formatError(error);

    const userFriendlyMessages: Record<string, string> = {
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'NOT_FOUND': 'The requested item could not be found.',
      'CONFLICT': 'This action conflicts with existing data.',
      'UNAUTHORIZED': 'Please log in to access this resource.',
      'FORBIDDEN': 'You do not have permission to perform this action.',
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later.',
      'FILE_NOT_FOUND': 'The requested file could not be found.',
      'ACCESS_DENIED': 'Access to this resource is denied.',
      'RESOURCE_EXHAUSTED': 'Server is temporarily overloaded. Please try again later.'
    };

    return userFriendlyMessages[formatted.code || ''] || formatted.message;
  }
}