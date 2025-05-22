# 2. Core Schema Definitions

## Objective
Create a centralized schema system for data validation that ensures consistency across all interfaces.

## Implementation Tasks

### 2.1 Schema Infrastructure

- Set up schema utilities in `server/core/schemas/utils`
- Create schema versioning framework
- Implement schema validation functions

**`server/core/schemas/utils/validate.ts`:**
```typescript
import { z } from 'zod';
import { ValidationError } from '@core/errors';

/**
 * Validates data against a schema and returns the validated data
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.format();
      throw new ValidationError('Schema validation failed', { details });
    }
    throw error;
  }
}

/**
 * Checks if data matches schema without throwing exceptions
 */
export function isValid<T>(schema: z.ZodType<T>, data: unknown): boolean {
  const result = schema.safeParse(data);
  return result.success;
}
```

### 2.2 Base Entity Schemas

#### 2.2.1 Card Schema

**`server/core/schemas/card.schema.ts`:**
```typescript
import { z } from 'zod';

// Base schema with common fields across versions
const baseCardSchema = z.object({
  id: z.string().uuid('Card ID must be a valid UUID'),
  title: z.string().min(1, 'Card title is required'),
  columnId: z.string().uuid('Column ID must be a valid UUID'),
  position: z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
});

// Optional fields schema
const cardOptionalFields = z.object({
  content: z.string().optional(),
  collapsed: z.boolean().optional(),
  subtasks: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string().uuid('Dependency ID must be a valid UUID')).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  blocked_at: z.string().datetime().nullable().optional(),
});

// Complete schema (v1) with required and optional fields
export const cardSchemaV1 = baseCardSchema.merge(cardOptionalFields);

// Creation schema (doesn't require ID or timestamps - will be generated)
export const cardCreationSchema = baseCardSchema
  .omit({ id: true, position: true })
  .merge(cardOptionalFields)
  .omit({ created_at: true, updated_at: true });

// Update schema (makes almost all fields optional except ID for identification)
export const cardUpdateSchema = baseCardSchema
  .pick({ id: true })
  .merge(baseCardSchema.omit({ id: true }).partial())
  .merge(cardOptionalFields);

// Reference schema for batch operations that need to refer to cards
export const cardReferenceSchema = z.object({
  id: z.string(),
  refId: z.string().optional(), // For creating temporary references
});

// Export all schemas
export const cardSchemas = {
  v1: cardSchemaV1,
  create: cardCreationSchema,
  update: cardUpdateSchema,
  reference: cardReferenceSchema,
};

// Type inferences
export type Card = z.infer<typeof cardSchemaV1>;
export type CardCreation = z.infer<typeof cardCreationSchema>;
export type CardUpdate = z.infer<typeof cardUpdateSchema>;
export type CardReference = z.infer<typeof cardReferenceSchema>;
```

#### 2.2.2 Column Schema

**`server/core/schemas/column.schema.ts`:**
```typescript
import { z } from 'zod';

// Base schema with required fields
const baseColumnSchema = z.object({
  id: z.string().uuid('Column ID must be a valid UUID'),
  name: z.string().min(1, 'Column name is required')
});

// Optional fields
const columnOptionalFields = z.object({
  position: z.number().int().min(0).optional(),
  wip_limit: z.number().int().min(0).optional(),
  description: z.string().optional(),
});

// Complete schema (v1)
export const columnSchemaV1 = baseColumnSchema.merge(columnOptionalFields);

// Creation schema (ID is optional - will be generated if not provided)
export const columnCreationSchema = baseColumnSchema
  .omit({ id: true })
  .merge(baseColumnSchema.pick({ id: true }).partial())
  .merge(columnOptionalFields);

// Update schema
export const columnUpdateSchema = baseColumnSchema
  .pick({ id: true })
  .merge(baseColumnSchema.omit({ id: true }).partial())
  .merge(columnOptionalFields);

// Export all schemas
export const columnSchemas = {
  v1: columnSchemaV1,
  create: columnCreationSchema,
  update: columnUpdateSchema,
};

// Type inferences
export type Column = z.infer<typeof columnSchemaV1>;
export type ColumnCreation = z.infer<typeof columnCreationSchema>;
export type ColumnUpdate = z.infer<typeof columnUpdateSchema>;
```

#### 2.2.3 Board Schema

