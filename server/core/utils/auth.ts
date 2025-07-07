import { Request, Response, NextFunction } from 'express';
import { User } from '../schemas/authSchemas.js';
import { AuthorizationError, AuthenticationError } from '../errors/index.js';

// Type for role-based permissions
export type Permission = 'create' | 'read' | 'update' | 'delete' | 'admin';
export type ResourceType = 'board' | 'card' | 'column' | 'user' | 'config' | 'webhook' | 'template';

interface PermissionMatrix {
  [role: string]: {
    [resource: string]: Permission[];
  };
}

// Define role-based permissions matrix
const rolePermissions: PermissionMatrix = {
  admin: {
    board: ['create', 'read', 'update', 'delete', 'admin'],
    card: ['create', 'read', 'update', 'delete', 'admin'],
    column: ['create', 'read', 'update', 'delete', 'admin'],
    user: ['create', 'read', 'update', 'delete', 'admin'],
    config: ['create', 'read', 'update', 'delete', 'admin'],
    webhook: ['create', 'read', 'update', 'delete', 'admin'],
    template: ['create', 'read', 'update', 'delete', 'admin']
  },
  user: {
    board: ['create', 'read', 'update', 'delete'],
    card: ['create', 'read', 'update', 'delete'],
    column: ['create', 'read', 'update', 'delete'],
    user: ['read', 'update'], // Can only read and update their own user data
    config: ['read'],
    webhook: ['create', 'read', 'update', 'delete'],
    template: ['create', 'read', 'update', 'delete']
  },
  agent: {
    board: ['create', 'read', 'update'],
    card: ['create', 'read', 'update'],
    column: ['create', 'read', 'update'],
    user: [], // No user operations for agents
    config: ['read'],
    webhook: ['read'],
    template: ['read', 'create']
  }
};

/**
 * Check if a user has permission to perform an operation on a resource
 */
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

/**
 * Express middleware for checking permissions
 */
export function requirePermission(
  resource: ResourceType, 
  operation: Permission
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get the user from the request (set by authentication middleware)
    const user = req.user as User;
    
    if (!user) {
      return next(new AuthenticationError('User not authenticated'));
    }
    
    // Check permission
    if (!hasPermission(user, resource, operation)) {
      return next(new AuthorizationError(
        `User does not have permission to ${operation} ${resource}`
      ));
    }
    
    // Permission granted, continue
    next();
  };
}

/**
 * Express middleware for checking resource ownership
 * This is useful for ensuring users can only access their own resources
 */
export function requireOwnership(
  getResourceOwnerIdFn: (req: Request) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get the user from the request
      const user = req.user as User;
      
      if (!user) {
        return next(new AuthenticationError('User not authenticated'));
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

/**
 * Helper function to check if a user can perform a specific action on a specific resource
 * This can be used in services for programmatic permission checks
 */
export function canUserAccess(
  user: User,
  resource: ResourceType,
  operation: Permission,
  resourceOwnerId?: string
): boolean {
  // First check basic role permissions
  if (!hasPermission(user, resource, operation)) {
    return false;
  }
  
  // If this is an admin, they can access everything
  if (user.role === 'admin') {
    return true;
  }
  
  // If no specific resource owner is provided, allow based on role permissions
  if (!resourceOwnerId) {
    return true;
  }
  
  // For non-admin users, check ownership for certain resources
  if (resource === 'user' && resourceOwnerId !== user.id) {
    // Users can only access their own user data (except admins)
    return false;
  }
  
  // For other resources, allow access based on role permissions
  // In a more complex system, you might want to implement
  // resource-specific ownership checks here
  return true;
}

/**
 * Helper function to get permission matrix for a specific role
 */
export function getPermissionsForRole(role: string): Record<string, Permission[]> {
  return rolePermissions[role] || {};
}

/**
 * Helper function to get all available permissions for a resource
 */
export function getResourcePermissions(resource: ResourceType): Permission[] {
  return ['create', 'read', 'update', 'delete', 'admin'];
}

/**
 * Helper function to check if a role exists
 */
export function isValidRole(role: string): boolean {
  return Object.keys(rolePermissions).includes(role);
}

/**
 * Middleware to ensure the user is an admin
 */
export function requireAdmin() {
  return requirePermission('user', 'admin');
}

/**
 * Middleware to ensure the user is authenticated (any role)
 */
export function requireAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    
    if (!user) {
      return next(new AuthenticationError('Authentication required'));
    }
    
    next();
  };
}

/**
 * Helper to extract user ID from various request sources
 */
export function extractUserIdFromRequest(req: Request): string | null {
  // Try to get user ID from authenticated user
  const user = req.user as User;
  if (user?.id) {
    return user.id;
  }
  
  // Try to get from params
  if (req.params.userId) {
    return req.params.userId;
  }
  
  // Try to get from query
  if (req.query.userId && typeof req.query.userId === 'string') {
    return req.query.userId;
  }
  
  return null;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}