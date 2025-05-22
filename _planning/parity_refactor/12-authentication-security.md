# 12 - Authentication & Security

This document outlines the implementation of authentication and security features for the TaskBoardAI application. These features will ensure that data is protected, access is controlled, and operations are secure across all interfaces.

## Overview

Security is a critical aspect of any application that manages potentially sensitive data. This implementation will add proper authentication, authorization, and security features across all interfaces:

- MCP (Model Context Protocol)
- REST API 
- CLI

## Implementation Steps

### 1. Authentication System Implementation

First, we'll implement a comprehensive authentication system using JSON Web Tokens (JWT).

```typescript
// src/schemas/authSchemas.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  passwordHash: z.string(),
  role: z.enum(['admin', 'user', 'agent']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const UserCreateSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'user', 'agent']).default('user')
});

export const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1)
});

export const TokenResponseSchema = z.object({
  token: z.string(),
  expiresIn: z.number(),
  user: UserSchema.omit({ passwordHash: true })
});

export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
```

### 2. User Repository Implementation

Create a repository for managing user data.

```typescript
// src/repositories/UserRepository.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { User, UserCreate } from '../schemas/authSchemas';
import { FileSystemError, NotFoundError } from '../utils/errors';
import { ensureDirectoryExists } from '../utils/fileSystem';

export class UserRepository {
  private usersPath: string;

  constructor(basePath: string = path.join(process.cwd(), 'data')) {
    this.usersPath = path.join(basePath, 'users.json');
    this.initializeUserStore();
  }

  private async initializeUserStore(): Promise<void> {
    try {
      await ensureDirectoryExists(path.dirname(this.usersPath));
      
      // Check if the users file exists
      try {
        await fs.access(this.usersPath);
      } catch (error) {
        // Create an empty users file if it doesn't exist
        await fs.writeFile(this.usersPath, JSON.stringify([], null, 2));
      }
    } catch (error) {
      throw new FileSystemError('Failed to initialize user store', error);
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const data = await fs.readFile(this.usersPath, 'utf-8');
      return JSON.parse(data) as User[];
    } catch (error) {
      throw new FileSystemError('Failed to read users from store', error);
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.id === id) || null;
    } catch (error) {
      throw new FileSystemError('Failed to get user by ID', error);
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.username === username) || null;
    } catch (error) {
      throw new FileSystemError('Failed to get user by username', error);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      return users.find(user => user.email === email) || null;
    } catch (error) {
      throw new FileSystemError('Failed to get user by email', error);
    }
  }

  async createUser(userData: UserCreate): Promise<User> {
    try {
      const users = await this.getAllUsers();
      
      // Generate password hash
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);
      
      // Create new user
      const newUser: User = {
        id: uuidv4(),
        username: userData.username,
        email: userData.email,
        passwordHash,
        role: userData.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add user to store
      users.push(newUser);
      await fs.writeFile(this.usersPath, JSON.stringify(users, null, 2));
      
      return newUser;
    } catch (error) {
      throw new FileSystemError('Failed to create user', error);
    }
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    try {
      const users = await this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        throw new NotFoundError(`User with ID ${id} not found`);
      }
      
      // Handle password update
      if ('password' in updates) {
        const saltRounds = 10;
        updates.passwordHash = await bcrypt.hash(updates.password as string, saltRounds);
        delete updates.password;
      }
      
      // Update user
      const updatedUser = {
        ...users[userIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      users[userIndex] = updatedUser;
      await fs.writeFile(this.usersPath, JSON.stringify(users, null, 2));
      
      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new FileSystemError('Failed to update user', error);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const users = await this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        throw new NotFoundError(`User with ID ${id} not found`);
      }
      
      // Remove user
      users.splice(userIndex, 1);
      await fs.writeFile(this.usersPath, JSON.stringify(users, null, 2));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new FileSystemError('Failed to delete user', error);
    }
  }

  async verifyCredentials(username: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByUsername(username);
      
      if (!user) {
        return null;
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      return isValid ? user : null;
    } catch (error) {
      throw new FileSystemError('Failed to verify credentials', error);
    }
  }
}
```

### 3. Authentication Service

Create a service for managing authentication and token generation.