**`server/core/schemas/board.schema.ts`:**
```typescript
import { z } from 'zod';
import { columnSchemaV1 } from './column.schema';
import { cardSchemaV1 } from './card.schema';

// Base schema with required fields
const baseBoardSchema = z.object({
  id: z.string().uuid('Board ID must be a valid UUID'),
  projectName: z.string().min(1, 'Board name is required')
});

// Optional fields
const boardOptionalFields = z.object({
  description: z.string().optional(),
  last_updated: z.string().datetime().optional(),
});

// Complete schema (v1)
export const boardSchemaV1 = baseBoardSchema
  .merge(boardOptionalFields)
  .extend({
    columns: z.array(columnSchemaV1),
    cards: z.array(cardSchemaV1).optional(),
  });

// Creation schema (ID is optional - will be generated if not provided)
export const boardCreationSchema = baseBoardSchema
  .omit({ id: true })
  .merge(baseBoardSchema.pick({ id: true }).partial())
  .merge(boardOptionalFields)
  .extend({
    columns: z.array(columnSchemaV1.omit({ id: true })).optional(),
  });

// Update schema
export const boardUpdateSchema = baseBoardSchema
  .pick({ id: true })
  .merge(baseBoardSchema.omit({ id: true }).partial())
  .merge(boardOptionalFields)
  .extend({
    columns: z.array(columnSchemaV1).optional(),
    cards: z.array(cardSchemaV1).optional(),
  });

// Board formats
export const boardFormatSchema = z.enum(['full', 'summary', 'compact', 'cards-only']);

// Board query parameters
export const boardQuerySchema = z.object({
  format: boardFormatSchema.optional(),
  columnId: z.string().uuid().optional(),
});

// Export all schemas
export const boardSchemas = {
  v1: boardSchemaV1,
  create: boardCreationSchema,
  update: boardUpdateSchema,
  query: boardQuerySchema,
};

// Type inferences
export type Board = z.infer<typeof boardSchemaV1>;
export type BoardCreation = z.infer<typeof boardCreationSchema>;
export type BoardUpdate = z.infer<typeof boardUpdateSchema>;
export type BoardFormat = z.infer<typeof boardFormatSchema>;
export type BoardQuery = z.infer<typeof boardQuerySchema>;
```

### 2.3 Operation Schemas

#### 2.3.1 Batch Operations Schema

**`server/core/schemas/operations.schema.ts`:**
```typescript
import { z } from 'zod';
import { cardSchemaV1 } from './card.schema';

// Card operation types
export const operationTypeSchema = z.enum(['create', 'update', 'move']);

// Position specification
export const positionSpecSchema = z.union([
  z.number().int().min(0),
  z.enum(['first', 'last', 'up', 'down'])
]);

// Base operation fields
const baseOperationSchema = z.object({
  type: operationTypeSchema,
  reference: z.string().optional(),
});

// Create operation
const createOperationSchema = baseOperationSchema
  .extend({
    type: z.literal('create'),
    cardData: z.union([
      z.string(),
      z.object({}).passthrough()
    ]).optional(),
    columnId: z.string().uuid().optional(),
    position: positionSpecSchema.optional(),
  });

// Update operation
const updateOperationSchema = baseOperationSchema
  .extend({
    type: z.literal('update'),
    cardId: z.string(),
    cardData: z.union([
      z.string(),
      z.object({}).passthrough()
    ]),
  });

// Move operation
const moveOperationSchema = baseOperationSchema
  .extend({
    type: z.literal('move'),
    cardId: z.string(),
    columnId: z.string().uuid(),
    position: positionSpecSchema,
  });

// Union of all operation types
export const cardOperationSchema = z.discriminatedUnion('type', [
  createOperationSchema,
  updateOperationSchema,
  moveOperationSchema
]);

// Batch operations request
export const batchCardOperationsSchema = z.object({
  boardId: z.string().uuid('Board ID must be a valid UUID'),
  operations: z.array(cardOperationSchema)
    .min(1, 'At least one operation is required')
    .max(100, 'Maximum 100 operations per batch'),
});

// Type inferences
export type OperationType = z.infer<typeof operationTypeSchema>;
export type PositionSpec = z.infer<typeof positionSpecSchema>;
export type CardOperation = z.infer<typeof cardOperationSchema>;
export type BatchCardOperations = z.infer<typeof batchCardOperationsSchema>;
```

#### 2.3.2 Config Schema

