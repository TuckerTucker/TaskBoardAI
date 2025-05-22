# 6. MCP Interface Refactoring

## Objective
Refactor the Model Context Protocol (MCP) interface to use the unified service layer, providing improved agent interaction through consistent responses, better error handling, and comprehensive documentation.

## Implementation Tasks

### 6.1 MCP Server Setup

**`server/mcp/kanbanMcpServer.ts`:**
```typescript
#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '@core/utils/logger';
import { AppConfig } from '@core/schemas';
import { ServiceFactory } from '@core/services';

// Load configuration with preset defaults
import config from '../core/utils/config';

// Initialize services
const serviceFactory = ServiceFactory.getInstance(config);

// Create MCP server with version info
const packageJson = require('../../package.json');
const server = new McpServer({
  name: 'TaskBoardAI',
  version: packageJson.version || '1.0.0',
});

// Set up error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  // Log but don't exit - let the MCP framework handle the situation
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason });
});

// Register tool categories
import { registerBoardTools } from './tools/boards';
import { registerCardTools } from './tools/cards';
import { registerServerTools } from './tools/server';
import { registerConfigTools } from './tools/config';
import { registerWebhookTools } from './tools/webhooks';
import { registerRequestContext, clearRequestContext } from './utils/requestContext';

// Register tools
registerBoardTools(server, serviceFactory);
registerCardTools(server, serviceFactory);
registerServerTools(server, serviceFactory);
registerConfigTools(server, serviceFactory);
registerWebhookTools(server, serviceFactory);

/**
 * Performs startup checks to ensure the environment is properly configured
 */
async function performStartupChecks() {
  try {
    logger.info('Starting MCP server', {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      environment: {
        USE_LOCAL_BOARDS: process.env.USE_LOCAL_BOARDS,
        BOARD_FILE: process.env.BOARD_FILE,
        NODE_ENV: process.env.NODE_ENV
      }
    });
    
    // Verify boards directory access
    logger.info('Checking filesystem access');
    const boardService = serviceFactory.getBoardService();
    
    try {
      const boards = await boardService.getBoards();
      logger.info(`Found ${boards.length} boards`);
    } catch (error) {
      logger.error('Error listing boards', error);
    }
    
  } catch (error) {
    logger.error('Error during startup checks', error);
  }
}

// Run as standalone server when executed directly
if (require.main === module) {
  (async () => {
    // Perform environment checks
    await performStartupChecks();
    
    // Create transport and connect
    const transport = new StdioServerTransport();
    
    try {
      await server.connect(transport);
      logger.info('MCP server connected successfully');
    } catch (error) {
      logger.error('Failed to start MCP server', error);
      process.exit(1);
    }
  })();
}

// Export for testing and programmatic usage
export default server;
```

### 6.2 Request Context Utilities

**`server/mcp/utils/requestContext.ts`:**
```typescript
import { v4 as uuidv4 } from 'uuid';

// Current request context information
let requestContext: {
  requestId: string;
  tool: string;
  start: number;
  userId?: string;
  boardId?: string;
  parameters?: any;
} | null = null;

/**
 * Register request context for logging and tracking
 */
export function registerRequestContext(tool: string, parameters?: any) {
  requestContext = {
    requestId: uuidv4(),
    tool,
    start: Date.now(),
    parameters
  };
  
  // Extract common IDs for easier filtering
  if (parameters) {
    if (parameters.boardId) {
      requestContext.boardId = parameters.boardId;
    }
  }
  
  return requestContext;
}

/**
 * Get the current request context
 */
export function getRequestContext() {
  return requestContext;
}

/**
 * Clear the current request context
 */
export function clearRequestContext() {
  requestContext = null;
}

/**
 * Add information to the current request context
 */
export function updateRequestContext(updates: Partial<Omit<typeof requestContext, 'requestId' | 'start'>>) {
  if (requestContext) {
    Object.assign(requestContext, updates);
  }
}
```

### 6.3 Response Formatting Utilities

