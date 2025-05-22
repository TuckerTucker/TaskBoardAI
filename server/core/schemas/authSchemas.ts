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

export const UserUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
  role: z.enum(['admin', 'user', 'agent']).optional()
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

export const ApiKeyResponseSchema = z.object({
  apiKey: z.string(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime()
});

// Export types
export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;