# 09 - Query Capabilities

This document outlines the implementation of advanced query capabilities across all interfaces of the TaskBoardAI application. These capabilities will enable users to filter, sort, and search for boards and cards based on various criteria, enhancing the usability and flexibility of the system.

## Overview

Query capabilities are essential for managing large boards or multiple boards effectively. Users need to be able to find specific cards quickly, filter cards based on properties like status or assignee, and sort cards in meaningful ways. This implementation will provide a consistent query interface across all access methods:

- MCP (Model Context Protocol)
- REST API 
- CLI

## Implementation Steps

### 1. Query Schema Definitions

First, we'll define schemas for query operations using Zod. These will be used to validate query parameters across all interfaces.

```typescript
// src/schemas/querySchemas.ts
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
```

### 2. Repository Layer Enhancements

Update the repository layer to handle filtering, sorting, and pagination operations.

```typescript
// src/repositories/BoardRepository.ts - addition to existing methods
export class BoardRepository {
  // ... existing methods
  
  async queryBoards(query: BoardQuery): Promise<Board[]> {
    // Start with all boards
    let boards = await this.getAllBoards();
    
    // Apply filters
    if (query.title) {
      boards = boards.filter(board => 
        board.title.toLowerCase().includes(query.title!.toLowerCase())
      );
    }
    
    if (query.tags && query.tags.length > 0) {
      boards = boards.filter(board => 
        query.tags!.some(tag => board.tags.includes(tag))
      );
    }
    
    if (query.createdAfter) {
      const date = new Date(query.createdAfter);
      boards = boards.filter(board => new Date(board.createdAt) >= date);
    }
    
    if (query.createdBefore) {
      const date = new Date(query.createdBefore);
      boards = boards.filter(board => new Date(board.createdAt) <= date);
    }
    
    if (query.updatedAfter) {
      const date = new Date(query.updatedAfter);
      boards = boards.filter(board => new Date(board.updatedAt) >= date);
    }
    
    if (query.updatedBefore) {
      const date = new Date(query.updatedBefore);
      boards = boards.filter(board => new Date(board.updatedAt) <= date);
    }
    
    // Apply sorting
    if (query.sortBy) {
      const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
      boards.sort((a, b) => {
        if (query.sortBy === 'title') {
          return sortOrder * a.title.localeCompare(b.title);
        } else if (query.sortBy === 'createdAt') {
          return sortOrder * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (query.sortBy === 'updatedAt') {
          return sortOrder * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        }
        return 0;
      });
    }
    
    // Apply pagination
    if (query.offset !== undefined || query.limit !== undefined) {
      const offset = query.offset || 0;
      const limit = query.limit || boards.length;
      boards = boards.slice(offset, offset + limit);
    }
    
    return boards;
  }
}

// src/repositories/CardRepository.ts - addition to existing methods
export class CardRepository {
  // ... existing methods
  
  async queryCards(boardId: string, query: CardQuery): Promise<Card[]> {
    // Get the board first
    const board = await this.boardRepository.getBoardById(boardId);
    if (!board) {
      throw new NotFoundError(`Board with ID ${boardId} not found`);
    }
    
    // Collect all cards from the board
    let cards: (Card & { columnId: string })[] = [];
    board.columns.forEach(column => {
      column.cards.forEach(card => {
        cards.push({ ...card, columnId: column.id });
      });
    });
    
    // Apply filters
    if (query.title) {
      cards = cards.filter(card => 
        card.title.toLowerCase().includes(query.title!.toLowerCase())
      );
    }
    
    if (query.content) {
      cards = cards.filter(card => 
        card.content.toLowerCase().includes(query.content!.toLowerCase())
      );
    }
    
    if (query.columnId) {
      cards = cards.filter(card => card.columnId === query.columnId);
    }
    
    if (query.priority) {
      cards = cards.filter(card => card.priority === query.priority);
    }
    
    if (query.status) {
      cards = cards.filter(card => card.status === query.status);
    }
    
    if (query.assignee) {
      cards = cards.filter(card => card.assignee === query.assignee);
    }
    
    if (query.tags && query.tags.length > 0) {
      cards = cards.filter(card => 
        query.tags!.some(tag => card.tags.includes(tag))
      );
    }
    
    if (query.createdAfter) {
      const date = new Date(query.createdAfter);
      cards = cards.filter(card => new Date(card.createdAt) >= date);
    }
    
    if (query.createdBefore) {
      const date = new Date(query.createdBefore);
      cards = cards.filter(card => new Date(card.createdAt) <= date);
    }
    
    if (query.updatedAfter) {
      const date = new Date(query.updatedAfter);
      cards = cards.filter(card => new Date(card.updatedAt) >= date);
    }
    
    if (query.updatedBefore) {
      const date = new Date(query.updatedBefore);
      cards = cards.filter(card => new Date(card.updatedAt) <= date);
    }
    
    // Apply sorting
    if (query.sortBy) {
      const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
      cards.sort((a, b) => {
        if (query.sortBy === 'title') {
          return sortOrder * a.title.localeCompare(b.title);
        } else if (query.sortBy === 'priority') {
          const priorityValues = { low: 0, medium: 1, high: 2 };
          return sortOrder * (priorityValues[a.priority] - priorityValues[b.priority]);
        } else if (query.sortBy === 'createdAt') {
          return sortOrder * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (query.sortBy === 'updatedAt') {
          return sortOrder * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        } else if (query.sortBy === 'status') {
          return sortOrder * a.status.localeCompare(b.status);
        }
        return 0;
      });
    }
    
    // Apply pagination
    if (query.offset !== undefined || query.limit !== undefined) {
      const offset = query.offset || 0;
      const limit = query.limit || cards.length;
      cards = cards.slice(offset, offset + limit);
    }
    
    return cards;
  }
}
```