**`server/mcp/utils/responseFormatter.ts`:**
```typescript
import { logger } from '@core/utils/logger';
import { getRequestContext } from './requestContext';

/**
 * Base response formatter for MCP tools
 */
export function formatResponse(
  data: any, 
  options: {
    tool: string;
    helpfulTips?: string[];
    relatedTools?: string[];
    examples?: any[];
    isError?: boolean;
  }
) {
  // Generate metrics
  const requestContext = getRequestContext();
  const metrics = requestContext ? {
    tool: options.tool,
    requestId: requestContext.requestId,
    duration: Date.now() - requestContext.start,
    boardId: requestContext.boardId
  } : null;
  
  // Log completion
  if (metrics) {
    if (options.isError) {
      logger.warn(`Tool ${options.tool} completed with error`, {
        ...metrics,
        error: typeof data === 'string' ? data : data?.message || 'Unknown error'
      });
    } else {
      logger.info(`Tool ${options.tool} completed successfully`, metrics);
    }
  }
  
  // Format the response
  const formattedData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  
  // Add helpful information if not an error
  let responseParts = [formattedData];
  
  if (!options.isError && (options.helpfulTips?.length || options.relatedTools?.length)) {
    // Add a separator
    responseParts.push('\n\n---\n');
    
    // Add helpful tips
    if (options.helpfulTips?.length) {
      responseParts.push('Tips:');
      options.helpfulTips.forEach(tip => {
        responseParts.push(`• ${tip}`);
      });
      responseParts.push('');
    }
    
    // Add related tools
    if (options.relatedTools?.length) {
      responseParts.push('Related tools:');
      options.relatedTools.forEach(tool => {
        responseParts.push(`• ${tool}`);
      });
      responseParts.push('');
    }
    
    // Add examples if provided
    if (options.examples?.length) {
      responseParts.push('Examples:');
      options.examples.forEach((example, idx) => {
        responseParts.push(`Example ${idx + 1}:`);
        responseParts.push(typeof example === 'string' ? example : JSON.stringify(example, null, 2));
        responseParts.push('');
      });
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: responseParts.join('\n')
    }],
    isError: options.isError
  };
}

/**
 * Format an error response
 */
export function formatErrorResponse(
  error: any,
  tool: string
) {
  const errorMessage = error instanceof Error 
    ? error.message 
    : (typeof error === 'string' ? error : 'Unknown error');
  
  const errorCode = error instanceof Error && 'code' in error 
    ? (error as any).code 
    : 'ERROR';
  
  const errorData = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage
    }
  };
  
  // Add helpful tips based on error type
  const helpfulTips = [];
  const relatedTools = [];
  
  if (errorCode === 'NOT_FOUND' && errorMessage.includes('Board')) {
    helpfulTips.push('Check that you\'re using the correct board ID');
    relatedTools.push('get-boards - List all available boards');
    relatedTools.push('create-board - Create a new board');
  } else if (errorCode === 'NOT_FOUND' && errorMessage.includes('Card')) {
    helpfulTips.push('Check that you\'re using the correct card ID');
    relatedTools.push('get-board - Get board details including all cards');
  } else if (errorCode === 'VALIDATION_ERROR') {
    helpfulTips.push('Check the parameters you provided');
  }
  
  return formatResponse(errorData, {
    tool,
    helpfulTips,
    relatedTools,
    isError: true
  });
}
```

### 6.4 Tool Registration with Service Injection