```typescript
// src/services/AuthService.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  UserCreate, 
  Login, 
  TokenResponse,
  UserSchema,
  UserCreateSchema,
  LoginSchema 
} from '../schemas/authSchemas';
import { UserRepository } from '../repositories/UserRepository';
import { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  DuplicateResourceError
} from '../utils/errors';

export class AuthService {
  private userRepository: UserRepository;
  private jwtSecret: string;
  private tokenExpiration: number; // seconds

  constructor(
    userRepository: UserRepository,
    jwtSecret: string = process.env.JWT_SECRET || 'default-secret-change-in-production',
    tokenExpiration: number = 3600 // 1 hour
  ) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.tokenExpiration = tokenExpiration;
  }

  async registerUser(userData: UserCreate): Promise<User> {
    try {
      // Validate user data
      const validatedData = UserCreateSchema.parse(userData);
      
      // Check if username already exists
      const existingUsername = await this.userRepository.getUserByUsername(validatedData.username);
      if (existingUsername) {
        throw new DuplicateResourceError('Username already exists');
      }
      
      // Check if email already exists
      const existingEmail = await this.userRepository.getUserByEmail(validatedData.email);
      if (existingEmail) {
        throw new DuplicateResourceError('Email already exists');
      }
      
      // Create user
      return await this.userRepository.createUser(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid user data', error);
      }
      throw error;
    }
  }

  async login(credentials: Login): Promise<TokenResponse> {
    try {
      // Validate login data
      const validatedData = LoginSchema.parse(credentials);
      
      // Verify credentials
      const user = await this.userRepository.verifyCredentials(
        validatedData.username, 
        validatedData.password
      );
      
      if (!user) {
        throw new AuthenticationError('Invalid username or password');
      }
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      // Create token response (excluding password hash)
      const { passwordHash, ...userWithoutPassword } = user;
      
      return {
        token,
        expiresIn: this.tokenExpiration,
        user: userWithoutPassword as Omit<User, 'passwordHash'>
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid login data', error);
      }
      throw error;
    }
  }

  async validateToken(token: string): Promise<User> {
    try {
      // Verify token
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      
      // Get user
      const user = await this.userRepository.getUserById(decoded.userId);
      
      if (!user) {
        throw new AuthenticationError('Invalid token: user not found');
      }
      
      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid or expired token');
      }
      throw error;
    }
  }

  async getCurrentUser(token: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.validateToken(token);
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  private generateToken(user: User): string {
    // Create token payload
    const payload = {
      userId: user.id,
      role: user.role,
      // Add a unique token ID to allow token revocation
      tokenId: uuidv4()
    };
    
    // Sign token
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiration
    });
  }

  async generateApiKey(userId: string): Promise<string> {
    // Get user
    const user = await this.userRepository.getUserById(userId);
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    // Generate a secure API key
    const apiKey = `tkr_${uuidv4().replace(/-/g, '')}`;
    
    // In a real implementation, you would store this API key
    // (or preferably its hash) in a database with the user ID
    
    return apiKey;
  }

  // Update the ServiceFactory to include the AuthService
  static createAuthService(): AuthService {
    const userRepository = new UserRepository();
    return new AuthService(userRepository);
  }
}
```

### 4. Role-Based Access Control

Implement role-based access control to restrict operations based on user roles.

```typescript
// src/utils/auth.ts
import { Request, Response, NextFunction } from 'express';
import { User } from '../schemas/authSchemas';
import { AuthorizationError } from './errors';

// Type for role-based permissions
type Permission = 'create' | 'read' | 'update' | 'delete' | 'admin';
type ResourceType = 'board' | 'card' | 'column' | 'user' | 'config' | 'webhook';

interface PermissionMatrix {
  [role: string]: {
    [resource: string]: Permission[];
  };
}

// Define role-based permissions
const rolePermissions: PermissionMatrix = {
  admin: {
    board: ['create', 'read', 'update', 'delete', 'admin'],
    card: ['create', 'read', 'update', 'delete', 'admin'],
    column: ['create', 'read', 'update', 'delete', 'admin'],
    user: ['create', 'read', 'update', 'delete', 'admin'],
    config: ['create', 'read', 'update', 'delete', 'admin'],
    webhook: ['create', 'read', 'update', 'delete', 'admin']
  },
  user: {
    board: ['create', 'read', 'update', 'delete'],
    card: ['create', 'read', 'update', 'delete'],
    column: ['create', 'read', 'update', 'delete'],
    user: ['read', 'update'], // Can only read and update their own user
    config: ['read'],
    webhook: ['create', 'read', 'update', 'delete']
  },
  agent: {
    board: ['create', 'read', 'update'],
    card: ['create', 'read', 'update'],
    column: ['create', 'read', 'update'],
    user: [], // No user operations
    config: ['read'],
    webhook: ['read']
  }
};

// Check if a user has permission to perform an operation on a resource
export function hasPermission(
  user: User, 
  resource: ResourceType, 
  operation: Permission
): boolean {
  // Get the user's role
  const role = user.role;
  
  // Check if the role exists in the permission matrix
  if (!rolePermissions[role]) {
    return false;
  }
  
  // Check if the resource exists in the role's permissions
  if (!rolePermissions[role][resource]) {
    return false;
  }
  
  // Check if the operation is allowed for the resource
  return rolePermissions[role][resource].includes(operation);
}

// Express middleware for checking permissions
export function requirePermission(
  resource: ResourceType, 
  operation: Permission
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get the user from the request (set by authentication middleware)
    const user = req.user as User;
    
    if (!user) {
      return next(new AuthorizationError('User not authenticated'));
    }
    
    // Check permission
    if (!hasPermission(user, resource, operation)) {
      return next(new AuthorizationError(`User does not have permission to ${operation} ${resource}`));
    }
    
    // Permission granted, continue
    next();
  };
}

// Express middleware for checking resource ownership
export function requireOwnership(getResourceOwnerIdFn: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the user from the request
      const user = req.user as User;
      
      if (!user) {
        return next(new AuthorizationError('User not authenticated'));
      }
      
      // Skip ownership check for admins
      if (user.role === 'admin') {
        return next();
      }
      
      // Get the resource owner ID
      const ownerId = await getResourceOwnerIdFn(req);
      
      // Check ownership
      if (!ownerId || ownerId !== user.id) {
        return next(new AuthorizationError('User does not own this resource'));
      }
      
      // Ownership verified, continue
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

### 5. Authentication Middleware for Express

Implement middleware for authenticating requests to the REST API.

```typescript
// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { User } from '../schemas/authSchemas';
import { AuthenticationError } from '../utils/errors';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Authentication middleware for JWT tokens
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
      
      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message
          }
        });
      } else {
        next(error);
      }
    }
  };
}

