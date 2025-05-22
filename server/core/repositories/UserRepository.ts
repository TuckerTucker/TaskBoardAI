import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { 
  User, 
  UserCreate, 
  UserUpdate,
  UserSchema,
  UserCreateSchema,
  UserUpdateSchema
} from '../schemas/authSchemas.js';
import { ValidationError, NotFoundError, DuplicateResourceError } from '../errors/index.js';
import { Logger } from '../utils/logger.js';

export interface IUserRepository {
  getAllUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(userData: UserCreate): Promise<User>;
  updateUser(id: string, updates: UserUpdate): Promise<User>;
  deleteUser(id: string): Promise<void>;
  verifyCredentials(username: string, password: string): Promise<User | null>;
}

export class UserRepository implements IUserRepository {
  private usersPath: string;
  private logger: Logger;

  constructor(basePath: string = path.join(process.cwd(), 'data')) {
    this.usersPath = path.join(basePath, 'users.json');
    this.logger = new Logger('UserRepository');
    this.initializeUserStore();
  }

  private async initializeUserStore(): Promise<void> {
    try {
      // Ensure the data directory exists
      await fs.mkdir(path.dirname(this.usersPath), { recursive: true });
      
      // Check if the users file exists
      try {
        await fs.access(this.usersPath);
        this.logger.debug('Users store already exists');
      } catch (error) {
        // Create an empty users file if it doesn't exist
        await fs.writeFile(this.usersPath, JSON.stringify([], null, 2));
        this.logger.info('Created new users store');
      }
    } catch (error) {
      this.logger.error('Failed to initialize user store', { error });
      throw new Error('Failed to initialize user store');
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const data = await fs.readFile(this.usersPath, 'utf-8');
      const users = JSON.parse(data);
      
      // Validate each user against the schema
      return users.map((user: any) => UserSchema.parse(user));
    } catch (error) {
      this.logger.error('Failed to read users from store', { error });
      throw new Error('Failed to read users from store');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      const user = users.find(user => user.id === id);
      return user || null;
    } catch (error) {
      this.logger.error('Failed to get user by ID', { id, error });
      throw new Error('Failed to get user by ID');
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      const user = users.find(user => user.username === username);
      return user || null;
    } catch (error) {
      this.logger.error('Failed to get user by username', { username, error });
      throw new Error('Failed to get user by username');
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const users = await this.getAllUsers();
      const user = users.find(user => user.email === email);
      return user || null;
    } catch (error) {
      this.logger.error('Failed to get user by email', { email, error });
      throw new Error('Failed to get user by email');
    }
  }

  async createUser(userData: UserCreate): Promise<User> {
    try {
      // Validate user data
      const validatedData = UserCreateSchema.parse(userData);
      
      // Check if username already exists
      const existingUsername = await this.getUserByUsername(validatedData.username);
      if (existingUsername) {
        throw new DuplicateResourceError('Username already exists');
      }
      
      // Check if email already exists
      const existingEmail = await this.getUserByEmail(validatedData.email);
      if (existingEmail) {
        throw new DuplicateResourceError('Email already exists');
      }
      
      const users = await this.getAllUsers();
      
      // Generate password hash
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(validatedData.password, saltRounds);
      
      // Create new user
      const newUser: User = {
        id: uuidv4(),
        username: validatedData.username,
        email: validatedData.email,
        passwordHash,
        role: validatedData.role || 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add user to store
      users.push(newUser);
      await fs.writeFile(this.usersPath, JSON.stringify(users, null, 2));
      
      this.logger.info('User created successfully', { 
        userId: newUser.id, 
        username: newUser.username 
      });
      
      return newUser;
    } catch (error) {
      if (error instanceof DuplicateResourceError || error instanceof ValidationError) {
        throw error;
      }
      this.logger.error('Failed to create user', { error });
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: string, updates: UserUpdate): Promise<User> {
    try {
      // Validate update data
      const validatedUpdates = UserUpdateSchema.parse(updates);
      
      const users = await this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        throw new NotFoundError(`User with ID ${id} not found`);
      }
      
      const currentUser = users[userIndex];
      
      // Check for username conflicts (if updating username)
      if (validatedUpdates.username && validatedUpdates.username !== currentUser.username) {
        const existingUsername = await this.getUserByUsername(validatedUpdates.username);
        if (existingUsername) {
          throw new DuplicateResourceError('Username already exists');
        }
      }
      
      // Check for email conflicts (if updating email)
      if (validatedUpdates.email && validatedUpdates.email !== currentUser.email) {
        const existingEmail = await this.getUserByEmail(validatedUpdates.email);
        if (existingEmail) {
          throw new DuplicateResourceError('Email already exists');
        }
      }
      
      // Handle password update
      let passwordHash = currentUser.passwordHash;
      if (validatedUpdates.password) {
        const saltRounds = 12;
        passwordHash = await bcrypt.hash(validatedUpdates.password, saltRounds);
      }
      
      // Update user
      const updatedUser: User = {
        ...currentUser,
        username: validatedUpdates.username || currentUser.username,
        email: validatedUpdates.email || currentUser.email,
        role: validatedUpdates.role || currentUser.role,
        passwordHash,
        updatedAt: new Date().toISOString()
      };
      
      users[userIndex] = updatedUser;
      await fs.writeFile(this.usersPath, JSON.stringify(users, null, 2));
      
      this.logger.info('User updated successfully', { 
        userId: updatedUser.id, 
        username: updatedUser.username 
      });
      
      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof DuplicateResourceError || 
          error instanceof ValidationError) {
        throw error;
      }
      this.logger.error('Failed to update user', { id, error });
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const users = await this.getAllUsers();
      const userIndex = users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        throw new NotFoundError(`User with ID ${id} not found`);
      }
      
      const deletedUser = users[userIndex];
      
      // Remove user
      users.splice(userIndex, 1);
      await fs.writeFile(this.usersPath, JSON.stringify(users, null, 2));
      
      this.logger.info('User deleted successfully', { 
        userId: deletedUser.id, 
        username: deletedUser.username 
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to delete user', { id, error });
      throw new Error('Failed to delete user');
    }
  }

  async verifyCredentials(username: string, password: string): Promise<User | null> {
    try {
      const user = await this.getUserByUsername(username);
      
      if (!user) {
        this.logger.debug('User not found during credential verification', { username });
        return null;
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        this.logger.debug('Invalid password during credential verification', { username });
        return null;
      }
      
      this.logger.info('Credentials verified successfully', { 
        userId: user.id, 
        username: user.username 
      });
      
      return user;
    } catch (error) {
      this.logger.error('Failed to verify credentials', { username, error });
      throw new Error('Failed to verify credentials');
    }
  }
}