**`server/core/schemas/config.schema.ts`:**
```typescript
import { z } from 'zod';

// Rate limiting configuration
export const rateLimitRuleSchema = z.object({
  windowMs: z.number().int().min(1000),
  maxRequests: z.number().int().min(1),
});

export const rateLimitConfigSchema = z.object({
  read: rateLimitRuleSchema,
  write: rateLimitRuleSchema,
});

// Server configuration
export const serverConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  mcpPort: z.number().int().min(1024).max(65535).optional(),
  host: z.string().optional(),
  apiEndpoint: z.string().optional(),
  authEnabled: z.boolean().optional(),
});

// Application configuration
export const appConfigSchema = z.object({
  boardsDir: z.string(),
  templateBoardsDir: z.string(),
  dataFile: z.string().optional(),
  boardFile: z.string().optional(),
  server: serverConfigSchema,
  rateLimits: rateLimitConfigSchema.optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  dataStorage: z.enum(['local', 'cloud']).optional(),
});

// Config update schema (partial)
export const configUpdateSchema = appConfigSchema.partial();

// Export schemas
export const configSchemas = {
  app: appConfigSchema,
  update: configUpdateSchema,
  server: serverConfigSchema,
  rateLimit: rateLimitConfigSchema,
};

// Type inferences
export type AppConfig = z.infer<typeof appConfigSchema>;
export type ConfigUpdate = z.infer<typeof configUpdateSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
```

#### 2.3.3 Webhook Schema

**`server/core/schemas/webhook.schema.ts`:**
```typescript
import { z } from 'zod';

// Webhook event types
export const webhookEventTypeSchema = z.enum([
  'board.created',
  'board.updated',
  'board.deleted',
  'card.created',
  'card.updated',
  'card.moved',
  'card.deleted'
]);

// Base webhook schema
export const webhookSchemaV1 = z.object({
  id: z.string().uuid('Webhook ID must be a valid UUID'),
  name: z.string().min(1, 'Webhook name is required'),
  url: z.string().url('Webhook URL must be a valid URL'),
  event: webhookEventTypeSchema,
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  secret: z.string().optional(),
  active: z.boolean().optional(),
});

// Creation schema
export const webhookCreationSchema = webhookSchemaV1
  .omit({ id: true, created_at: true, updated_at: true });

// Update schema
export const webhookUpdateSchema = webhookSchemaV1
  .pick({ id: true })
  .merge(webhookSchemaV1.omit({ id: true }).partial());

// Export schemas
export const webhookSchemas = {
  v1: webhookSchemaV1,
  create: webhookCreationSchema,
  update: webhookUpdateSchema,
};

// Type inferences
export type Webhook = z.infer<typeof webhookSchemaV1>;
export type WebhookCreation = z.infer<typeof webhookCreationSchema>;
export type WebhookUpdate = z.infer<typeof webhookUpdateSchema>;
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;
```

### 2.4 Response Schemas

**`server/core/schemas/response.schema.ts`:**
```typescript
import { z } from 'zod';

// Pagination metadata
export const paginationMetaSchema = z.object({
  currentPage: z.number().int().min(1),
  perPage: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  nextCursor: z.string().optional(),
  prevCursor: z.string().optional(),
});

// Error response
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
});

// Base API response
export const apiResponseSchema = z.object({
  data: z.any().optional(),
  error: errorSchema.optional(),
  meta: z.object({
    pagination: paginationMetaSchema.optional(),
    timestamp: z.string().datetime(),
  }).optional(),
});

// MCP content item
export const mcpContentSchema = z.object({
  type: z.string(),
  text: z.string(),
});

// MCP response
export const mcpResponseSchema = z.object({
  content: z.array(mcpContentSchema),
  isError: z.boolean().optional(),
});

// Export schemas
export const responseSchemas = {
  api: apiResponseSchema,
  mcp: mcpResponseSchema,
  error: errorSchema,
  pagination: paginationMetaSchema,
};

// Type inferences
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type McpResponse = z.infer<typeof mcpResponseSchema>;
export type McpContent = z.infer<typeof mcpContentSchema>;
export type ErrorResponse = z.infer<typeof errorSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
```

### 2.5 Schema Index File

**`server/core/schemas/index.ts`:**
```typescript
// Export all schemas through barrel file
export * from './board.schema';
export * from './card.schema';
export * from './column.schema';
export * from './config.schema';
export * from './operations.schema';
export * from './response.schema';
export * from './webhook.schema';
export * from './utils/validate';
```

## Expected Outcome
- Complete schema validation system
- Consistent data structures across interfaces
- Type definitions for all entities
- Validation utilities ready for use in repositories and services
- Schema versioning capability