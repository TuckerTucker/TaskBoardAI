import { z } from 'zod';

export const SortOrderSchema = z.enum(['asc', 'desc']);

export const BoardQuerySchema = z.object({
  title: z.string().optional(),
  createdBefore: z.string().datetime().optional(),
  createdAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt']).optional(),
  sortOrder: SortOrderSchema.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const CardQuerySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  columnId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.string().optional(),
  assignee: z.string().optional(),
  createdBefore: z.string().datetime().optional(),
  createdAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['title', 'priority', 'createdAt', 'updatedAt', 'status']).optional(),
  sortOrder: SortOrderSchema.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type BoardQuery = z.infer<typeof BoardQuerySchema>;
export type CardQuery = z.infer<typeof CardQuerySchema>;
export type SortOrder = z.infer<typeof SortOrderSchema>;