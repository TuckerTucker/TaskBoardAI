import { z } from 'zod';
import { 
  CreateCardSchema,
  UpdateCardSchema,
  CreateColumnSchema,
  UpdateColumnSchema 
} from './entitySchemas.js';

// Card batch operation schemas
export const CardBatchCreateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnId: z.string().uuid("Column ID must be a valid UUID"),
  cards: z.array(CreateCardSchema).min(1, "At least one card must be provided")
});

export const CardBatchUpdateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  updates: z.array(z.object({
    id: z.string().uuid("Card ID must be a valid UUID"),
    columnId: z.string().uuid("Column ID must be a valid UUID").optional(),
    updates: UpdateCardSchema
  })).min(1, "At least one card update must be provided")
});

export const CardBatchDeleteSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  cards: z.array(z.object({
    id: z.string().uuid("Card ID must be a valid UUID"),
    columnId: z.string().uuid("Column ID must be a valid UUID")
  })).min(1, "At least one card must be provided")
});

export const CardBatchMoveSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  moves: z.array(z.object({
    id: z.string().uuid("Card ID must be a valid UUID"),
    sourceColumnId: z.string().uuid("Source column ID must be a valid UUID"),
    targetColumnId: z.string().uuid("Target column ID must be a valid UUID"),
    position: z.number().int().nonnegative().optional()
  })).min(1, "At least one card move must be provided")
});

// Column batch operation schemas
export const ColumnBatchCreateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columns: z.array(CreateColumnSchema).min(1, "At least one column must be provided")
});

export const ColumnBatchUpdateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  updates: z.array(z.object({
    id: z.string().uuid("Column ID must be a valid UUID"),
    updates: UpdateColumnSchema
  })).min(1, "At least one column update must be provided")
});

export const ColumnBatchDeleteSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnIds: z.array(z.string().uuid("Column ID must be a valid UUID")).min(1, "At least one column ID must be provided")
});

export const ColumnReorderSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnOrder: z.array(z.string().uuid("Column ID must be a valid UUID"))
});

// Batch operation result schemas
export const BatchResultSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    success: z.boolean(),
    data: z.any().optional(),
    error: z.any().optional()
  })),
  totalCount: z.number(),
  successCount: z.number(),
  failureCount: z.number()
});

// Export types
export type CardBatchCreate = z.infer<typeof CardBatchCreateSchema>;
export type CardBatchUpdate = z.infer<typeof CardBatchUpdateSchema>;
export type CardBatchDelete = z.infer<typeof CardBatchDeleteSchema>;
export type CardBatchMove = z.infer<typeof CardBatchMoveSchema>;
export type ColumnBatchCreate = z.infer<typeof ColumnBatchCreateSchema>;
export type ColumnBatchUpdate = z.infer<typeof ColumnBatchUpdateSchema>;
export type ColumnBatchDelete = z.infer<typeof ColumnBatchDeleteSchema>;
export type ColumnReorder = z.infer<typeof ColumnReorderSchema>;
export type BatchResult = z.infer<typeof BatchResultSchema>;