**`server/mcp/tools/boards.ts`:**
```typescript
import { z } from 'zod';
import { ServiceFactory } from '@core/services';
import { boardSchemas } from '@core/schemas';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { registerRequestContext, clearRequestContext } from '../utils/requestContext';

/**
 * Register board-related MCP tools
 */
export function registerBoardTools(server: any, serviceFactory: ServiceFactory) {
  const boardService = serviceFactory.getBoardService();
  
  // List all boards
  server.tool(
    'get-boards',
    {},
    async () => {
      const context = registerRequestContext('get-boards');
      
      try {
        const boards = await boardService.getBoards();
        
        // Format for display
        if (boards.length === 0) {
          return formatResponse(
            'No boards found. Create a new board with the create-board tool.',
            {
              tool: 'get-boards',
              relatedTools: ['create-board - Create a new board']
            }
          );
        }
        
        let formattedOutput = '';
        boards.forEach((board, index) => {
          const date = new Date(board.lastUpdated);
          const month = date.toLocaleString('en-US', { month: 'short' });
          const day = date.getDate();
          const time = date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }).toLowerCase();

          const formattedDate = `${month} ${day} - ${time}`;
          formattedOutput += `${index + 1}) ${board.name}\n(${board.id})\n${formattedDate}\n\n`;
        });
        
        return formatResponse(formattedOutput, {
          tool: 'get-boards',
          helpfulTips: [
            'Use get-board with a board ID to view details',
            'Create a new board with create-board'
          ],
          relatedTools: [
            'get-board - Get a specific board by ID',
            'create-board - Create a new board',
            'delete-board - Delete a board'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-boards');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves a list of all available Kanban boards, showing board names, IDs, and last updated timestamps.'
  );
  
  // Create a new board
  server.tool(
    'create-board',
    {
      name: z.string().min(1, 'Board name is required').describe('The name for the new Kanban board')
    },
    async ({ name }) => {
      const context = registerRequestContext('create-board', { name });
      
      try {
        const board = await boardService.createBoardFromTemplate(name);
        
        // Format response with helpful information
        const response = {
          success: true,
          message: `Board "${name}" created successfully with ID: ${board.id}`,
          board: {
            id: board.id,
            name: board.projectName,
            lastUpdated: board.last_updated
          },
          // Add guidance information
          tips: {
            // Column information for reference
            columns: board.columns.map(column => ({
              id: column.id,
              name: column.name
            })),
            // Usage instructions
            usage: [
              `Use get-board with ID "${board.id}" to retrieve the full board`,
              `Use get-board with ID "${board.id}" and format "cards-only" to get just the cards`,
              `Use batch-cards with boardId "${board.id}" to create multiple cards at once`
            ],
            // Example of a valid card
            exampleCard: {
              title: "Example Card Title",
              content: "Markdown content for card description",
              columnId: board.columns[0].id,
              subtasks: ["Task One", "✓ Completed Task"],
              tags: ["example", "tag"]
            }
          }
        };
        
        return formatResponse(response, {
          tool: 'create-board',
          helpfulTips: [
            `Use get-board with ID "${board.id}" to view your new board`
          ],
          relatedTools: [
            'get-board - View the board you just created',
            'batch-cards - Add cards to your board',
            'get-boards - List all boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'create-board');
      } finally {
        clearRequestContext();
      }
    },
    'Creates a new Kanban board using a predefined template, allowing you to customize the board name.'
  );
  
  // Get a board
  server.tool(
    'get-board',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to retrieve'),
      format: z.enum(['full', 'summary', 'compact', 'cards-only'])
        .optional()
        .default('full')
        .describe('Format of the board data to return: full (default), summary, compact, cards-only'),
      columnId: z.string().optional().describe('Optional column ID to filter cards by column')
    },
    async ({ boardId, format, columnId }) => {
      const context = registerRequestContext('get-board', { boardId, format, columnId });
      
      try {
        const board = await boardService.getBoard(boardId, { format, columnId });
        
        // Add helpful tips based on the format
        const helpfulTips = [];
        const relatedTools = [];
        
        if (format === 'full' || format === 'cards-only') {
          helpfulTips.push('Use batch-cards to add or update multiple cards at once');
          helpfulTips.push('Use update-card to modify a single card');
          helpfulTips.push('Use move-card to change a card\'s position or column');
          
          relatedTools.push('batch-cards - Add or update multiple cards at once');
          relatedTools.push('update-card - Modify a single card');
          relatedTools.push('move-card - Change a card\'s position or column');
        }
        
        if (format === 'summary') {
          helpfulTips.push('Use format="full" to see all board details');
          helpfulTips.push('Use format="cards-only" to see just the cards');
        }
        
        return formatResponse(board, {
          tool: 'get-board',
          helpfulTips,
          relatedTools
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-board');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves a board by ID with options for different output formats (full, summary, compact, cards-only).'
  );
  
  // Update a board
  server.tool(
    'update-board',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to update'),
      boardData: z.union([
        z.string().describe('Board data as a JSON string'),
        z.object({}).passthrough().describe('Board data as an object')
      ]).describe('Board data to update. Can be a JSON string or an object.')
    },
    async ({ boardId, boardData }) => {
      const context = registerRequestContext('update-board', { boardId });
      
      try {
        // Parse the board data if it's a string
        const parsedData = typeof boardData === 'string'
          ? JSON.parse(boardData)
          : boardData;
        
        // Update the board
        const updatedBoard = await boardService.updateBoard(boardId, parsedData);
        
        return formatResponse({
          success: true,
          message: `Board ${boardId} updated successfully`,
          boardId: updatedBoard.id,
          lastUpdated: updatedBoard.last_updated
        }, {
          tool: 'update-board',
          helpfulTips: [
            'Use get-board to see the updated board'
          ],
          relatedTools: [
            'get-board - View the updated board',
            'batch-cards - Add or update cards',
            'get-boards - List all boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'update-board');
      } finally {
        clearRequestContext();
      }
    },
    'Updates an existing board with new data. Supports partial updates.'
  );
  
  // Delete a board
  server.tool(
    'delete-board',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to delete')
    },
    async ({ boardId }) => {
      const context = registerRequestContext('delete-board', { boardId });
      
      try {
        await boardService.deleteBoard(boardId);
        
        return formatResponse({
          success: true,
          message: `Board ${boardId} deleted successfully`
        }, {
          tool: 'delete-board',
          helpfulTips: [
            'You can create a new board with create-board'
          ],
          relatedTools: [
            'create-board - Create a new board',
            'get-boards - List all boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'delete-board');
      } finally {
        clearRequestContext();
      }
    },
    'Permanently deletes a board by ID. This action cannot be undone.'
  );
  
  // Import a board
  server.tool(
    'import-board',
    {
      boardData: z.union([
        z.string().describe('Board data as a JSON string'),
        z.object({}).passthrough().describe('Board data as an object')
      ]).describe('Board data to import. Must include columns and can include cards.')
    },
    async ({ boardData }) => {
      const context = registerRequestContext('import-board');
      
      try {
        // Parse the board data if it's a string
        const parsedData = typeof boardData === 'string'
          ? JSON.parse(boardData)
          : boardData;
        
        // Import the board
        const board = await boardService.importBoard(parsedData);
        
        return formatResponse({
          success: true,
          message: `Board imported successfully with ID: ${board.id}`,
          boardId: board.id,
          boardName: board.projectName
        }, {
          tool: 'import-board',
          helpfulTips: [
            `Use get-board with ID "${board.id}" to view your imported board`
          ],
          relatedTools: [
            'get-board - View the imported board',
            'get-boards - List all boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'import-board');
      } finally {
        clearRequestContext();
      }
    },
    'Imports a board from provided data. The data must include columns and can include cards.'
  );
  
  // Archive a board
  server.tool(
    'archive-board',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to archive')
    },
    async ({ boardId }) => {
      const context = registerRequestContext('archive-board', { boardId });
      
      try {
        const archivedBoard = await boardService.archiveBoard(boardId);
        
        return formatResponse({
          success: true,
          message: `Board ${boardId} archived successfully`,
          boardId: archivedBoard.id,
          boardName: archivedBoard.projectName,
          archivedAt: archivedBoard.archivedAt
        }, {
          tool: 'archive-board',
          helpfulTips: [
            'Use get-archived-boards to see all archived boards',
            'Use restore-board to restore an archived board'
          ],
          relatedTools: [
            'get-archived-boards - List all archived boards',
            'restore-board - Restore an archived board',
            'get-boards - List all active boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'archive-board');
      } finally {
        clearRequestContext();
      }
    },
    'Archives a board by ID, removing it from the active boards list but preserving it for later restoration.'
  );
  
  // Get archived boards
  server.tool(
    'get-archived-boards',
    {},
    async () => {
      const context = registerRequestContext('get-archived-boards');
      
      try {
        const archivedBoards = await boardService.getArchivedBoards();
        
        // Format for display
        if (archivedBoards.length === 0) {
          return formatResponse(
            'No archived boards found.',
            {
              tool: 'get-archived-boards',
              relatedTools: ['get-boards - List all active boards']
            }
          );
        }
        
        let formattedOutput = '';
        archivedBoards.forEach((board, index) => {
          const archiveDate = new Date(board.archivedAt);
          const archiveMonth = archiveDate.toLocaleString('en-US', { month: 'short' });
          const archiveDay = archiveDate.getDate();
          
          formattedOutput += `${index + 1}) ${board.projectName}\n`;
          formattedOutput += `ID: ${board.id}\n`;
          formattedOutput += `Archived: ${archiveMonth} ${archiveDay}\n\n`;
        });
        
        return formatResponse(formattedOutput, {
          tool: 'get-archived-boards',
          helpfulTips: [
            'Use restore-board with a board ID to restore an archived board'
          ],
          relatedTools: [
            'restore-board - Restore an archived board',
            'get-boards - List all active boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-archived-boards');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves a list of all archived boards that can be restored.'
  );
  
  // Restore an archived board
  server.tool(
    'restore-board',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the archived board to restore')
    },
    async ({ boardId }) => {
      const context = registerRequestContext('restore-board', { boardId });
      
      try {
        const restoredBoard = await boardService.restoreBoard(boardId);
        
        return formatResponse({
          success: true,
          message: `Board ${boardId} restored successfully`,
          boardId: restoredBoard.id,
          boardName: restoredBoard.projectName
        }, {
          tool: 'restore-board',
          helpfulTips: [
            `Use get-board with ID "${restoredBoard.id}" to view the restored board`
          ],
          relatedTools: [
            'get-board - View the restored board',
            'get-boards - List all active boards',
            'get-archived-boards - List all archived boards'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'restore-board');
      } finally {
        clearRequestContext();
      }
    },
    'Restores an archived board, making it available in the active boards list again.'
  );
}
```

