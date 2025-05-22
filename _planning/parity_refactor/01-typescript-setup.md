# 1. TypeScript Setup

## Objective
Set up TypeScript for the entire project, providing a solid foundation for type safety and better developer experience.

## Implementation Tasks

### 1.1 Project Configuration
- Create `tsconfig.json` in project root with strict typing enabled
- Configure output directory structure in `dist/`
- Set up source maps for debugging
- Configure paths for module resolution

```json
// Example tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./server",
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "declaration": true,
    "paths": {
      "@core/*": ["./server/core/*"],
      "@models/*": ["./server/core/models/*"],
      "@services/*": ["./server/core/services/*"],
      "@repositories/*": ["./server/core/repositories/*"],
      "@schemas/*": ["./server/core/schemas/*"],
      "@utils/*": ["./server/core/utils/*"],
      "@errors/*": ["./server/core/errors/*"],
      "@mcp/*": ["./server/mcp/*"],
      "@api/*": ["./server/api/*"],
      "@cli/*": ["./server/cli/*"]
    }
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 1.2 Development Dependencies
- Add TypeScript and related dependencies:
  - `typescript`
  - `ts-node` for development
  - `@types/node` and other necessary types
  - `eslint` with TypeScript plugins
  - `jest` and `ts-jest` for testing

```sh
npm install --save-dev typescript ts-node @types/node @types/express eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin jest ts-jest @types/jest
```

### 1.3 Build and Run Scripts
- Update `package.json` scripts for TypeScript:
  - Build command for production
  - Dev command with ts-node
  - Type checking
  - Linting

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/server/server.js",
  "dev": "ts-node server/server.ts",
  "typecheck": "tsc --noEmit",
  "lint": "eslint 'server/**/*.ts'",
  "test": "jest",
  "mcp": "ts-node server/mcp/kanbanMcpServer.ts"
}
```

### 1.4 Core Type Definitions
- Create initial basic types folder at `server/core/types/`
- Define essential entity interfaces:

**`server/core/types/Board.ts`:**
```typescript
export interface Board {
  id: string;
  projectName: string;
  columns: Column[];
  cards?: Card[];
  last_updated: string;
  description?: string;
  [key: string]: any; // For flexibility during migration
}
```

**`server/core/types/Column.ts`:**
```typescript
export interface Column {
  id: string;
  name: string;
  position?: number;
}
```

**`server/core/types/Card.ts`:**
```typescript
export interface Card {
  id: string;
  title: string;
  content?: string;
  columnId: string;
  position: number;
  collapsed?: boolean;
  subtasks?: string[];
  tags?: string[];
  dependencies?: string[];
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  blocked_at?: string | null;
  priority?: 'low' | 'medium' | 'high';
}
```

### 1.5 Configuration Types
- Define types for configuration:

**`server/core/types/Config.ts`:**
```typescript
export interface AppConfig {
  boardsDir: string;
  templateBoardsDir: string;
  dataFile: string;
  boardFile: string;
  port: number;
  mcpPort?: number;
  authEnabled?: boolean;
  rateLimits?: RateLimitConfig;
}

export interface RateLimitConfig {
  read: RateLimitRule;
  write: RateLimitRule;
}

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}
```

### 1.6 MCP Types
- Define types for MCP-specific functionality:

**`server/core/types/Mcp.ts`:**
```typescript
export interface McpToolDependencies {
  config: any;
  checkRateLimit: (options?: RateLimitOptions) => void;
  logger: any;
}

export interface RateLimitOptions {
  clientId?: string;
  operationType?: 'read' | 'write';
}

export interface McpToolResponse {
  content: McpContent[];
  isError?: boolean;
}

export interface McpContent {
  type: string;
  text: string;
}
```

### 1.7 API Types
- Define types for API responses:

**`server/core/types/Api.ts`:**
```typescript
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    pagination?: PaginationMeta;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginationMeta {
  currentPage: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  nextCursor?: string;
}
```

### 1.8 Setup Initial Barrel Files
- Create index.ts files for easy imports:

**`server/core/types/index.ts`:**
```typescript
export * from './Board';
export * from './Card';
export * from './Column';
export * from './Config';
export * from './Api';
export * from './Mcp';
```

### 1.9 Module Organization
- Establish a clear naming convention document
- Define module import strategy
- Set up barrel exports for clean imports

## Expected Outcome
- Complete TypeScript setup ready for the rest of the implementation
- Core type definitions available for entities
- Build pipeline configured and working
- Developer tools set up (linting, testing)