// Authentication middleware for API keys
export function authenticateApiKey(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the API key from the header
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        throw new AuthenticationError('API key required');
      }
      
      // Validate API key and get user
      // In a real implementation, you would look up the API key in a database
      // and retrieve the associated user
      
      // For example purposes, we'll use a placeholder validation
      // const user = await apiKeyRepository.getUserByApiKey(apiKey);
      
      // For now, we'll throw an error
      throw new AuthenticationError('API key validation not implemented');
      
      // In a real implementation, you would:
      // req.user = user;
      // next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message
          }
        });
      } else {
        next(error);
      }
    }
  };
}

// Combined authentication middleware that tries JWT first, then API key
export function authenticate(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check for JWT token
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await authService.validateToken(token);
        req.user = user;
        return next();
      }
      
      // Check for API key
      const apiKey = req.headers['x-api-key'] as string;
      
      if (apiKey) {
        // In a real implementation, validate the API key and get the user
        // For now, we'll throw an error
        throw new AuthenticationError('API key validation not implemented');
      }
      
      // No valid authentication found
      throw new AuthenticationError('Authentication required');
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.status(401).json({
          success: false,
          error: {
            message: error.message
          }
        });
      } else {
        next(error);
      }
    }
  };
}
```

### 6. Authentication Controllers

Implement controllers for handling authentication in the REST API.

```typescript
// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { ServiceFactory } from '../services/ServiceFactory';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const userData = req.body;
      
      const serviceFactory = new ServiceFactory();
      const authService = serviceFactory.createAuthService();
      
      const user = await authService.registerUser(userData);
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      
      return res.status(201).json({
        success: true,
        data: userResponse
      });
    } catch (error) {
      next(error);
    }
  }
  
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const credentials = req.body;
      
      const serviceFactory = new ServiceFactory();
      const authService = serviceFactory.createAuthService();
      
      const tokenResponse = await authService.login(credentials);
      
      return res.status(200).json({
        success: true,
        data: tokenResponse
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      // User is already attached to the request by the authentication middleware
      const user = req.user;
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      
      return res.status(200).json({
        success: true,
        data: userResponse
      });
    } catch (error) {
      next(error);
    }
  }
  
  async generateApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      // User is already attached to the request by the authentication middleware
      const user = req.user;
      
      const serviceFactory = new ServiceFactory();
      const authService = serviceFactory.createAuthService();
      
      const apiKey = await authService.generateApiKey(user.id);
      
      return res.status(200).json({
        success: true,
        data: {
          apiKey
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 7. Authentication Routes

Set up routes for authentication in the REST API.

```typescript
// src/routes/authRoutes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
import { ServiceFactory } from '../services/ServiceFactory';

const router = Router();
const authController = new AuthController();
const serviceFactory = new ServiceFactory();
const authService = serviceFactory.createAuthService();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', authenticate(authService), authController.getCurrentUser);
router.post('/api-key', authenticate(authService), authController.generateApiKey);

export default router;

// Update app.js to include the auth routes
app.use('/api/auth', authRoutes);
```

### 8. Securing Existing Routes

Update existing routes to require authentication and authorization.

```typescript
// src/routes/boardRoutes.ts - example of securing routes
import { Router } from 'express';
import { BoardController } from '../controllers/boardController';
import { authenticate } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/auth';
import { ServiceFactory } from '../services/ServiceFactory';

const router = Router();
const boardController = new BoardController();
const serviceFactory = new ServiceFactory();
const authService = serviceFactory.createAuthService();

// All board routes require authentication
router.use(authenticate(authService));

// Get all boards - requires 'read' permission on 'board'
router.get('/', requirePermission('board', 'read'), boardController.getAllBoards);

// Get a specific board - requires 'read' permission on 'board'
router.get('/:id', requirePermission('board', 'read'), boardController.getBoardById);

// Create a new board - requires 'create' permission on 'board'
router.post('/', requirePermission('board', 'create'), boardController.createBoard);

// Update a board - requires 'update' permission on 'board'
router.put('/:id', requirePermission('board', 'update'), boardController.updateBoard);

// Delete a board - requires 'delete' permission on 'board'
router.delete('/:id', requirePermission('board', 'delete'), boardController.deleteBoard);

// Apply similar changes to other routes...
```

### 9. MCP Authentication

Implement authentication for the MCP interface.

```typescript
// src/mcp/auth/mcpAuth.js
import { ServiceFactory } from '../../services/ServiceFactory';

// Authentication for MCP handlers
export async function authenticateMcp(token) {
  try {
    const serviceFactory = new ServiceFactory();
    const authService = serviceFactory.createAuthService();
    
    // Validate the token and get the user
    const user = await authService.validateToken(token);
    
    return {
      authenticated: true,
      user
    };
  } catch (error) {
    return {
      authenticated: false,
      error: error.message
    };
  }
}

// Check permission for MCP operations
export function checkMcpPermission(user, resource, operation) {
  // If no user, deny access
  if (!user) {
    return false;
  }
  
  // Import permission check from auth utils
  const { hasPermission } = require('../../utils/auth');
  
  return hasPermission(user, resource, operation);
}

// Update the MCP handler registration to include authentication and authorization
export function registerAuthenticatedTool(server, name, description, parameters, handler, resource, operation) {
  server.registerTool(name, description, parameters, async function(params, context) {
    try {
      // Extract token from context
      const token = context?.auth?.token;
      
      if (!token) {
        return {
          success: false,
          error: {
            message: 'Authentication required',
            type: 'AuthenticationError'
          }
        };
      }
      
      // Authenticate the request
      const authResult = await authenticateMcp(token);
      
      if (!authResult.authenticated) {
        return {
          success: false,
          error: {
            message: authResult.error,
            type: 'AuthenticationError'
          }
        };
      }
      
      // Check permission
      if (!checkMcpPermission(authResult.user, resource, operation)) {
        return {
          success: false,
          error: {
            message: `Permission denied: ${operation} ${resource}`,
            type: 'AuthorizationError'
          }
        };
      }
      
      // Add user to context and call the original handler
      const enrichedContext = {
        ...context,
        user: authResult.user
      };
      
      return await handler(params, enrichedContext);
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name
        }
      };
    }
  });
}

// Update the MCP server to use the authenticated tool registration
// src/mcp/kanbanMcpServer.js - modify the registerTools method
function registerTools() {
  // Import the authenticated tool registration
  const { registerAuthenticatedTool } = require('./auth/mcpAuth');
  
  // Register board tools with authentication and permission checks
  Object.entries(boardTools).forEach(([name, tool]) => {
    // Determine the required permission based on the tool name
    let operation = 'read';
    if (name.startsWith('create')) operation = 'create';
    if (name.startsWith('update')) operation = 'update';
    if (name.startsWith('delete')) operation = 'delete';
    
    registerAuthenticatedTool(
      this,
      name,
      tool.description,
      tool.parameters,
      tool.handler,
      'board',
      operation
    );
  });
  
  // Apply similar changes to other tool registrations...
}
```

### 10. CLI Authentication

Implement authentication for the CLI interface.

```typescript
// src/cli/auth/cliAuth.ts
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import { ServiceFactory } from '../../services/ServiceFactory';

interface AuthConfig {
  token?: string;
  tokenExpiry?: string;
}

export class CliAuth {
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.tkr-kanban', 'auth.json');
  }

  async getAuthConfig(): Promise<AuthConfig> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Try to read the config file
      try {
        const data = await fs.readFile(this.configPath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        // If file doesn't exist, return empty config
        return {};
      }
    } catch (error) {
      console.error('Failed to read auth config:', error);
      return {};
    }
  }

  async saveAuthConfig(config: AuthConfig): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Write the config file
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save auth config:', error);
    }
  }

  async login(): Promise<string | null> {
    try {
      // Prompt for credentials
      const credentials = await inquirer.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Username:',
          validate: (input) => input.trim() !== '' || 'Username is required'
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          validate: (input) => input.trim() !== '' || 'Password is required'
        }
      ]);
      
      // Authenticate with the service
      const serviceFactory = new ServiceFactory();
      const authService = serviceFactory.createAuthService();
      
      const tokenResponse = await authService.login(credentials);
      
      // Save token to config
      await this.saveAuthConfig({
        token: tokenResponse.token,
        tokenExpiry: new Date(Date.now() + tokenResponse.expiresIn * 1000).toISOString()
      });
      
      return tokenResponse.token;
    } catch (error) {
      console.error('Login failed:', error.message);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      // Clear token from config
      await this.saveAuthConfig({});
      console.log('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error.message);
    }
  }

  async getToken(): Promise<string | null> {
    // Get auth config
    const config = await this.getAuthConfig();
    
    // If no token, return null
    if (!config.token) {
      return null;
    }
    
    // Check if token is expired
    if (config.tokenExpiry && new Date(config.tokenExpiry) < new Date()) {
      console.log('Your session has expired. Please log in again.');
      return null;
    }
    
    return config.token;
  }

  async ensureAuthenticated(): Promise<string | null> {
    // Try to get token
    let token = await this.getToken();
    
    // If no token, prompt for login
    if (!token) {
      console.log('You are not logged in. Please log in:');
      token = await this.login();
    }
    
    return token;
  }
}

// CLI authentication commands
// src/cli/commands/authCommands.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { CliAuth } from '../auth/cliAuth';
import { ServiceFactory } from '../../services/ServiceFactory';

export function setupAuthCommands(program: Command): void {
  const authCommand = program
    .command('auth')
    .description('Authentication commands');
  
  authCommand
    .command('login')
    .description('Log in to the Kanban server')
    .action(async () => {
      try {
        const cliAuth = new CliAuth();
        const token = await cliAuth.login();
        
        if (token) {
          console.log(chalk.green('Logged in successfully'));
        } else {
          console.log(chalk.red('Login failed'));
        }
      } catch (error) {
        console.error(chalk.red('Login failed:'), error.message);
      }
    });
  
  authCommand
    .command('logout')
    .description('Log out from the Kanban server')
    .action(async () => {
      try {
        const cliAuth = new CliAuth();
        await cliAuth.logout();
      } catch (error) {
        console.error(chalk.red('Logout failed:'), error.message);
      }
    });
  
  authCommand
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        const cliAuth = new CliAuth();
        const token = await cliAuth.getToken();
        
        if (!token) {
          console.log(chalk.yellow('Not logged in'));
          return;
        }
        
        // Get current user
        const serviceFactory = new ServiceFactory();
        const authService = serviceFactory.createAuthService();
        
        try {
          const user = await authService.getCurrentUser(token);
          
          console.log(chalk.green('Logged in as:'));
          console.log(`Username: ${user.username}`);
          console.log(`Email: ${user.email}`);
          console.log(`Role: ${user.role}`);
        } catch (error) {
          console.log(chalk.yellow('Session expired. Please log in again.'));
        }
      } catch (error) {
        console.error(chalk.red('Failed to check status:'), error.message);
      }
    });
  
  authCommand
    .command('api-key')
    .description('Generate a new API key')
    .action(async () => {
      try {
        const cliAuth = new CliAuth();
        const token = await cliAuth.ensureAuthenticated();
        
        if (!token) {
          return;
        }
        
        // Generate API key
        const serviceFactory = new ServiceFactory();
        const authService = serviceFactory.createAuthService();
        
        try {
          const user = await authService.getCurrentUser(token);
          const apiKey = await authService.generateApiKey(user.id);
          
          console.log(chalk.green('Generated API key:'));
          console.log(apiKey);
          console.log(chalk.yellow('\nImportant: Store this key securely. It will not be shown again.'));
        } catch (error) {
          console.error(chalk.red('Failed to generate API key:'), error.message);
        }
      } catch (error) {
        console.error(chalk.red('Failed to generate API key:'), error.message);
      }
    });
  
  return authCommand;
}

// Register the auth commands
// In src/cli/index.ts
import { setupAuthCommands } from './commands/authCommands';

// In the setupCli function
export function setupCli(): Command {
  // ... existing code
  
  // Register auth commands
  setupAuthCommands(program);
  
  return program;
}
```

### 11. Securing CLI Commands

Update CLI commands to require authentication.

```typescript
// src/cli/utils/requireAuth.ts
import { CliAuth } from '../auth/cliAuth';
import chalk from 'chalk';

// Higher-order function to wrap CLI command actions with authentication
export function requireAuth(action: Function): Function {
  return async (...args) => {
    try {
      const cliAuth = new CliAuth();
      const token = await cliAuth.ensureAuthenticated();
      
      if (!token) {
        console.log(chalk.red('Authentication required. Please log in first.'));
        return;
      }
      
      // Pass the token to the action
      await action(token, ...args);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  };
}

// Example usage in a command
// src/cli/commands/boardCommands.ts - example of securing commands
export function setupBoardCommands(program: Command): void {
  // ... existing code
  
  program
    .command('boards:list')
    .description('List all boards')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(requireAuth(async (token, options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const boardService = serviceFactory.createBoardService();
        
        // Include the token in API requests
        const boards = await boardService.getAllBoards(token);
        
        // ... rest of the command
      } catch (error) {
        handleCliError(error);
      }
    }));
  
  // Apply similar changes to other commands...
}
```

### 12. CSRF Protection

Implement CSRF protection for the REST API.

```typescript
// src/middleware/csrfMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import csurf from 'csurf';
import { AuthenticationError } from '../utils/errors';

// Create CSRF middleware with cookie options
export const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
});

// Middleware to handle CSRF errors
export function handleCsrfError(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.code === 'EBADCSRFTOKEN') {
    // Handle CSRF token errors
    return res.status(403).json({
      success: false,
      error: {
        message: 'Invalid or missing CSRF token',
        type: 'CsrfError'
      }
    });
  }
  
  // Pass other errors to the next middleware
  next(err);
}

// Route to get a CSRF token
export function getCsrfToken(req: Request, res: Response) {
  return res.json({
    success: true,
    data: {
      csrfToken: req.csrfToken()
    }
  });
}

// Apply CSRF protection to routes
// src/app.ts
import { csrfProtection, handleCsrfError, getCsrfToken } from './middleware/csrfMiddleware';

// Apply CSRF protection to API routes that modify data
// Only apply to browser-based requests (not API calls with custom auth)
app.use('/api', (req, res, next) => {
  // Skip CSRF for non-browser API calls
  if (req.headers['x-api-key'] || (req.headers.authorization && req.headers.authorization.startsWith('Bearer '))) {
    return next();
  }
  
  // Apply CSRF protection for browser-based requests
  csrfProtection(req, res, next);
});

// Handle CSRF errors
app.use(handleCsrfError);

// Route to get a CSRF token
app.get('/api/csrf-token', csrfProtection, getCsrfToken);
```

### 13. Rate Limiting

Implement rate limiting to prevent abuse.

```typescript
// src/middleware/rateLimitMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from 'redis';

// Create different rate limiters for different types of routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      message: 'Too many login attempts. Please try again later.',
      type: 'RateLimitError'
    }
  }
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests. Please try again later.',
      type: 'RateLimitError'
    }
  }
});

// For production, consider using a Redis store for rate limiting
if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
  const redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
  });
  
  // Configure rate limiters to use Redis
  authRateLimiter.store = new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  });
  
  apiRateLimiter.store = new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  });
}

// Apply rate limiters to routes
// src/app.ts
import { authRateLimiter, apiRateLimiter } from './middleware/rateLimitMiddleware';

// Apply rate limiting to authentication routes
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// Apply rate limiting to API routes
app.use('/api', apiRateLimiter);
```

### 14. Secure Headers

Implement secure headers to protect against common web vulnerabilities.

```typescript
// src/middleware/securityMiddleware.ts
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Create a function to apply secure headers
export function applySecureHeaders(app) {
  // Use helmet to set various security headers
  app.use(helmet());
  
  // Set Content-Security-Policy
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Consider removing unsafe-inline
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    })
  );
  
  // Set strict transport security for HTTPS
  app.use(
    helmet.hsts({
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    })
  );
  
  // Enable XSS protection
  app.use(helmet.xssFilter());
  
  // Prevent MIME type sniffing
  app.use(helmet.noSniff());
  
  // Custom middleware to prevent clickjacking
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
}

// Apply secure headers to the application
// src/app.ts
import { applySecureHeaders } from './middleware/securityMiddleware';

// Apply secure headers
applySecureHeaders(app);
```

### 15. Data Validation

Ensure all data is properly validated to prevent security vulnerabilities.

```typescript
// This is already covered by our use of Zod schemas throughout the application
// Make sure all endpoints and services use schema validation

// Example of adding sanitization to the validation pipeline
// src/utils/sanitize.ts
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create DOMPurify instance
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Sanitize HTML content
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  });
}

// Sanitize object properties that might contain HTML
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  
  // Sanitize string properties that might contain HTML
  Object.keys(result).forEach(key => {
    if (typeof result[key] === 'string') {
      if (key === 'content' || key === 'description') {
        result[key] = sanitizeHtml(result[key]);
      }
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = sanitizeObject(result[key]);
    }
  });
  
  return result;
}

// Example use in a service
// src/services/CardService.ts - addition to createCard method
async createCard(boardId: string, columnId: string, cardData: CardCreate): Promise<Card> {
  try {
    // Validate the card data
    const validatedData = CardCreateSchema.parse(cardData);
    
    // Sanitize HTML content
    if (validatedData.content) {
      validatedData.content = sanitizeHtml(validatedData.content);
    }
    
    // Proceed with card creation...
  } catch (error) {
    // Handle validation errors...
  }
}
```

### 16. Environmental Security

Implement secure environment configuration and secrets management.

```typescript
// src/config/config.ts - secure configuration management
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment-specific .env file
const envPath = path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`);
const defaultEnvPath = path.resolve(process.cwd(), '.env');

// Try to load environment-specific file, fall back to default
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
}

// Define configuration schema
interface Config {
  port: number;
  dataPath: string;
  jwtSecret: string;
  jwtExpiration: number;
  environment: string;
  logLevel: string;
  corsOrigins: string[];
  rateLimiting: boolean;
  secureHeaders: boolean;
  csrfProtection: boolean;
}

// Create and validate configuration
const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dataPath: process.env.DATA_PATH || path.join(process.cwd(), 'data'),
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' 
    ? (() => { throw new Error('JWT_SECRET is required in production') })() 
    : 'development-jwt-secret'),
  jwtExpiration: parseInt(process.env.JWT_EXPIRATION || '3600', 10),
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
  rateLimiting: process.env.RATE_LIMITING === 'true',
  secureHeaders: process.env.SECURE_HEADERS !== 'false',
  csrfProtection: process.env.CSRF_PROTECTION !== 'false'
};

