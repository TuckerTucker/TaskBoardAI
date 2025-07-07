import { Request, Response, NextFunction } from 'express';
import { ServiceFactory } from '../cli/ServiceFactory.js';
import { Logger } from '../core/utils/logger.js';
import { 
  ValidationError, 
  AuthenticationError, 
  DuplicateResourceError 
} from '../core/errors/index.js';

const logger = new Logger('AuthController');

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userData = req.body;
      
      logger.info('User registration attempt', { username: userData.username });
      
      const serviceFactory = ServiceFactory.getInstance();
      const authService = serviceFactory.getAuthService();
      
      const user = await authService.registerUser(userData);
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      
      logger.info('User registered successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      res.status(201).json({
        success: true,
        data: userResponse,
        message: 'User registered successfully'
      });
    } catch (error) {
      logger.error('User registration failed', { error });
      
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid user data',
            details: error.details,
            type: 'ValidationError'
          }
        });
      } else if (error instanceof DuplicateResourceError) {
        res.status(409).json({
          success: false,
          error: {
            message: error.message,
            type: 'DuplicateResourceError'
          }
        });
      } else {
        next(error);
      }
    }
  }
  
  /**
   * Login user and return JWT token
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const credentials = req.body;
      
      logger.info('User login attempt', { username: credentials.username });
      
      const serviceFactory = ServiceFactory.getInstance();
      const authService = serviceFactory.getAuthService();
      
      const tokenResponse = await authService.login(credentials);
      
      logger.info('User logged in successfully', { 
        userId: tokenResponse.user.id, 
        username: tokenResponse.user.username 
      });
      
      res.status(200).json({
        success: true,
        data: tokenResponse,
        message: 'Login successful'
      });
    } catch (error) {
      logger.error('User login failed', { error });
      
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid login data',
            details: error.details,
            type: 'ValidationError'
          }
        });
      } else if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message,
            type: 'AuthenticationError'
          }
        });
      } else {
        next(error);
      }
    }
  }
  
  /**
   * Get current authenticated user
   */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // User is already attached to the request by the authentication middleware
      const user = req.user;
      
      if (!user) {
        throw new AuthenticationError('User not found in request');
      }
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      
      logger.debug('Current user retrieved', { 
        userId: user.id, 
        username: user.username 
      });
      
      res.status(200).json({
        success: true,
        data: userResponse,
        message: 'Current user retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get current user', { error });
      next(error);
    }
  }
  
  /**
   * Refresh JWT token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Bearer token required for refresh');
      }
      
      const token = authHeader.substring(7);
      
      const serviceFactory = ServiceFactory.getInstance();
      const authService = serviceFactory.getAuthService();
      
      const tokenResponse = await authService.refreshToken(token);
      
      logger.info('Token refreshed successfully', { 
        userId: tokenResponse.user.id, 
        username: tokenResponse.user.username 
      });
      
      res.status(200).json({
        success: true,
        data: tokenResponse,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      logger.error('Token refresh failed', { error });
      
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message,
            type: 'AuthenticationError'
          }
        });
      } else {
        next(error);
      }
    }
  }
  
  /**
   * Generate API key for authenticated user
   */
  static async generateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // User is already attached to the request by the authentication middleware
      const user = req.user;
      
      if (!user) {
        throw new AuthenticationError('User not found in request');
      }
      
      const serviceFactory = ServiceFactory.getInstance();
      const authService = serviceFactory.getAuthService();
      
      const apiKey = await authService.generateApiKey(user.id);
      
      logger.info('API key generated', { 
        userId: user.id, 
        username: user.username 
      });
      
      res.status(200).json({
        success: true,
        data: {
          apiKey,
          userId: user.id,
          createdAt: new Date().toISOString()
        },
        message: 'API key generated successfully'
      });
    } catch (error) {
      logger.error('API key generation failed', { error });
      next(error);
    }
  }
  
  /**
   * Logout user (client-side token invalidation)
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      
      if (user) {
        logger.info('User logged out', { 
          userId: user.id, 
          username: user.username 
        });
      }
      
      // In a stateless JWT system, logout is primarily handled client-side
      // The client should remove the token from storage
      // For a more secure implementation, you could maintain a token blacklist
      
      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout failed', { error });
      next(error);
    }
  }
  
  /**
   * Validate token endpoint (useful for client-side token validation)
   */
  static async validateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Bearer token required');
      }
      
      const token = authHeader.substring(7);
      
      const serviceFactory = ServiceFactory.getInstance();
      const authService = serviceFactory.getAuthService();
      
      const user = await authService.validateToken(token);
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      
      logger.debug('Token validated successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user: userResponse
        },
        message: 'Token is valid'
      });
    } catch (error) {
      logger.warn('Token validation failed', { error });
      
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          data: {
            valid: false
          },
          error: {
            message: error.message,
            type: 'AuthenticationError'
          }
        });
      } else {
        next(error);
      }
    }
  }
  
  /**
   * Get user permissions for the authenticated user
   */
  static async getUserPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      
      if (!user) {
        throw new AuthenticationError('User not found in request');
      }
      
      // Import permission functions
      const { getPermissionsForRole } = await import('../core/utils/auth.js');
      
      const permissions = getPermissionsForRole(user.role);
      
      logger.debug('User permissions retrieved', { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      });
      
      res.status(200).json({
        success: true,
        data: {
          userId: user.id,
          role: user.role,
          permissions
        },
        message: 'User permissions retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get user permissions', { error });
      next(error);
    }
  }
}