### 6.5 Card Tools Registration

**`server/mcp/tools/cards.ts`:**
```typescript
import { z } from 'zod';
import { ServiceFactory } from '@core/services';
import { cardSchemas, operationsSchema } from '@core/schemas';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { registerRequestContext, clearRequestContext } from '../utils/requestContext';

/**
 * Register card-related MCP tools
 */
export function registerCardTools(server: any, serviceFactory: ServiceFactory) {
  const cardService = serviceFactory.getCardService();
  
  // Get a card
  server.tool(
    'get-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to retrieve')
    },
    async ({ boardId, cardId }) => {
      const context = registerRequestContext('get-card', { boardId, cardId });
      
      try {
        const card = await cardService.getCard(boardId, cardId);
        
        return formatResponse(card, {
          tool: 'get-card',
          helpfulTips: [
            'Use update-card to modify this card',
            'Use move-card to change the card\'s position or column'
          ],
          relatedTools: [
            'update-card - Modify card properties',
            'move-card - Change card position or column',
            'get-board - View the entire board'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-card');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves a specific card by its ID from a given board.'
  );
  
  // Update a card
  server.tool(
    'update-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to update'),
      cardData: z.union([
        z.string().describe('Card data as a JSON string'),
        z.object({}).passthrough().describe('Card data as an object')
      ]).describe('Card data to update. Can be a JSON string or an object.')
    },
    async ({ boardId, cardId, cardData }) => {
      const context = registerRequestContext('update-card', { boardId, cardId });
      
      try {
        // Parse the card data if it's a string
        const parsedData = typeof cardData === 'string'
          ? JSON.parse(cardData)
          : cardData;
        
        // Update the card
        const updatedCard = await cardService.updateCard(boardId, cardId, parsedData);
        
        return formatResponse({
          success: true,
          message: `Card ${cardId} updated successfully`,
          card: updatedCard
        }, {
          tool: 'update-card',
          helpfulTips: [
            'Use get-card to view the updated card',
            'Use move-card to change the card\'s position or column'
          ],
          relatedTools: [
            'get-card - View the updated card',
            'move-card - Change card position or column',
            'get-board - View the entire board'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'update-card');
      } finally {
        clearRequestContext();
      }
    },
    'Updates a card\'s properties such as title, content, tags, etc.'
  );
  
  // Move a card
  server.tool(
    'move-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to move'),
      columnId: z.string().min(1, 'Target column ID is required').describe('Unique identifier of the destination column'),
      position: z.union([
        z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
        z.enum(['first', 'last', 'up', 'down'])
      ]).describe('Position within the column. Can be a number, "first", "last", "up", or "down"')
    },
    async ({ boardId, cardId, columnId, position }) => {
      const context = registerRequestContext('move-card', { boardId, cardId, columnId, position });
      
      try {
        const movedCard = await cardService.moveCard(boardId, cardId, columnId, position);
        
        return formatResponse({
          success: true,
          message: `Card ${cardId} moved successfully`,
          card: movedCard
        }, {
          tool: 'move-card',
          helpfulTips: [
            'Use get-board to see the updated board with the moved card'
          ],
          relatedTools: [
            'get-card - View the moved card',
            'update-card - Modify card properties',
            'get-board - View the entire board'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'move-card');
      } finally {
        clearRequestContext();
      }
    },
    'Moves a card to a different position within the same column or to a different column.'
  );
  
  // Batch card operations
  server.tool(
    'batch-cards',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to perform batch operations'),
      operations: z.array(operationsSchema.cardOperationSchema)
        .min(1, 'At least one operation is required')
        .max(100, 'Maximum 100 operations allowed')
        .describe('Array of card operations to perform atomically')
    },
    async ({ boardId, operations }) => {
      const context = registerRequestContext('batch-cards', { boardId, operationCount: operations.length });
      
      try {
        const result = await cardService.batchOperations(boardId, operations);
        
        // Add helpful examples and context about how to reference newly created cards
        const examples = [];
        
        if (result.newCards.length > 0 && result.referenceMap) {
          // Example of referencing a newly created card
          const refExample = {
            operations: [
              {
                type: 'create',
                reference: 'task1',
                cardData: {
                  title: 'Task 1',
                  content: 'First task to complete'
                }
              },
              {
                type: 'create', 
                reference: 'task2',
                cardData: {
                  title: 'Task 2',
                  content: 'Second task to complete',
                  dependencies: ['$ref:task1'] // Reference to first card
                }
              }
            ]
          };
          
          examples.push(refExample);
        }
        
        return formatResponse({
          success: result.success,
          results: result.results,
          newCards: result.newCards,
          referenceMap: result.referenceMap
        }, {
          tool: 'batch-cards',
          helpfulTips: [
            'You can reference newly created cards with $ref:reference_id',
            'Batch operations are executed in order',
            'All operations in a batch occur atomically',
            'Use get-board to see the updated board'
          ],
          relatedTools: [
            'get-board - View the entire board with changes',
            'get-card - View a specific card',
            'update-card - Update a single card'
          ],
          examples
        });
      } catch (error) {
        return formatErrorResponse(error, 'batch-cards');
      } finally {
        clearRequestContext();
      }
    },
    'Performs multiple card operations (create, update, move) in a single atomic transaction.'
  );
  
  // Create a card (simplified wrapper around batch-cards)
  server.tool(
    'create-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to add the card to'),
      columnId: z.string().min(1, 'Column ID is required').describe('Unique identifier of the column to add the card to'),
      title: z.string().min(1, 'Card title is required').describe('Title of the card'),
      content: z.string().optional().describe('Markdown content for the card description'),
      position: z.union([
        z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
        z.enum(['first', 'last'])
      ]).optional().default('last').describe('Position within the column. Can be a number, "first", or "last"')
    },
    async ({ boardId, columnId, title, content, position }) => {
      const context = registerRequestContext('create-card', { boardId, columnId });
      
      try {
        // Create card data
        const cardData = {
          title,
          columnId,
          ...(content !== undefined ? { content } : {})
        };
        
        // Create the card
        const newCard = await cardService.createCard(boardId, cardData, position);
        
        return formatResponse({
          success: true,
          message: 'Card created successfully',
          card: newCard
        }, {
          tool: 'create-card',
          helpfulTips: [
            'Use get-board to see the updated board with your new card',
            'Use update-card to modify the card further',
            'For multiple cards, use batch-cards instead'
          ],
          relatedTools: [
            'get-card - View the created card',
            'update-card - Modify card properties',
            'batch-cards - Create multiple cards at once'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'create-card');
      } finally {
        clearRequestContext();
      }
    },
    'Creates a new card on the specified board and column. A simplified alternative to batch-cards.'
  );
  
  // Delete a card
  server.tool(
    'delete-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to delete')
    },
    async ({ boardId, cardId }) => {
      const context = registerRequestContext('delete-card', { boardId, cardId });
      
      try {
        await cardService.deleteCard(boardId, cardId);
        
        return formatResponse({
          success: true,
          message: `Card ${cardId} deleted successfully`
        }, {
          tool: 'delete-card',
          helpfulTips: [
            'Use get-board to see the updated board without the deleted card',
            'Use batch-cards to delete multiple cards at once'
          ],
          relatedTools: [
            'get-board - View the entire board',
            'batch-cards - Perform multiple card operations',
            'create-card - Create a new card'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'delete-card');
      } finally {
        clearRequestContext();
      }
    },
    'Permanently deletes a card from a board. This action cannot be undone.'
  );
}
```