// Validate sensitive configuration in production
if (config.environment === 'production') {
  // Ensure JWT secret is strong enough
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  
  // Ensure proper CORS configuration
  if (config.corsOrigins.includes('*')) {
    console.warn('Warning: CORS is configured to allow all origins in production');
  }
}

export default config;
```

## Testing Strategy

### Unit Tests

Create comprehensive unit tests for authentication and security features:

```typescript
// src/tests/unit/services/AuthService.test.ts
import { AuthService } from '../../../services/AuthService';
import { UserRepository } from '../../../repositories/UserRepository';
import { 
  ValidationError, 
  AuthenticationError, 
  DuplicateResourceError 
} from '../../../utils/errors';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  const jwtSecret = 'test-secret';
  
  beforeEach(() => {
    mockUserRepository = {
      getUserByUsername: jest.fn(),
      getUserByEmail: jest.fn(),
      createUser: jest.fn(),
      verifyCredentials: jest.fn(),
      getUserById: jest.fn()
    } as any;
    
    authService = new AuthService(mockUserRepository, jwtSecret);
  });
  
  describe('registerUser', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'user' as const
      };
      
      const createdUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockUserRepository.getUserByUsername.mockResolvedValue(null);
      mockUserRepository.getUserByEmail.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue(createdUser);
      
      const result = await authService.registerUser(userData);
      
      expect(result).toEqual(createdUser);
      expect(mockUserRepository.getUserByUsername).toHaveBeenCalledWith('testuser');
      expect(mockUserRepository.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      }));
    });
    
    it('should throw error if username already exists', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };
      
      mockUserRepository.getUserByUsername.mockResolvedValue({
        id: 'existing-user',
        username: 'testuser',
        email: 'existing@example.com',
        passwordHash: 'hash',
        role: 'user',
        createdAt: '',
        updatedAt: ''
      });
      
      await expect(authService.registerUser(userData))
        .rejects.toThrow(DuplicateResourceError);
    });
    
    it('should throw error if email already exists', async () => {
      const userData = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'password123'
      };
      
      mockUserRepository.getUserByUsername.mockResolvedValue(null);
      mockUserRepository.getUserByEmail.mockResolvedValue({
        id: 'existing-user',
        username: 'existinguser',
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'user',
        createdAt: '',
        updatedAt: ''
      });
      
      await expect(authService.registerUser(userData))
        .rejects.toThrow(DuplicateResourceError);
    });
  });
  
  describe('login', () => {
    it('should generate a token when credentials are valid', async () => {
      const credentials = {
        username: 'testuser',
        password: 'password123'
      };
      
      const user = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      mockUserRepository.verifyCredentials.mockResolvedValue(user);
      
      const result = await authService.login(credentials);
      
      expect(result.token).toBeDefined();
      expect(result.expiresIn).toBeDefined();
      expect(result.user).toEqual(expect.objectContaining({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      }));
      expect(mockUserRepository.verifyCredentials).toHaveBeenCalledWith('testuser', 'password123');
    });
    
    it('should throw error when credentials are invalid', async () => {
      const credentials = {
        username: 'testuser',
        password: 'wrongpassword'
      };
      
      mockUserRepository.verifyCredentials.mockResolvedValue(null);
      
      await expect(authService.login(credentials))
        .rejects.toThrow(AuthenticationError);
    });
  });
  
  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const user = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Generate a valid token
      const token = jwt.sign({ userId: user.id }, jwtSecret);
      
      mockUserRepository.getUserById.mockResolvedValue(user);
      
      const result = await authService.validateToken(token);
      
      expect(result).toEqual(user);
      expect(mockUserRepository.getUserById).toHaveBeenCalledWith(user.id);
    });
    
    it('should throw error when token is invalid', async () => {
      const invalidToken = 'invalid-token';
      
      await expect(authService.validateToken(invalidToken))
        .rejects.toThrow(AuthenticationError);
    });
    
    it('should throw error when user not found', async () => {
      // Generate a valid token with a non-existent user ID
      const token = jwt.sign({ userId: 'nonexistent-user' }, jwtSecret);
      
      mockUserRepository.getUserById.mockResolvedValue(null);
      
      await expect(authService.validateToken(token))
        .rejects.toThrow(AuthenticationError);
    });
  });
});