### 3. Service Layer Enhancements

Update the service layer to provide query capabilities through high-level methods.

```typescript
// src/services/BoardService.ts - addition to existing methods
export class BoardService {
  // ... existing methods
  
  async queryBoards(query: BoardQuery): Promise<Board[]> {
    try {
      const validatedQuery = BoardQuerySchema.parse(query);
      return await this.boardRepository.queryBoards(validatedQuery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid query parameters', error);
      }
      throw error;
    }
  }
}

// src/services/CardService.ts - addition to existing methods
export class CardService {
  // ... existing methods
  
  async queryCards(boardId: string, query: CardQuery): Promise<Card[]> {
    try {
      // Validate boardId
      if (!uuidValidate(boardId)) {
        throw new ValidationError(`Invalid board ID: ${boardId}`);
      }
      
      const validatedQuery = CardQuerySchema.parse(query);
      return await this.cardRepository.queryCards(boardId, validatedQuery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid query parameters', error);
      }
      throw error;
    }
  }
}
```

### 4. MCP Interface Implementation

Update the MCP interface to provide query capabilities to agents.

```typescript
// src/mcp/tools/boards.js - addition to existing methods
export const boardsTools = {
  // ... existing tools

  queryBoards: {
    description: "Search for boards that match specific criteria. Filter by title, creation date, update date, or tags. Sort and paginate results.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Filter boards by title (partial match)",
        },
        createdBefore: {
          type: "string",
          format: "date-time",
          description: "Filter boards created before this date",
        },
        createdAfter: {
          type: "string",
          format: "date-time",
          description: "Filter boards created after this date",
        },
        updatedBefore: {
          type: "string",
          format: "date-time",
          description: "Filter boards updated before this date",
        },
        updatedAfter: {
          type: "string",
          format: "date-time",
          description: "Filter boards updated after this date",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter boards containing any of these tags",
        },
        sortBy: {
          type: "string",
          enum: ["title", "createdAt", "updatedAt"],
          description: "Property to sort by",
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order (ascending or descending)",
        },
        limit: {
          type: "integer",
          description: "Maximum number of boards to return",
        },
        offset: {
          type: "integer",
          description: "Number of boards to skip",
        },
      },
    },
    async handler(query) {
      try {
        const serviceFactory = new ServiceFactory();
        const boardService = serviceFactory.createBoardService();
        
        const boards = await boardService.queryBoards(query);
        
        return {
          success: true,
          data: {
            boards,
            count: boards.length,
            query
          },
          help: `Found ${boards.length} boards matching your query. You can refine your search using additional filters.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  }
};