### 6.7 Config, Webhook, and Server Tools

**`server/mcp/tools/config.ts`:**
```typescript
import { z } from 'zod';
import { ServiceFactory } from '@core/services';
import { configSchemas } from '@core/schemas';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { registerRequestContext, clearRequestContext } from '../utils/requestContext';

/**
 * Register configuration-related MCP tools
 */
export function registerConfigTools(server: any, serviceFactory: ServiceFactory) {
  const configService = serviceFactory.getConfigService();
  
  // Get configuration
  server.tool(
    'get-config',
    {},
    async () => {
      const context = registerRequestContext('get-config');
      
      try {
        const config = await configService.getConfig();
        
        // Remove sensitive information
        const safeConfig = {
          ...config,
          // Remove any sensitive fields here
        };
        
        return formatResponse(safeConfig, {
          tool: 'get-config',
          helpfulTips: [
            'Use update-config to modify configuration settings',
            'Configuration affects all board operations'
          ],
          relatedTools: [
            'update-config - Modify configuration settings',
            'reset-config - Reset to default configuration'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-config');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves the current application configuration.'
  );
  
  // Update configuration
  server.tool(
    'update-config',
    {
      config: z.union([
        z.string().describe('Configuration data as a JSON string'),
        z.object({}).passthrough().describe('Configuration data as an object')
      ]).describe('Configuration data to update. Can be a JSON string or an object.')
    },
    async ({ config: configData }) => {
      const context = registerRequestContext('update-config');
      
      try {
        // Parse the configuration data if it's a string
        const parsedData = typeof configData === 'string'
          ? JSON.parse(configData)
          : configData;
        
        // Update the configuration
        const updatedConfig = await configService.updateConfig(parsedData);
        
        // Remove sensitive information
        const safeConfig = {
          ...updatedConfig,
          // Remove any sensitive fields here
        };
        
        return formatResponse({
          success: true,
          message: 'Configuration updated successfully',
          config: safeConfig
        }, {
          tool: 'update-config',
          helpfulTips: [
            'Configuration changes take effect immediately',
            'Use get-config to view the current configuration'
          ],
          relatedTools: [
            'get-config - View the current configuration',
            'reset-config - Reset to default configuration'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'update-config');
      } finally {
        clearRequestContext();
      }
    },
    'Updates the application configuration with new settings.'
  );
  
  // Reset configuration
  server.tool(
    'reset-config',
    {},
    async () => {
      const context = registerRequestContext('reset-config');
      
      try {
        const defaultConfig = await configService.resetConfig();
        
        // Remove sensitive information
        const safeConfig = {
          ...defaultConfig,
          // Remove any sensitive fields here
        };
        
        return formatResponse({
          success: true,
          message: 'Configuration reset to defaults',
          config: safeConfig
        }, {
          tool: 'reset-config',
          helpfulTips: [
            'Default configuration has been restored',
            'Use get-config to view the current configuration'
          ],
          relatedTools: [
            'get-config - View the current configuration',
            'update-config - Modify configuration settings'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'reset-config');
      } finally {
        clearRequestContext();
      }
    },
    'Resets the application configuration to default values.'
  );
}
```

