import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { 
  User, 
  UserCreate, 
  Login, 
  TokenResponse,
  UserSchema,
  UserCreateSchema,
  LoginSchema 
} from '../schemas/authSchemas.js';
import { IUserRepository } from '../repositories/UserRepository.js';
import { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  DuplicateResourceError
} from '../errors/index.js';
import { Logger } from '../utils/logger.js';

export interface IAuthService {
  registerUser(userData: UserCreate): Promise<User>;
  login(credentials: Login): Promise<TokenResponse>;
  validateToken(token: string): Promise<User>;
  getCurrentUser(token: string): Promise<Omit<User, 'passwordHash'>>;
  generateApiKey(userId: string): Promise<string>;
  verifyApiKey(apiKey: string): Promise<User | null>;
  refreshToken(token: string): Promise<TokenResponse>;
}

export class AuthService implements IAuthService {
  private userRepository: IUserRepository;
  private jwtSecret: string;
  private tokenExpiration: number; // seconds
  private logger: Logger;

  constructor(
    userRepository: IUserRepository,
    jwtSecret: string = process.env.JWT_SECRET || 'default-secret-change-in-production',
    tokenExpiration: number = 3600 // 1 hour
  ) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.tokenExpiration = tokenExpiration;
    this.logger = new Logger('AuthService');

    // Ensure JWT secret is strong enough in production
    if (process.env.NODE_ENV === 'production' && this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
  }

  async registerUser(userData: UserCreate): Promise<User> {
    try {
      // Validate user data
      const validatedData = UserCreateSchema.parse(userData);
      
      this.logger.info('Attempting to register user', { username: validatedData.username });
      
      // Create user through repository (which handles duplicate checks)
      const user = await this.userRepository.createUser(validatedData);
      
      this.logger.info('User registered successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn('Invalid user registration data', { error: error.errors });
        throw new ValidationError('Invalid user data', error);
      }
      if (error instanceof DuplicateResourceError) {
        this.logger.warn('Duplicate user registration attempt', { 
          username: userData.username,
          email: userData.email 
        });
        throw error;
      }
      this.logger.error('Failed to register user', { error });
      throw error;
    }
  }

  async login(credentials: Login): Promise<TokenResponse> {
    try {
      // Validate login data
      const validatedData = LoginSchema.parse(credentials);
      
      this.logger.info('Attempting user login', { username: validatedData.username });
      
      // Verify credentials
      const user = await this.userRepository.verifyCredentials(
        validatedData.username, 
        validatedData.password
      );
      
      if (!user) {
        this.logger.warn('Failed login attempt', { username: validatedData.username });
        throw new AuthenticationError('Invalid username or password');
      }
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      // Create token response (excluding password hash)
      const { passwordHash, ...userWithoutPassword } = user;
      
      this.logger.info('User logged in successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      return {
        token,
        expiresIn: this.tokenExpiration,
        user: userWithoutPassword as Omit<User, 'passwordHash'>
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.warn('Invalid login data', { error: error.errors });
        throw new ValidationError('Invalid login data', error);
      }
      if (error instanceof AuthenticationError) {
        throw error;
      }
      this.logger.error('Failed to process login', { error });
      throw error;
    }
  }

  async validateToken(token: string): Promise<User> {
    try {
      // Verify token
      const decoded = jwt.verify(token, this.jwtSecret) as { 
        userId: string; 
        role: string; 
        tokenId: string 
      };
      
      // Get user
      const user = await this.userRepository.getUserById(decoded.userId);
      
      if (!user) {
        this.logger.warn('Token validation failed: user not found', { 
          userId: decoded.userId 
        });
        throw new AuthenticationError('Invalid token: user not found');
      }
      
      this.logger.debug('Token validated successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn('Invalid JWT token', { error: error.message });
        throw new AuthenticationError('Invalid or expired token');
      }
      if (error instanceof AuthenticationError) {
        throw error;
      }
      this.logger.error('Failed to validate token', { error });
      throw new AuthenticationError('Token validation failed');
    }
  }

  async getCurrentUser(token: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.validateToken(token);
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async refreshToken(token: string): Promise<TokenResponse> {
    try {
      // Validate the current token (will throw if invalid)
      const user = await this.validateToken(token);
      
      // Generate a new token
      const newToken = this.generateToken(user);
      
      // Create token response (excluding password hash)
      const { passwordHash, ...userWithoutPassword } = user;
      
      this.logger.info('Token refreshed successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      return {
        token: newToken,
        expiresIn: this.tokenExpiration,
        user: userWithoutPassword as Omit<User, 'passwordHash'>
      };
    } catch (error) {
      this.logger.error('Failed to refresh token', { error });
      throw error;
    }
  }

  private generateToken(user: User): string {
    // Create token payload
    const payload = {
      userId: user.id,
      role: user.role,
      username: user.username,
      // Add a unique token ID to allow token revocation if needed
      tokenId: uuidv4()
    };
    
    // Sign token
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiration,
      issuer: 'taskboard-ai',
      audience: 'taskboard-ai-client'
    });
  }

  async generateApiKey(userId: string): Promise<string> {
    try {
      // Get user to ensure they exist
      const user = await this.userRepository.getUserById(userId);
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      // Generate a secure API key
      const apiKey = `tkr_${uuidv4().replace(/-/g, '')}`;
      
      // In a real implementation, you would store this API key
      // (or preferably its hash) in a database with the user ID
      // For now, we'll just return the generated key
      
      this.logger.info('API key generated', { 
        userId: user.id, 
        username: user.username 
      });
      
      return apiKey;
    } catch (error) {
      this.logger.error('Failed to generate API key', { userId, error });
      throw error;
    }
  }

  async verifyApiKey(apiKey: string): Promise<User | null> {
    try {
      // In a real implementation, you would look up the API key
      // in a database and return the associated user
      
      // For now, this is a placeholder implementation
      this.logger.debug('API key verification attempted', { apiKey: apiKey.substring(0, 10) + '...' });
      
      // TODO: Implement actual API key verification
      // This would involve:
      // 1. Hash the provided API key
      // 2. Look up the hash in a database
      // 3. Return the associated user if found
      
      return null;
    } catch (error) {
      this.logger.error('Failed to verify API key', { error });
      return null;
    }
  }

  // Helper method to check if a user has permission for a specific action
  async checkPermission(
    userId: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.getUserById(userId);
      
      if (!user) {
        return false;
      }
      
      // Import and use the permission check function
      const { hasPermission } = await import('../utils/auth.js');
      return hasPermission(user, resource as any, action as any);
    } catch (error) {
      this.logger.error('Failed to check permission', { userId, resource, action, error });
      return false;
    }
  }

  // Helper method to enforce permission requirements
  async requirePermission(
    userId: string, 
    resource: string, 
    action: string
  ): Promise<void> {
    const hasPermission = await this.checkPermission(userId, resource, action);
    
    if (!hasPermission) {
      this.logger.warn('Permission denied', { userId, resource, action });
      throw new AuthorizationError(`Permission denied: ${action} ${resource}`);
    }
  }
}