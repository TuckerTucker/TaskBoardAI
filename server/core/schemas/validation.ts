import { z } from 'zod';

export const CardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  position: z.number().min(0),
  columnId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ColumnSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  position: z.number().min(0),
  wipLimit: z.number().min(1).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
});

export const BoardSettingsSchema = z.object({
  allowWipLimitExceeding: z.boolean().default(false),
  showCardCount: z.boolean().default(true),
  enableDragDrop: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'auto']).default('light')
});

export const BoardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  columns: z.array(ColumnSchema),
  cards: z.array(CardSchema),
  settings: BoardSettingsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ServerConfigSchema = z.object({
  port: z.number().min(1000).max(65535).default(3001),
  host: z.string().default('localhost'),
  enableCors: z.boolean().default(true),
  corsOrigins: z.array(z.string()).default(['*']),
  rateLimit: z.object({
    windowMs: z.number().min(1000).default(900000),
    maxRequests: z.number().min(1).default(100)
  })
});

export const DefaultsConfigSchema = z.object({
  board: z.object({
    columns: z.array(z.string()).default(['To Do', 'In Progress', 'Done']),
    settings: BoardSettingsSchema
  })
});

export const ConfigSchema = z.object({
  server: ServerConfigSchema,
  defaults: DefaultsConfigSchema
});

export const CreateCardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  columnId: z.string().uuid(),
  tags: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional()
});

export const UpdateCardSchema = CreateCardSchema.partial().omit({ columnId: true });

export const CreateColumnSchema = z.object({
  title: z.string().min(1).max(100),
  wipLimit: z.number().min(1).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional()
});

export const UpdateColumnSchema = CreateColumnSchema.partial();

export const CreateBoardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  columns: z.array(z.string()).min(1).optional(),
  settings: BoardSettingsSchema.partial().optional()
});

export const UpdateBoardSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  settings: BoardSettingsSchema.partial().optional()
});

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
});

export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('asc')
});

export const CardFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  priority: z.array(z.enum(['low', 'medium', 'high'])).optional(),
  assignee: z.string().optional(),
  dueDate: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).optional()
});

export type Card = z.infer<typeof CardSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Board = z.infer<typeof BoardSchema>;
export type BoardSettings = z.infer<typeof BoardSettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type CreateCard = z.infer<typeof CreateCardSchema>;
export type UpdateCard = z.infer<typeof UpdateCardSchema>;
export type CreateColumn = z.infer<typeof CreateColumnSchema>;
export type UpdateColumn = z.infer<typeof UpdateColumnSchema>;
export type CreateBoard = z.infer<typeof CreateBoardSchema>;
export type UpdateBoard = z.infer<typeof UpdateBoardSchema>;
export type PaginationParams = z.infer<typeof PaginationSchema>;
export type SortParams = z.infer<typeof SortSchema>;
export type CardFilter = z.infer<typeof CardFilterSchema>;