**`server/mcp/tools/webhooks.ts`:**
```typescript
import { z } from 'zod';
import { ServiceFactory } from '@core/services';
import { webhookSchemas } from '@core/schemas';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { registerRequestContext, clearRequestContext } from '../utils/requestContext';

/**
 * Register webhook-related MCP tools
 */
export function registerWebhookTools(server: any, serviceFactory: ServiceFactory) {
  const webhookService = serviceFactory.getWebhookService();
  
  // Get all webhooks
  server.tool(
    'get-webhooks',
    {},
    async () => {
      const context = registerRequestContext('get-webhooks');
      
      try {
        const webhooks = await webhookService.getWebhooks();
        
        // Format for display
        if (webhooks.length === 0) {
          return formatResponse(
            'No webhooks found. Create a new webhook with the create-webhook tool.',
            {
              tool: 'get-webhooks',
              relatedTools: ['create-webhook - Create a new webhook']
            }
          );
        }
        
        return formatResponse(webhooks, {
          tool: 'get-webhooks',
          helpfulTips: [
            'Use create-webhook to add a new webhook',
            'Use update-webhook to modify an existing webhook',
            'Use delete-webhook to remove a webhook'
          ],
          relatedTools: [
            'create-webhook - Create a new webhook',
            'update-webhook - Modify an existing webhook',
            'delete-webhook - Delete a webhook',
            'test-webhook - Test a webhook'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-webhooks');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves a list of all configured webhooks.'
  );
  
  // Create a webhook
  server.tool(
    'create-webhook',
    {
      name: z.string().min(1, 'Webhook name is required').describe('Display name for the webhook'),
      url: z.string().url('Invalid URL format').describe('URL to send webhook payload to'),
      event: webhookSchemas.webhookEventTypeSchema.describe('Event type to trigger the webhook'),
      secret: z.string().optional().describe('Secret key for webhook signature validation')
    },
    async ({ name, url, event, secret }) => {
      const context = registerRequestContext('create-webhook');
      
      try {
        const webhook = await webhookService.createWebhook({
          name,
          url,
          event,
          secret
        });
        
        return formatResponse({
          success: true,
          message: `Webhook "${name}" created successfully`,
          webhook: {
            id: webhook.id,
            name: webhook.name,
            url: webhook.url,
            event: webhook.event,
            active: webhook.active
          }
        }, {
          tool: 'create-webhook',
          helpfulTips: [
            'Webhooks are triggered automatically on specified events',
            'Use test-webhook to verify your webhook is working'
          ],
          relatedTools: [
            'test-webhook - Test the webhook',
            'get-webhooks - List all webhooks',
            'update-webhook - Modify the webhook'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'create-webhook');
      } finally {
        clearRequestContext();
      }
    },
    'Creates a new webhook that will be triggered on specified events.'
  );
  
  // Get a webhook
  server.tool(
    'get-webhook',
    {
      webhookId: z.string().min(1, 'Webhook ID is required').describe('Unique identifier of the webhook to retrieve')
    },
    async ({ webhookId }) => {
      const context = registerRequestContext('get-webhook', { webhookId });
      
      try {
        const webhook = await webhookService.getWebhook(webhookId);
        
        // Remove sensitive information
        const safeWebhook = {
          ...webhook,
          secret: webhook.secret ? '••••••••' : undefined
        };
        
        return formatResponse(safeWebhook, {
          tool: 'get-webhook',
          helpfulTips: [
            'Use update-webhook to modify this webhook',
            'Use test-webhook to verify the webhook is working'
          ],
          relatedTools: [
            'update-webhook - Modify the webhook',
            'test-webhook - Test the webhook',
            'delete-webhook - Delete the webhook'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'get-webhook');
      } finally {
        clearRequestContext();
      }
    },
    'Retrieves details about a specific webhook by ID.'
  );
  
  // Update a webhook
  server.tool(
    'update-webhook',
    {
      webhookId: z.string().min(1, 'Webhook ID is required').describe('Unique identifier of the webhook to update'),
      webhook: z.union([
        z.string().describe('Webhook data as a JSON string'),
        z.object({}).passthrough().describe('Webhook data as an object')
      ]).describe('Webhook data to update. Can be a JSON string or an object.')
    },
    async ({ webhookId, webhook: webhookData }) => {
      const context = registerRequestContext('update-webhook', { webhookId });
      
      try {
        // Parse the webhook data if it's a string
        const parsedData = typeof webhookData === 'string'
          ? JSON.parse(webhookData)
          : webhookData;
        
        // Update the webhook
        const updatedWebhook = await webhookService.updateWebhook(webhookId, parsedData);
        
        // Remove sensitive information
        const safeWebhook = {
          ...updatedWebhook,
          secret: updatedWebhook.secret ? '••••••••' : undefined
        };
        
        return formatResponse({
          success: true,
          message: `Webhook ${webhookId} updated successfully`,
          webhook: safeWebhook
        }, {
          tool: 'update-webhook',
          helpfulTips: [
            'Use test-webhook to verify the updated webhook is working',
            'Set active to false to temporarily disable a webhook'
          ],
          relatedTools: [
            'test-webhook - Test the webhook',
            'get-webhook - View the webhook details',
            'delete-webhook - Delete the webhook'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'update-webhook');
      } finally {
        clearRequestContext();
      }
    },
    'Updates an existing webhook with new settings.'
  );
  
  // Delete a webhook
  server.tool(
    'delete-webhook',
    {
      webhookId: z.string().min(1, 'Webhook ID is required').describe('Unique identifier of the webhook to delete')
    },
    async ({ webhookId }) => {
      const context = registerRequestContext('delete-webhook', { webhookId });
      
      try {
        await webhookService.deleteWebhook(webhookId);
        
        return formatResponse({
          success: true,
          message: `Webhook ${webhookId} deleted successfully`
        }, {
          tool: 'delete-webhook',
          helpfulTips: [
            'You can create a new webhook with create-webhook'
          ],
          relatedTools: [
            'create-webhook - Create a new webhook',
            'get-webhooks - List all webhooks'
          ]
        });
      } catch (error) {
        return formatErrorResponse(error, 'delete-webhook');
      } finally {
        clearRequestContext();
      }
    },
    'Permanently deletes a webhook by ID. This action cannot be undone.'
  );
  
  // Test a webhook
  server.tool(
    'test-webhook',
    {
      webhookId: z.string().min(1, 'Webhook ID is required').describe('Unique identifier of the webhook to test')
    },
    async ({ webhookId }) => {
      const context = registerRequestContext('test-webhook', { webhookId });
      
      try {
        // Get the webhook
        const webhook = await webhookService.getWebhook(webhookId);
        
        // Create test payload
        const payload = {
          event: 'webhook.test',
          timestamp: new Date().toISOString(),
          webhook: {
            id: webhook.id,
            name: webhook.name,
            event: webhook.event
          },
          data: {
            message: 'This is a test webhook from TaskBoardAI',
            source: 'MCP'
          }
        };
        
        // Trigger the webhook
        const result = await webhookService.triggerWebhook(webhookId, payload);
        
        if (result.success) {
          return formatResponse({
            success: true,
            message: 'Webhook test completed successfully',
            statusCode: result.statusCode,
            details: result.message
          }, {
            tool: 'test-webhook',
            helpfulTips: [
              'The webhook was delivered successfully',
              'Check your webhook endpoint logs for details about the received payload'
            ],
            relatedTools: [
              'get-webhook - View the webhook details',
              'update-webhook - Modify the webhook'
            ]
          });
        } else {
          return formatResponse({
            success: false,
            message: 'Webhook test failed',
            statusCode: result.statusCode,
            details: result.message
          }, {
            tool: 'test-webhook',
            helpfulTips: [
              'Check that the webhook URL is correct and accessible',
              'Verify that your webhook endpoint is accepting POST requests',
              'Ensure your webhook endpoint returns a 2xx status code'
            ],
            relatedTools: [
              'update-webhook - Modify the webhook URL',
              'get-webhook - View the webhook details'
            ]
          });
        }
      } catch (error) {
        return formatErrorResponse(error, 'test-webhook');
      } finally {
        clearRequestContext();
      }
    },
    'Tests a webhook by sending a test payload to its configured URL.'
  );
  
  // Test a webhook URL
  server.tool(
    'test-webhook-url',
    {
      url: z.string().url('Invalid URL format').describe('URL to test webhook delivery to')
    },
    async ({ url }) => {
      const context = registerRequestContext('test-webhook-url');
      
      try {
        // Test the connection
        const result = await webhookService.testConnection(url);
        
        if (result.success) {
          return formatResponse({
            success: true,
            message: 'Webhook URL test completed successfully',
            statusCode: result.statusCode,
            details: result.message
          }, {
            tool: 'test-webhook-url',
            helpfulTips: [
              'The webhook URL is accessible and accepting requests',
              'You can use this URL to create a new webhook'
            ],
            relatedTools: [
              'create-webhook - Create a new webhook with this URL'
            ]
          });
        } else {
          return formatResponse({
            success: false,
            message: 'Webhook URL test failed',
            statusCode: result.statusCode,
            details: result.message
          }, {
            tool: 'test-webhook-url',
            helpfulTips: [
              'Check that the URL is correct and accessible',
              'Verify that the endpoint is accepting POST requests',
              'Ensure the endpoint returns a 2xx status code'
            ]
          });
        }
      } catch (error) {
        return formatErrorResponse(error, 'test-webhook-url');
      } finally {
        clearRequestContext();
      }
    },
    'Tests a webhook URL by sending a test payload to it without creating a webhook.'
  );
}
```

