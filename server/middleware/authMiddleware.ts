import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../core/services/AuthService.js';
import { User } from '../core/schemas/authSchemas.js';
import { AuthenticationError } from '../core/errors/index.js';
import { Logger } from '../core/utils/logger.js';

const logger = new Logger('AuthMiddleware');

/**
 * Authentication middleware for JWT tokens
 */
export function authenticateJwt(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the token from the Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Authentication token required');
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Validate token and get user
      const user = await authService.validateToken(token);
      
      // Attach user to request
      req.user = user;
      
      logger.debug('User authenticated via JWT', { 
        userId: user.id, 
        username: user.username 
      });
      
      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn('JWT authentication failed', { error: error.message });
        res.status(401).json({
          success: false,
          error: {
            message: error.message,
            type: 'AuthenticationError'
          }
        });
      } else {
        logger.error('Unexpected error in JWT authentication', { error });
        next(error);
      }
    }
  };
}

/**
 * Authentication middleware for API keys
 */
export function authenticateApiKey(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the API key from the header
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        throw new AuthenticationError('API key required');
      }
      
      // Validate API key and get user
      const user = await authService.verifyApiKey(apiKey);
      
      if (!user) {
        throw new AuthenticationError('Invalid API key');
      }
      
      // Attach user to request
      req.user = user;
      
      logger.debug('User authenticated via API key', { 
        userId: user.id, 
        username: user.username,
        apiKeyPrefix: apiKey.substring(0, 10) + '...'
      });
      
      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn('API key authentication failed', { error: error.message });
        res.status(401).json({
          success: false,
          error: {
            message: error.message,
            type: 'AuthenticationError'
          }
        });
      } else {
        logger.error('Unexpected error in API key authentication', { error });
        next(error);
      }
    }
  };
}

/**
 * Combined authentication middleware that tries JWT first, then API key
 */
export function authenticate(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check for JWT token first
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const user = await authService.validateToken(token);
          req.user = user;
          logger.debug('User authenticated via JWT', { 
            userId: user.id, 
            username: user.username 
          });
          return next();
        } catch (jwtError) {
          // JWT failed, try API key
          logger.debug('JWT authentication failed, trying API key');
        }
      }
      
      // Check for API key
      const apiKey = req.headers['x-api-key'] as string;
      
      if (apiKey) {
        try {
          const user = await authService.verifyApiKey(apiKey);
          if (user) {
            req.user = user;
            logger.debug('User authenticated via API key', { 
              userId: user.id, 
              username: user.username 
            });
            return next();
          }
        } catch (apiKeyError) {
          // API key failed
          logger.debug('API key authentication failed');
        }
      }
      
      // No valid authentication found
      throw new AuthenticationError('Authentication required');
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn('Authentication failed', { error: error.message });
        res.status(401).json({
          success: false,
          error: {
            message: error.message,
            type: 'AuthenticationError'
          }
        });
      } else {
        logger.error('Unexpected error in authentication', { error });
        next(error);
      }
    }
  };
}

/**
 * Optional authentication middleware - doesn't fail if no auth is provided
 * Useful for endpoints that work with or without authentication
 */
export function optionalAuthenticate(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check for JWT token
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const user = await authService.validateToken(token);
          req.user = user;
          logger.debug('User optionally authenticated via JWT', { 
            userId: user.id, 
            username: user.username 
          });
        } catch (jwtError) {
          // JWT failed, but that's okay for optional auth
          logger.debug('Optional JWT authentication failed, continuing without auth');
        }
      } else {
        // Check for API key
        const apiKey = req.headers['x-api-key'] as string;
        
        if (apiKey) {
          try {
            const user = await authService.verifyApiKey(apiKey);
            if (user) {
              req.user = user;
              logger.debug('User optionally authenticated via API key', { 
                userId: user.id, 
                username: user.username 
              });
            }
          } catch (apiKeyError) {
            // API key failed, but that's okay for optional auth
            logger.debug('Optional API key authentication failed, continuing without auth');
          }
        }
      }
      
      // Continue regardless of authentication status
      next();
    } catch (error) {
      // Even in optional auth, we should handle unexpected errors
      logger.error('Unexpected error in optional authentication', { error });
      next(error);
    }
  };
}

/**
 * Middleware to refresh JWT tokens that are close to expiry
 */
export function refreshTokenMiddleware(authService: AuthService, refreshThreshold: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User;
      
      if (!user) {
        return next();
      }
      
      // Get the token from the Authorization header
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Decode without verification to check expiry
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.decode(token) as any;
        
        if (decoded && decoded.exp) {
          const timeUntilExpiry = decoded.exp - Math.floor(Date.now() / 1000);
          
          // If token expires within the threshold, refresh it
          if (timeUntilExpiry <= refreshThreshold) {
            try {
              const tokenResponse = await authService.refreshToken(token);
              
              // Add the new token to the response headers
              res.setHeader('X-New-Token', tokenResponse.token);
              
              logger.info('Token refreshed for user', { 
                userId: user.id, 
                username: user.username 
              });
            } catch (refreshError) {
              logger.warn('Failed to refresh token', { 
                userId: user.id,
                error: refreshError 
              });
            }
          }
        }
      }
      
      next();
    } catch (error) {
      logger.error('Error in token refresh middleware', { error });
      next();
    }
  };
}

/**
 * Middleware to log authentication events
 */
export function authLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    
    if (user) {
      logger.info('Authenticated request', {
        userId: user.id,
        username: user.username,
        role: user.role,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    
    next();
  };
}