// src/mcp/tools/cards.js - addition to existing methods
export const cardsTools = {
  // ... existing tools

  queryCards: {
    description: "Search for cards within a board that match specific criteria. Filter by title, content, column, priority, status, assignee, or tags. Sort and paginate results.",
    parameters: {
      type: "object",
      required: ["boardId"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the cards to query",
        },
        title: {
          type: "string",
          description: "Filter cards by title (partial match)",
        },
        content: {
          type: "string",
          description: "Filter cards by content (partial match)",
        },
        columnId: {
          type: "string",
          description: "Filter cards by column ID",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Filter cards by priority level",
        },
        status: {
          type: "string",
          description: "Filter cards by status",
        },
        assignee: {
          type: "string",
          description: "Filter cards by assignee",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter cards containing any of these tags",
        },
        createdBefore: {
          type: "string",
          format: "date-time",
          description: "Filter cards created before this date",
        },
        createdAfter: {
          type: "string",
          format: "date-time",
          description: "Filter cards created after this date",
        },
        updatedBefore: {
          type: "string",
          format: "date-time",
          description: "Filter cards updated before this date",
        },
        updatedAfter: {
          type: "string",
          format: "date-time",
          description: "Filter cards updated after this date",
        },
        sortBy: {
          type: "string",
          enum: ["title", "priority", "createdAt", "updatedAt", "status"],
          description: "Property to sort by",
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order (ascending or descending)",
        },
        limit: {
          type: "integer",
          description: "Maximum number of cards to return",
        },
        offset: {
          type: "integer",
          description: "Number of cards to skip",
        },
      },
    },
    async handler(params) {
      try {
        const { boardId, ...query } = params;
        
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        const cards = await cardService.queryCards(boardId, query);
        
        return {
          success: true,
          data: {
            cards,
            count: cards.length,
            boardId,
            query
          },
          help: `Found ${cards.length} cards matching your query. You can refine your search using additional filters.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  }
};
```

### 5. REST API Implementation

Update the REST API endpoints to provide query capabilities.

```typescript
// src/controllers/boardController.ts - addition to existing methods
export class BoardController {
  // ... existing methods
  
  async queryBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const serviceFactory = new ServiceFactory();
      const boardService = serviceFactory.createBoardService();
      
      const boards = await boardService.queryBoards(req.query);
      
      return res.status(200).json({
        success: true,
        count: boards.length,
        data: boards
      });
    } catch (error) {
      next(error);
    }
  }
}

// src/controllers/cardController.ts - addition to existing methods
export class CardController {
  // ... existing methods
  
  async queryCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId } = req.params;
      
      const serviceFactory = new ServiceFactory();
      const cardService = serviceFactory.createCardService();
      
      const cards = await cardService.queryCards(boardId, req.query);
      
      return res.status(200).json({
        success: true,
        count: cards.length,
        data: cards
      });
    } catch (error) {
      next(error);
    }
  }
}

// src/routes/boardRoutes.ts - addition to existing routes
router.get('/query', boardController.queryBoards);

// src/routes/cardRoutes.ts - addition to existing routes
router.get('/boards/:boardId/cards/query', cardController.queryCards);
```

### 6. CLI Implementation

Update the CLI commands to provide query capabilities.

```typescript
// src/cli/commands/boardCommands.ts - addition to existing commands
export function setupBoardCommands(program: Command): void {
  // ... existing commands
  
  program
    .command('boards:query')
    .description('Search for boards that match specific criteria')
    .option('--title <title>', 'Filter boards by title (partial match)')
    .option('--created-before <date>', 'Filter boards created before this date (ISO format)')
    .option('--created-after <date>', 'Filter boards created after this date (ISO format)')
    .option('--updated-before <date>', 'Filter boards updated before this date (ISO format)')
    .option('--updated-after <date>', 'Filter boards updated after this date (ISO format)')
    .option('--tags <tags>', 'Filter boards containing any of these tags (comma-separated)', commaSeparatedList)
    .option('--sort-by <property>', 'Property to sort by (title, createdAt, updatedAt)')
    .option('--sort-order <order>', 'Sort order (asc, desc)')
    .option('--limit <number>', 'Maximum number of boards to return')
    .option('--offset <number>', 'Number of boards to skip')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const boardService = serviceFactory.createBoardService();
        
        const query: BoardQuery = {
          title: options.title,
          createdBefore: options.createdBefore,
          createdAfter: options.createdAfter,
          updatedBefore: options.updatedBefore,
          updatedAfter: options.updatedAfter,
          tags: options.tags,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
          limit: options.limit ? parseInt(options.limit) : undefined,
          offset: options.offset ? parseInt(options.offset) : undefined
        };
        
        const boards = await boardService.queryBoards(query);
        
        if (options.output === 'json') {
          console.log(JSON.stringify(boards, null, 2));
        } else {
          // Create table output
          const table = new Table({
            head: ['ID', 'Title', 'Created At', 'Updated At', 'Tags'],
            style: { head: ['cyan'] }
          });
          
          boards.forEach(board => {
            table.push([
              board.id,
              board.title,
              new Date(board.createdAt).toLocaleString(),
              new Date(board.updatedAt).toLocaleString(),
              board.tags.join(', ')
            ]);
          });
          
          console.log(table.toString());
          console.log(chalk.green(`Found ${boards.length} boards matching your query`));
        }
      } catch (error) {
        handleCliError(error);
      }
    });
}

// src/cli/commands/cardCommands.ts - addition to existing commands
export function setupCardCommands(program: Command): void {
  // ... existing commands
  
  program
    .command('cards:query')
    .description('Search for cards within a board that match specific criteria')
    .requiredOption('--board-id <id>', 'ID of the board containing the cards to query')
    .option('--title <title>', 'Filter cards by title (partial match)')
    .option('--content <content>', 'Filter cards by content (partial match)')
    .option('--column-id <id>', 'Filter cards by column ID')
    .option('--priority <priority>', 'Filter cards by priority level (low, medium, high)')
    .option('--status <status>', 'Filter cards by status')
    .option('--assignee <assignee>', 'Filter cards by assignee')
    .option('--tags <tags>', 'Filter cards containing any of these tags (comma-separated)', commaSeparatedList)
    .option('--created-before <date>', 'Filter cards created before this date (ISO format)')
    .option('--created-after <date>', 'Filter cards created after this date (ISO format)')
    .option('--updated-before <date>', 'Filter cards updated before this date (ISO format)')
    .option('--updated-after <date>', 'Filter cards updated after this date (ISO format)')
    .option('--sort-by <property>', 'Property to sort by (title, priority, createdAt, updatedAt, status)')
    .option('--sort-order <order>', 'Sort order (asc, desc)')
    .option('--limit <number>', 'Maximum number of cards to return')
    .option('--offset <number>', 'Number of cards to skip')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        const query: CardQuery = {
          title: options.title,
          content: options.content,
          columnId: options.columnId,
          priority: options.priority,
          status: options.status,
          assignee: options.assignee,
          tags: options.tags,
          createdBefore: options.createdBefore,
          createdAfter: options.createdAfter,
          updatedBefore: options.updatedBefore,
          updatedAfter: options.updatedAfter,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
          limit: options.limit ? parseInt(options.limit) : undefined,
          offset: options.offset ? parseInt(options.offset) : undefined
        };
        
        const cards = await cardService.queryCards(options.boardId, query);
        
        if (options.output === 'json') {
          console.log(JSON.stringify(cards, null, 2));
        } else {
          // Create table output
          const table = new Table({
            head: ['ID', 'Title', 'Priority', 'Status', 'Assignee', 'Tags'],
            style: { head: ['cyan'] }
          });
          
          cards.forEach(card => {
            table.push([
              card.id,
              card.title,
              getPriorityColor(card.priority)(card.priority),
              card.status,
              card.assignee || '-',
              card.tags.join(', ')
            ]);
          });
          
          console.log(table.toString());
          console.log(chalk.green(`Found ${cards.length} cards matching your query`));
        }
      } catch (error) {
        handleCliError(error);
      }
    });
}

// Helper function for comma-separated lists
function commaSeparatedList(value: string): string[] {
  return value.split(',').map(item => item.trim());
}

// Helper function for priority coloring
function getPriorityColor(priority: string): (text: string) => string {
  switch (priority) {
    case 'high':
      return chalk.red;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.green;
    default:
      return chalk.white;
  }
}
```

## Testing Strategy

### Unit Tests

Create comprehensive unit tests for query functionality:

```typescript
// src/tests/unit/services/BoardService.test.ts
describe('BoardService - queryBoards', () => {
  let boardService: BoardService;
  let mockRepository: jest.Mocked<BoardRepository>;
  
  beforeEach(() => {
    mockRepository = {
      queryBoards: jest.fn(),
      // ... other methods
    } as any;
    
    boardService = new BoardService(mockRepository);
  });
  
  it('should pass valid query parameters to repository', async () => {
    const query = {
      title: 'Test',
      sortBy: 'title' as const,
      sortOrder: 'asc' as const
    };
    
    mockRepository.queryBoards.mockResolvedValue([]);
    
    await boardService.queryBoards(query);
    
    expect(mockRepository.queryBoards).toHaveBeenCalledWith(query);
  });
  
  it('should throw ValidationError for invalid query parameters', async () => {
    const query = {
      sortBy: 'invalid_field', // This is not a valid sortBy value
      sortOrder: 'asc' as const
    };
    
    await expect(boardService.queryBoards(query as any)).rejects.toThrow(ValidationError);
  });
});

// Similar tests for CardService
```

### Integration Tests

Create integration tests for query endpoints:

```typescript
// src/tests/integration/routes/boardRoutes.test.ts
describe('Board Query API', () => {
  beforeEach(async () => {
    // Set up test data
    // ...
  });
  
  it('should return boards filtered by title', async () => {
    const response = await request(app)
      .get('/api/boards/query')
      .query({ title: 'Test' });
    
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].title).toContain('Test');
  });
  
  it('should sort boards by title in ascending order', async () => {
    const response = await request(app)
      .get('/api/boards/query')
      .query({ sortBy: 'title', sortOrder: 'asc' });
    
    expect(response.status).toBe(200);
    
    // Check if the boards are sorted correctly
    const titles = response.body.data.map(board => board.title);
    const sortedTitles = [...titles].sort();
    expect(titles).toEqual(sortedTitles);
  });
  
  // Additional tests for other query parameters
});

// Similar tests for Card Query API
```

### MCP Tests

Create tests for MCP query tools:

```typescript
// src/tests/unit/mcp/tools/board-query.test.ts
describe('MCP Board Query Tool', () => {
  let mockBoardService;
  
  beforeEach(() => {
    mockBoardService = {
      queryBoards: jest.fn()
    };
    
    // Mock the ServiceFactory to return our mock service
    jest.spyOn(ServiceFactory.prototype, 'createBoardService').mockReturnValue(mockBoardService);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should return boards matching query criteria', async () => {
    const query = {
      title: 'Test',
      sortBy: 'title',
      sortOrder: 'asc'
    };
    
    const mockBoards = [
      { id: '1', title: 'Test Board 1', /* other fields */ },
      { id: '2', title: 'Test Board 2', /* other fields */ }
    ];
    
    mockBoardService.queryBoards.mockResolvedValue(mockBoards);
    
    const result = await boardsTools.queryBoards.handler(query);
    
    expect(result.success).toBe(true);
    expect(result.data.boards).toEqual(mockBoards);
    expect(result.data.count).toBe(mockBoards.length);
    expect(mockBoardService.queryBoards).toHaveBeenCalledWith(query);
  });
  
  it('should handle errors properly', async () => {
    mockBoardService.queryBoards.mockRejectedValue(new ValidationError('Invalid query'));
    
    const result = await boardsTools.queryBoards.handler({});
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.type).toBe('ValidationError');
  });
});

// Similar tests for MCP Card Query Tool
```

## CLI Tests

Create tests for CLI query commands:

```typescript
// src/tests/unit/cli/board-query.test.ts
describe('CLI Board Query Command', () => {
  let mockBoardService;
  let consoleSpy;
  
  beforeEach(() => {
    mockBoardService = {
      queryBoards: jest.fn()
    };
    
    // Mock the ServiceFactory to return our mock service
    jest.spyOn(ServiceFactory.prototype, 'createBoardService').mockReturnValue(mockBoardService);
    
    // Spy on console.log
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('should display boards in table format by default', async () => {
    const mockBoards = [
      { 
        id: '1', 
        title: 'Test Board 1', 
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z',
        tags: ['test', 'important']
      }
    ];
    
    mockBoardService.queryBoards.mockResolvedValue(mockBoards);
    
    // Run the command
    const command = program.commands.find(cmd => cmd.name() === 'boards:query');
    await command.action()({ title: 'Test' });
    
    // Check that the service was called correctly
    expect(mockBoardService.queryBoards).toHaveBeenCalledWith({
      title: 'Test'
    });
    
    // Check that the output was formatted as a table
    expect(consoleSpy).toHaveBeenCalled();
    // Check that the output contained the board data
    expect(consoleSpy.mock.calls.some(call => 
      call[0] && call[0].includes('Test Board 1')
    )).toBe(true);
  });
  
  it('should output JSON when requested', async () => {
    const mockBoards = [{ id: '1', title: 'Test Board 1' }];
    mockBoardService.queryBoards.mockResolvedValue(mockBoards);
    
    // Run the command with JSON output
    const command = program.commands.find(cmd => cmd.name() === 'boards:query');
    await command.action()({ title: 'Test', output: 'json' });
    
    // Check that the output was JSON
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockBoards, null, 2));
  });
});

// Similar tests for CLI Card Query Command
```

## Benefits and Impact

Implementing query capabilities across all interfaces will provide several benefits:

1. **Enhanced User Experience**: Users can quickly find the information they need, even in large boards or when managing multiple boards.

2. **Improved Agent Capabilities**: MCP agents can perform more sophisticated board and card management tasks, resulting in better assistance for users.

3. **Consistent API**: All interfaces share the same query capabilities, ensuring a consistent experience regardless of how the system is accessed.

4. **Reduced Response Sizes**: Queries allow clients to receive only the data they need, reducing payload sizes and improving performance.

5. **Flexible Sorting and Pagination**: Users can control the order and limit of results, improving the readability and usability of data.

## Conclusion

The implementation of query capabilities is a significant enhancement to the TaskBoardAI application. By providing consistent filtering, sorting, and pagination capabilities across all interfaces, we enable users and agents to work more efficiently with boards and cards. These capabilities form the foundation for more advanced features like dashboards, reports, and AI-assisted board management.