**`server/mcp/tools/server.ts`:**
```typescript
import { z } from 'zod';
import { ServiceFactory } from '@core/services';
import { formatResponse, formatErrorResponse } from '../utils/responseFormatter';
import { registerRequestContext, clearRequestContext } from '../utils/requestContext';

/**
 * Register server control MCP tools
 */
export function registerServerTools(server: any, serviceFactory: ServiceFactory) {
  const serverService = serviceFactory.getServerService();
  
  // Start web server
  server.tool(
    'start-webserver',
    {
      port: z.number()
        .int('Port must be an integer')
        .min(1024, 'Port must be at least 1024')
        .max(65535, 'Port must be at most 65535')
        .optional()
        .default(3001)
        .describe('Port number to start the web server on'),
      
      timeout: z.number()
        .int('Timeout must be an integer')
        .min(500, 'Timeout must be at least 500ms')
        .max(10000, 'Timeout cannot exceed 10 seconds')
        .optional()
        .default(2000)
        .describe('Timeout in milliseconds to wait for server startup')
    },
    async ({ port, timeout }) => {
      const context = registerRequestContext('start-webserver', { port, timeout });
      
      try {
        const result = await serverService.startWebServer({ port, timeout });
        
        if (result.success) {
          return formatResponse({
            success: true,
            message: `Kanban web server started on port ${result.port}`,
            url: `http://localhost:${result.port}`
          }, {
            tool: 'start-webserver',
            helpfulTips: [
              `Access the web UI at http://localhost:${result.port}`,
              'Use check-webserver to verify server status'
            ],
            relatedTools: [
              'check-webserver - Check if the server is running'
            ]
          });
        } else {
          return formatResponse({
            success: false,
            message: result.message,
            port: result.port
          }, {
            tool: 'start-webserver',
            helpfulTips: [
              'Try a different port number',
              'Use check-webserver to verify server status'
            ],
            relatedTools: [
              'check-webserver - Check if the server is running'
            ]
          });
        }
      } catch (error) {
        return formatErrorResponse(error, 'start-webserver');
      } finally {
        clearRequestContext();
      }
    },
    'Starts the Kanban web server on a specified port (default 3001).'
  );
  
  // Check web server status
  server.tool(
    'check-webserver',
    {
      port: z.number()
        .int('Port must be an integer')
        .min(1024, 'Port must be at least 1024')
        .max(65535, 'Port must be at most 65535')
        .optional()
        .default(3001)
        .describe('Port number to check')
    },
    async ({ port }) => {
      const context = registerRequestContext('check-webserver', { port });
      
      try {
        const result = await serverService.checkWebServer({ port });
        
        if (result.running) {
          return formatResponse({
            running: true,
            port: result.port,
            message: `Kanban web server is running on port ${result.port}`,
            url: `http://localhost:${result.port}`
          }, {
            tool: 'check-webserver',
            helpfulTips: [
              `Access the web UI at http://localhost:${result.port}`
            ]
          });
        } else {
          return formatResponse({
            running: false,
            port: result.port,
            message: `No server detected on port ${result.port}`
          }, {
            tool: 'check-webserver',
            helpfulTips: [
              'Use start-webserver to start the server'
            ],
            relatedTools: [
              'start-webserver - Start the web server'
            ]
          });
        }
      } catch (error) {
        return formatErrorResponse(error, 'check-webserver');
      } finally {
        clearRequestContext();
      }
    },
    'Checks if the Kanban web server is running on a specified port (default 3001).'
  );
}
```

## Expected Outcome
- Complete MCP interface using the new service layer
- Consistent error handling across all tools
- Helpful contextual information in responses
- Better documentation and examples
- Entity referencing system for batch operations
- Improved logging and telemetry
- Clear separation of concerns