// Additional tests for permission system
// src/tests/unit/utils/auth.test.ts
import { hasPermission, requirePermission } from '../../../utils/auth';
import { User } from '../../../schemas/authSchemas';
import { AuthorizationError } from '../../../utils/errors';

describe('Auth Utils', () => {
  describe('hasPermission', () => {
    it('should return true when user has permission', () => {
      const user: User = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'admin',
        createdAt: '',
        updatedAt: ''
      };
      
      expect(hasPermission(user, 'board', 'create')).toBe(true);
      expect(hasPermission(user, 'card', 'update')).toBe(true);
      expect(hasPermission(user, 'user', 'admin')).toBe(true);
    });
    
    it('should return false when user does not have permission', () => {
      const user: User = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'user',
        createdAt: '',
        updatedAt: ''
      };
      
      expect(hasPermission(user, 'user', 'admin')).toBe(false);
      
      const agentUser: User = {
        id: 'agent-123',
        username: 'agent',
        email: 'agent@example.com',
        passwordHash: 'hash',
        role: 'agent',
        createdAt: '',
        updatedAt: ''
      };
      
      expect(hasPermission(agentUser, 'board', 'delete')).toBe(false);
      expect(hasPermission(agentUser, 'user', 'read')).toBe(false);
    });
  });
  
  describe('requirePermission', () => {
    it('should call next when user has permission', () => {
      const user: User = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'admin',
        createdAt: '',
        updatedAt: ''
      };
      
      const req = { user } as any;
      const res = {} as any;
      const next = jest.fn();
      
      const middleware = requirePermission('board', 'create');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should call next with error when user does not have permission', () => {
      const user: User = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'user',
        createdAt: '',
        updatedAt: ''
      };
      
      const req = { user } as any;
      const res = {} as any;
      const next = jest.fn();
      
      const middleware = requirePermission('user', 'admin');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });
});
```

### Integration Tests

Create integration tests for authentication and security features:

```typescript
// src/tests/integration/routes/authRoutes.test.ts
import request from 'supertest';
import app from '../../../app';
import { UserRepository } from '../../../repositories/UserRepository';
import { ServiceFactory } from '../../../services/ServiceFactory';

