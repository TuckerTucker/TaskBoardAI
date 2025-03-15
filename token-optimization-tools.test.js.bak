/**
 * @jest-environment node
 */

// Mock the MCP SDK classes and Board before importing
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      const tools = {};
      
      return {
        name: 'TaskBoardAI',
        version: '1.0.0',
        tool: jest.fn((name, schema, handler) => {
          tools[name] = { schema, handler };
        }),
        connect: jest.fn().mockResolvedValue(undefined),
        getTools: () => tools
      };
    })
  };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});

// Mock the Board model with token-optimized methods
jest.mock('../../../server/models/Board', () => {
  // Create a mock board constructor that supports format transformers
  const mockBoard = jest.fn().mockImplementation((data) => {
    return {
      data: data || {},
      format: jest.fn((format, options) => {
        if (format === 'summary') {
          return {
            id: data.id,
            projectName: data.projectName,
            last_updated: data.last_updated,
            columns: (data.columns || []).map(col => ({
              id: col.id,
              name: col.name,
              cardCount: (data.cards || []).filter(card => card.columnId === col.id).length
            })),
            stats: {
              totalCards: (data.cards || []).length,
              completedCards: (data.cards || []).filter(card => card.completed_at).length,
              progressPercentage: (data.cards || []).length > 0 
                ? Math.round(((data.cards || []).filter(card => card.completed_at).length / (data.cards || []).length) * 100)
                : 0
            }
          };
        } else if (format === 'compact') {
          return {
            id: data.id,
            name: data.projectName,
            up: data.last_updated,
            cols: (data.columns || []).map(col => ({ id: col.id, n: col.name })),
            cards: (data.cards || []).map(card => ({
              id: card.id,
              t: card.title,
              col: card.columnId,
              p: card.position,
              ...(card.content ? { c: card.content } : {})
            }))
          };
        } else if (format === 'cards-only') {
          let filteredCards = data.cards || [];
          if (options && options.columnId) {
            filteredCards = filteredCards.filter(card => card.columnId === options.columnId);
          }
          return { cards: filteredCards };
        } else {
          // Default is full format
          return data;
        }
      }),
      save: jest.fn().mockResolvedValue(undefined),
      validate: jest.fn().mockReturnValue(true)
    };
  });
  
  // Add static methods to the mock
  mockBoard.load = jest.fn().mockImplementation(async (boardId) => {
    if (boardId === 'invalid-board') {
      throw new Error('Board not found');
    }
    
    // Create test data based on boardId
    let boardData;
    if (boardId === 'legacy-board') {
      // Legacy board with column-items structure
      boardData = {
        id: boardId,
        projectName: 'Legacy Test Board',
        columns: [
          { 
            id: 'col-1', 
            name: 'To Do',
            items: [{ id: 'item-1', title: 'Legacy Card' }]
          }
        ]
      };
    } else {
      // Card-first architecture board
      boardData = {
        id: boardId || 'default-board-id',
        projectName: 'Test Board',
        columns: [
          { id: 'col-1', name: 'To Do' },
          { id: 'col-2', name: 'In Progress' },
          { id: 'col-3', name: 'Done' }
        ],
        cards: [
          {
            id: 'card-1',
            title: 'Task 1',
            content: 'Card content',
            columnId: 'col-1',
            position: 0,
            updated_at: '2025-03-15T00:00:00Z'
          },
          {
            id: 'card-2',
            title: 'Task 2',
            content: 'Card content',
            columnId: 'col-2',
            position: 0,
            updated_at: '2025-03-15T00:00:00Z'
          },
          {
            id: 'card-3',
            title: 'Task 3',
            content: 'Card content',
            columnId: 'col-3',
            position: 0,
            completed_at: '2025-03-15T00:00:00Z',
            updated_at: '2025-03-15T00:00:00Z'
          }
        ]
      };
    }
    
    return mockBoard(boardData);
  });
  
  mockBoard.validateItem = jest.fn().mockImplementation((item) => {
    return item && item.id && item.title;
  });
  
  mockBoard.delete = jest.fn().mockImplementation(async (boardId) => {
    if (boardId === 'invalid-board') {
      throw new Error('Board not found');
    }
    return { success: true, message: 'Board deleted successfully' };
  });
  
  return mockBoard;
});

// Mock node:fs.promises
jest.mock('node:fs', () => {
  return {
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      access: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined)
    }
  };
});

// Import after mocking
const server = require('../../../server/mcp/kanbanMcpServer');
const Board = require('../../../server/models/Board');