describe('Auth API', () => {
  let userRepository: UserRepository;
  
  beforeAll(async () => {
    // Set up test environment
    const serviceFactory = new ServiceFactory();
    userRepository = serviceFactory.createUserRepository();
    
    // Clean up any test users
    try {
      const testUser = await userRepository.getUserByUsername('testuser');
      if (testUser) {
        await userRepository.deleteUser(testUser.id);
      }
    } catch (error) {
      console.error('Error cleaning up test users:', error);
    }
  });
  
  afterAll(async () => {
    // Clean up test users
    try {
      const testUser = await userRepository.getUserByUsername('testuser');
      if (testUser) {
        await userRepository.deleteUser(testUser.id);
      }
    } catch (error) {
      console.error('Error cleaning up test users:', error);
    }
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.passwordHash).toBeUndefined();
    });
    
    it('should return error when username already exists', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'another@example.com',
          password: 'password123',
          role: 'user'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Username already exists');
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresIn).toBeDefined();
      expect(response.body.data.user.username).toBe('testuser');
    });
    
    it('should return error with incorrect credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid username or password');
    });
  });
  
  describe('GET /api/auth/me', () => {
    let token: string;
    
    beforeAll(async () => {
      // Get auth token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });
      
      token = response.body.data.token;
    });
    
    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.passwordHash).toBeUndefined();
    });
    
    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid or expired token');
    });
    
    it('should return error without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication token required');
    });
  });
  
  // Test secured routes
  describe('Protected Routes', () => {
    let token: string;
    
    beforeAll(async () => {
      // Get auth token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });
      
      token = response.body.data.token;
    });
    
    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/boards')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should deny access to protected route without token', async () => {
      const response = await request(app)
        .get('/api/boards');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
```

### Security Tests

Create tests specifically for security features:

```typescript
// src/tests/security/securityHeaders.test.ts
import request from 'supertest';
import app from '../../app';

describe('Security Headers', () => {
  it('should set security headers correctly', async () => {
    const response = await request(app).get('/');
    
    // Check Content-Security-Policy
    expect(response.headers['content-security-policy']).toBeDefined();
    
    // Check Strict-Transport-Security
    expect(response.headers['strict-transport-security']).toBeDefined();
    
    // Check X-Content-Type-Options
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    
    // Check X-Frame-Options
    expect(response.headers['x-frame-options']).toBe('DENY');
    
    // Check X-XSS-Protection
    expect(response.headers['x-xss-protection']).toBeDefined();
  });
});

// src/tests/security/csrf.test.ts
import request from 'supertest';
import app from '../../app';

describe('CSRF Protection', () => {
  it('should provide a CSRF token', async () => {
    const response = await request(app)
      .get('/api/csrf-token');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.csrfToken).toBeDefined();
  });
  
  it('should reject requests without CSRF token', async () => {
    // First, get a valid session cookie by visiting a page
    const agent = request.agent(app);
    await agent.get('/api/csrf-token');
    
    // Try to create a resource without CSRF token
    const response = await agent
      .post('/api/boards')
      .send({
        title: 'Test Board'
      });
    
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('CSRF token');
  });
  
  it('should accept requests with valid CSRF token', async () => {
    // Get a CSRF token and session cookie
    const agent = request.agent(app);
    const csrfResponse = await agent.get('/api/csrf-token');
    const csrfToken = csrfResponse.body.data.csrfToken;
    
    // Login to get authentication
    await agent
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });
    
    // Try to create a resource with CSRF token
    const response = await agent
      .post('/api/boards')
      .set('X-CSRF-Token', csrfToken)
      .send({
        title: 'Test Board'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});

// src/tests/security/rateLimit.test.ts
import request from 'supertest';
import app from '../../app';

describe('Rate Limiting', () => {
  it('should rate limit login attempts', async () => {
    // Make multiple login attempts (one more than the limit)
    const attempts = 11;
    
    for (let i = 0; i < attempts; i++) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'wrongpassword'
        });
      
      if (i < 10) {
        expect(response.status).toBe(401); // Authentication failure
      } else {
        expect(response.status).toBe(429); // Rate limit exceeded
        expect(response.body.error.message).toContain('Too many login attempts');
      }
    }
  });
});
```

## Benefits and Impact

Implementing authentication and security features provides several benefits:

1. **Data Protection**: User data and kanban boards are protected from unauthorized access.

2. **User Identity**: Users can maintain their own identity and access their own boards.

3. **Access Control**: Different roles have different permissions, ensuring appropriate access levels.

4. **Secure Communication**: All communication between clients and the server is protected.

5. **Abuse Prevention**: Rate limiting and other security measures prevent abuse of the system.

6. **Cross-Interface Security**: Security is consistently implemented across MCP, REST API, and CLI interfaces.

## Conclusion

Authentication and security are critical components of any production-ready application. By implementing a comprehensive security system across all interfaces, we ensure that TaskBoardAI is robust and secure. The JWT-based authentication, role-based access control, and various security measures protect the application from common vulnerabilities and provide a solid foundation for future security enhancements.