describe('Token-Optimized MCP Tools', () => {
  let tools;
  
  beforeAll(() => {
    // Get the registered tools from the mocked server
    tools = server.getTools();
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('get-board with format parameter', () => {
    it('should retrieve a board in full format by default', async () => {
      const boardId = 'test-board-id';
      
      // Execute the handler
      const result = await tools['get-board'].handler({ boardId });
      
      // Verify the result and format parameter
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('full', {});
    });
    
    it('should retrieve a board in summary format when specified', async () => {
      const boardId = 'test-board-id';
      
      // Execute the handler with summary format
      const result = await tools['get-board'].handler({ 
        boardId, 
        format: 'summary' 
      });
      
      // Verify the result and format parameter
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('summary', {});
    });
    
    it('should retrieve a board in compact format when specified', async () => {
      const boardId = 'test-board-id';
      
      // Execute the handler with compact format
      const result = await tools['get-board'].handler({ 
        boardId, 
        format: 'compact' 
      });
      
      // Verify the result and format parameter
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('compact', {});
    });
    
    it('should retrieve cards from a specific column when using cards-only format with columnId', async () => {
      const boardId = 'test-board-id';
      const columnId = 'col-1';
      
      // Execute the handler with cards-only format and columnId
      const result = await tools['get-board'].handler({ 
        boardId, 
        format: 'cards-only',
        columnId
      });
      
      // Verify the result and format parameters
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('cards-only', { columnId });
    });
    
    it('should handle errors when retrieving a board', async () => {
      const boardId = 'invalid-board';
      
      // Execute the handler with an invalid board ID
      const result = await tools['get-board'].handler({ boardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Error retrieving board');
      expect(Board.load).toHaveBeenCalledWith(boardId);
    });
  });
  
  describe('get-card', () => {
    it('should retrieve a specific card by ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      
      // Execute the handler
      const result = await tools['get-card'].handler({ boardId, cardId });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned card data
      const returnedCard = JSON.parse(result.content[0].text);
      
      // Check card properties
      expect(returnedCard.id).toBe(cardId);
      expect(returnedCard.columnName).toBeDefined();
    });
    
    it('should handle non-existent card ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'non-existent-card';
      
      // Execute the handler
      const result = await tools['get-card'].handler({ boardId, cardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const cardId = 'item-1';
      
      // Execute the handler
      const result = await tools['get-card'].handler({ boardId, cardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not using card-first architecture');
    });
    
    it('should handle board loading errors', async () => {
      const boardId = 'invalid-board';
      const cardId = 'card-1';
      
      // Execute the handler
      const result = await tools['get-card'].handler({ boardId, cardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Error retrieving card');
    });
  });
  
  describe('update-card', () => {
    it('should update a card with valid data', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const cardData = JSON.stringify({
        title: 'Updated Title',
        content: 'Updated content'
      });
      
      // Execute the handler
      const result = await tools['update-card'].handler({ 
        boardId, 
        cardId, 
        cardData 
      });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned card data
      const updatedCard = JSON.parse(result.content[0].text);
      
      // Check updated properties
      expect(updatedCard.title).toBe('Updated Title');
      expect(updatedCard.content).toBe('Updated content');
      expect(updatedCard.columnName).toBeDefined();
      
      // Verify the board was saved
      const board = await Board.load(boardId);
      expect(board.save).toHaveBeenCalled();
    });
    
    it('should handle invalid JSON input', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const cardData = 'not valid JSON';
      
      // Execute the handler
      const result = await tools['update-card'].handler({ 
        boardId, 
        cardId, 
        cardData 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Invalid JSON format');
    });
    
    it('should reject non-existent card ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'non-existent-card';
      const cardData = JSON.stringify({
        title: 'Updated Title'
      });
      
      // Mock the card not found scenario
      const mockBoard = await Board.load(boardId);
      mockBoard.data.cards = mockBoard.data.cards.filter(card => card.id !== cardId);
      
      // Execute the handler
      const result = await tools['update-card'].handler({ 
        boardId, 
        cardId, 
        cardData 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject invalid column ID in card data', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const cardData = JSON.stringify({
        columnId: 'non-existent-column'
      });
      
      // Execute the handler
      const result = await tools['update-card'].handler({ 
        boardId, 
        cardId, 
        cardData 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Target column');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const cardId = 'item-1';
      const cardData = JSON.stringify({
        title: 'Updated Title'
      });
      
      // Execute the handler
      const result = await tools['update-card'].handler({ 
        boardId, 
        cardId, 
        cardData 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not using card-first architecture');
    });
  });
  
  describe('move-card', () => {
    it('should move a card to a different column with absolute position', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'col-2';
      const position = 0;
      
      // Execute the handler
      const result = await tools['move-card'].handler({ 
        boardId, 
        cardId, 
        columnId, 
        position 
      });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned data
      const response = JSON.parse(result.content[0].text);
      
      // Check response structure
      expect(response.success).toBeTruthy();
      expect(response.card).toBeDefined();
      expect(response.card.columnId).toBe(columnId);
      expect(response.card.position).toBe(position);
      
      // Verify the board was saved
      const board = await Board.load(boardId);
      expect(board.save).toHaveBeenCalled();
    });
    
    it('should move a card using relative position "first"', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'col-2';
      const position = 'first';
      
      // Execute the handler
      const result = await tools['move-card'].handler({ 
        boardId, 
        cardId, 
        columnId, 
        position 
      });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned data
      const response = JSON.parse(result.content[0].text);
      
      // Check response structure
      expect(response.success).toBeTruthy();
      expect(response.card.position).toBe(0); // "first" means position 0
    });
    
    it('should set completed_at when moving to Done column', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'col-3'; // Done column
      const position = 0;
      
      // Execute the handler
      const result = await tools['move-card'].handler({ 
        boardId, 
        cardId, 
        columnId, 
        position 
      });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned data
      const response = JSON.parse(result.content[0].text);
      
      // Check completed_at timestamp was set
      expect(response.card.completed_at).not.toBeNull();
    });
    
    it('should reject non-existent card ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'non-existent-card';
      const columnId = 'col-2';
      const position = 0;
      
      // Mock the card not found scenario
      const mockBoard = await Board.load(boardId);
      mockBoard.data.cards = mockBoard.data.cards.filter(card => card.id !== cardId);
      
      // Execute the handler
      const result = await tools['move-card'].handler({ 
        boardId, 
        cardId, 
        columnId, 
        position 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject non-existent column ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'non-existent-column';
      const position = 0;
      
      // Execute the handler
      const result = await tools['move-card'].handler({ 
        boardId, 
        cardId, 
        columnId, 
        position 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Target column');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const cardId = 'item-1';
      const columnId = 'col-1';
      const position = 0;
      
      // Execute the handler
      const result = await tools['move-card'].handler({ 
        boardId, 
        cardId, 
        columnId, 
        position 
      });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not using card-first architecture');
    });
  });
  
  describe('batch-cards', () => {
    it('should process multiple operations in a single transaction', async () => {
      const boardId = 'test-board-id';
      
      // Create operations
      const operations = [
        {
          type: 'update',
          cardId: 'card-1',
          cardData: JSON.stringify({
            title: 'Updated Title',
            content: 'Updated content'
          })
        },
        {
          type: 'move',
          cardId: 'card-2',
          columnId: 'col-3',
          position: 'first'
        }
      ];
      
      // Execute the handler
      const result = await tools['batch-cards'].handler({ boardId, operations });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned data
      const response = JSON.parse(result.content[0].text);
      
      // Check response structure
      expect(response.success).toBeTruthy();
      expect(response.results).toHaveLength(2);
      
      // Check update operation result
      const updateResult = response.results.find(r => r.type === 'update');
      expect(updateResult.cardId).toBe('card-1');
      expect(updateResult.success).toBeTruthy();
      
      // Check move operation result
      const moveResult = response.results.find(r => r.type === 'move');
      expect(moveResult.cardId).toBe('card-2');
      expect(moveResult.success).toBeTruthy();
      
      // Verify the board was saved once (transaction-like behavior)
      const board = await Board.load(boardId);
      expect(board.save).toHaveBeenCalledTimes(1);
    });
    
    it('should handle validation errors for update operations', async () => {
      const boardId = 'test-board-id';
      
      // Create operations with invalid JSON
      const operations = [
        {
          type: 'update',
          cardId: 'card-1',
          cardData: 'not valid JSON'
        }
      ];
      
      // Execute the handler
      const result = await tools['batch-cards'].handler({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Invalid JSON format');
    });
    
    it('should handle validation errors for move operations', async () => {
      const boardId = 'test-board-id';
      
      // Create operations with invalid column
      const operations = [
        {
          type: 'move',
          cardId: 'card-1',
          columnId: 'non-existent-column',
          position: 0
        }
      ];
      
      // Execute the handler
      const result = await tools['batch-cards'].handler({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Target column');
    });
    
    it('should handle non-existent card IDs', async () => {
      const boardId = 'test-board-id';
      
      // Create operations with non-existent card
      const operations = [
        {
          type: 'update',
          cardId: 'non-existent-card',
          cardData: JSON.stringify({
            title: 'Updated Title'
          })
        }
      ];
      
      // Mock the card not found scenario
      const mockBoard = await Board.load(boardId);
      mockBoard.data.cards = mockBoard.data.cards.filter(card => card.id !== 'non-existent-card');
      
      // Execute the handler
      const result = await tools['batch-cards'].handler({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      
      // Create operations
      const operations = [
        {
          type: 'update',
          cardId: 'item-1',
          cardData: JSON.stringify({
            title: 'Updated Title'
          })
        }
      ];
      
      // Execute the handler
      const result = await tools['batch-cards'].handler({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not using card-first architecture');
    });
    
    it('should validate required fields for operations', async () => {
      const boardId = 'test-board-id';
      
      const testCases = [
        // Update operation missing cardData
        {
          operations: [{ type: 'update', cardId: 'card-1' }],
          expectedError: 'cardData is required'
        },
        // Move operation missing columnId
        {
          operations: [{ type: 'move', cardId: 'card-1' }],
          expectedError: 'columnId is required'
        },
        // Move operation missing position
        {
          operations: [{ type: 'move', cardId: 'card-1', columnId: 'col-2' }],
          expectedError: 'position is required'
        }
      ];
      
      for (const testCase of testCases) {
        // Execute the handler
        const result = await tools['batch-cards'].handler({ 
          boardId, 
          operations: testCase.operations 
        });
        
        // Verify error response contains expected message
        expect(result.isError).toBeTruthy();
        expect(result.content[0].text).toContain(testCase.expectedError);
      }
    });
  });
});