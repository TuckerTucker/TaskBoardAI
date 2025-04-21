/**
 * @jest-environment node
 */

// Mock the MCP SDK classes before importing the server
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  const toolsMap = {};
  
  return {
    McpServer: jest.fn().mockImplementation(() => {
      return {
        name: 'kanban',
        version: '1.0.0',
        tool: jest.fn().mockImplementation((name, schema, handler) => {
          toolsMap[name] = { schema, handler };
        }),
        connect: jest.fn().mockResolvedValue(undefined)
      };
    }),
    __getToolsMap: () => toolsMap
  };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});

// Now import the server after mocks are set up
require('../../../server/mcp/kanbanMcpServer');
const { __getToolsMap } = require('@modelcontextprotocol/sdk/server/mcp.js');
const Board = require('../../../server/models/Board');
const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../../../server/config/config');

// Mock node:child_process and node:net for start-webserver
jest.mock('node:child_process', () => {
  return {
    spawn: jest.fn().mockImplementation(() => {
      return {
        unref: jest.fn(),
        exitCode: null
      };
    })
  };
});

jest.mock('node:net', () => {
  return {
    createServer: jest.fn().mockImplementation(() => {
      return {
        once: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'listening') {
            setTimeout(callback, 0);
          }
          return this;
        }),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn()
      };
    })
  };
});

// Create in-memory file system for tests
const inMemoryFiles = {};
// Pre-populate with the example template content for create-board tests
const exampleTemplatePath = path.join(__dirname, '../../../server/config/_kanban_example.json');
const exampleTemplateContent = `{
  "projectName": "Project Example",
  "id": "template-id-should-be-replaced",
  "columns": [
    { "id": "col-template-1", "name": "To Do" },
    { "id": "col-template-2", "name": "In Progress" },
    { "id": "col-template-3", "name": "Done" },
    { "id": "col-template-4", "name": "Blocked" }
  ],
  "cards": [
    { "id": "card-template-1", "title": "Feature One", "content": "Desc 1", "columnId": "col-template-1", "position": 0, "dependencies": ["card-template-2"] },
    { "id": "card-template-2", "title": "Feature Two", "content": "Desc 2", "columnId": "col-template-2", "position": 0, "dependencies": [] },
    { "id": "card-template-3", "title": "Completed Feature", "content": "Desc 3", "columnId": "col-template-3", "position": 0, "dependencies": [], "completed_at": "2024-01-01T00:00:00Z" },
    { "id": "card-template-4", "title": "Example Blocked Feature", "content": "Desc 4", "columnId": "col-template-4", "position": 0, "dependencies": ["card-template-2"], "blocked_at": "2024-01-01T00:00:00Z" }
  ],
  "next-steps": ["Step 1", "Step 2"],
  "last_updated": "2024-01-01T00:00:00Z"
}`;
inMemoryFiles[exampleTemplatePath] = exampleTemplateContent;


// Custom mock for fs to simulate file operations without touching the disk
jest.mock('node:fs', () => {
  // Synchronous methods
  const existsSync = jest.fn().mockImplementation((filepath) => {
    return Object.prototype.hasOwnProperty.call(inMemoryFiles, filepath);
  });
  
  const mkdirSync = jest.fn().mockImplementation((dirpath, options) => {
    inMemoryFiles[dirpath] = 'directory';
    return undefined;
  });
  
  const copyFileSync = jest.fn().mockImplementation((src, dest) => {
    if (inMemoryFiles[src]) {
      inMemoryFiles[dest] = inMemoryFiles[src];
    }
    return undefined;
  });
  
  return {
    // Async methods
    promises: {
      readFile: jest.fn().mockImplementation(async (filepath, encoding) => {
        if (inMemoryFiles[filepath]) {
          return inMemoryFiles[filepath];
        }
        const error = new Error(`ENOENT: no such file or directory, open '${filepath}'`);
        error.code = 'ENOENT';
        throw error;
      }),
      writeFile: jest.fn().mockImplementation(async (filepath, content) => {
        inMemoryFiles[filepath] = content;
        return undefined;
      }),
      unlink: jest.fn().mockImplementation(async (filepath) => {
        delete inMemoryFiles[filepath];
        return undefined;
      }),
      access: jest.fn().mockImplementation(async (filepath) => {
        if (inMemoryFiles[filepath]) {
          return undefined;
        }
        const error = new Error(`ENOENT: no such file or directory, access '${filepath}'`);
        error.code = 'ENOENT';
        throw error;
      }),
      mkdir: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([])
    },
    // Sync methods
    existsSync,
    mkdirSync,
    copyFileSync,
    constants: {
      F_OK: 0,
      R_OK: 4,
      W_OK: 2,
      X_OK: 1
    }
  };
});

describe('MCP Server Integration', () => {
  let tools;
  
  beforeAll(() => {
    // Get the tools using our special method from the mock
    tools = __getToolsMap();
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear in-memory files
    Object.keys(inMemoryFiles).forEach(key => delete inMemoryFiles[key]);
  });
  
  // Test end-to-end board creation, retrieval, update, and deletion workflow
  describe('Board Lifecycle', () => {
    // Re-enable this test
    it('should support full board lifecycle operations using template', async () => {
      // --- Create a board (should use template) ---
      const createParams = { name: 'Integration Test Board' };
      const createResult = await tools['create-board'].handler(createParams);
      const createdBoard = JSON.parse(createResult.content[0].text);

      // Basic checks
      expect(createdBoard).toHaveProperty('id');
      expect(createdBoard.id).not.toBe('template-id-should-be-replaced'); // Ensure ID was replaced
      expect(createdBoard).toHaveProperty('projectName', 'Integration Test Board'); // Ensure name was set

      // Template structure checks
      expect(createdBoard.columns).toHaveLength(4);
      expect(createdBoard.columns.map(c => c.name)).toEqual(["To Do", "In Progress", "Done", "Blocked"]);
      expect(createdBoard.columns[0].id).not.toBe('col-template-1'); // Ensure column IDs were replaced

      expect(createdBoard.cards).toHaveLength(4);
      expect(createdBoard.cards.map(c => c.title)).toEqual(["Feature One", "Feature Two", "Completed Feature", "Example Blocked Feature"]);
      expect(createdBoard.cards[0].id).not.toBe('card-template-1'); // Ensure card IDs were replaced
      expect(createdBoard.cards[0].columnId).toBe(createdBoard.columns[0].id); // Check if columnId reference was updated
      expect(createdBoard.cards[0].dependencies[0]).toBe(createdBoard.cards[1].id); // Check if dependency reference was updated
      expect(createdBoard.cards[2]).not.toHaveProperty('completed_at'); // Ensure status timestamp removed
      expect(createdBoard.cards[3]).not.toHaveProperty('blocked_at'); // Ensure status timestamp removed
      expect(createdBoard).toHaveProperty('next-steps');

      const boardId = createdBoard.id;

      // --- Get the boards list to verify it appears ---
      const listResult = await tools['get-boards'].handler({});
      const boardsList = JSON.parse(listResult.content[0].text);
      
      // Find our board in the list
      const listedBoard = boardsList.find(board => board.id === boardId);
      expect(listedBoard).toBeDefined();
      expect(listedBoard).toHaveProperty('name', 'Integration Test Board');
      
      // --- Get the board by ID ---
      const getResult = await tools['get-board'].handler({ boardId });
      const retrievedBoard = JSON.parse(getResult.content[0].text);
      expect(retrievedBoard).toHaveProperty('id', boardId);
      expect(retrievedBoard).toHaveProperty('projectName', 'Integration Test Board');
      expect(retrievedBoard.columns).toHaveLength(4); // Still has template columns
      expect(retrievedBoard.cards).toHaveLength(4); // Still has template cards

      // --- Update the board (replace columns/cards entirely) ---
      const newColId = crypto.randomUUID();
      const newCardId = crypto.randomUUID();
      const updatedBoardData = {
        ...retrievedBoard, // Keep ID and other top-level fields
        projectName: 'Updated Integration Test Board',
        columns: [ // Completely new columns
          { id: newColId, name: 'New Column', position: 0 }
        ],
        cards: [ // Completely new card
          {
            id: newCardId,
            title: 'New Test Task',
            content: 'This is a new test task',
            columnId: newColId, // Reference the new column
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        last_updated: new Date().toISOString() // Update timestamp
      };

      const updateResult = await tools['update-board'].handler({
        boardData: JSON.stringify(updatedBoardData)
      });
      expect(JSON.parse(updateResult.content[0].text)).toHaveProperty('success', true);

      // --- Get the updated board to verify changes ---
      const getUpdatedResult = await tools['get-board'].handler({ boardId });
      const updatedRetrievedBoard = JSON.parse(getUpdatedResult.content[0].text);
      expect(updatedRetrievedBoard).toHaveProperty('projectName', 'Updated Integration Test Board');
      expect(updatedRetrievedBoard.columns).toHaveLength(1); // Should only have the new column
      expect(updatedRetrievedBoard.columns[0].id).toBe(newColId);
      expect(updatedRetrievedBoard.cards).toHaveLength(1); // Should only have the new card
      expect(updatedRetrievedBoard.cards[0].id).toBe(newCardId);
      expect(updatedRetrievedBoard.cards[0].columnId).toBe(newColId);

      // --- Delete the board ---
      const deleteResult = await tools['delete-board'].handler({ boardId });
      expect(JSON.parse(deleteResult.content[0].text)).toHaveProperty('success', true);
      
      // Verify the board is gone
      const finalListResult = await tools['get-boards'].handler({});
      const finalBoardsList = JSON.parse(finalListResult.content[0].text);
      const deletedBoard = finalBoardsList.find(board => board.id === boardId);
      expect(deletedBoard).toBeUndefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle retrieving a non-existent board', async () => {
      const result = await tools['get-board'].handler({ boardId: 'non-existent-id' });
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should handle updating a non-existent board', async () => {
      const boardData = {
        id: '12345678-1234-1234-1234-123456789012', // Valid UUID but doesn't exist
        projectName: 'Non-existent Board',
        columns: []
      };
      
      const result = await tools['update-board'].handler({ 
        boardData: JSON.stringify(boardData) 
      });
      
      expect(result).toHaveProperty('isError', true);
      // The error can be either "not found" or something about board ID format depending on validation order
      expect(result.content[0].text).toMatch(/Error: (Board.*not found|Invalid board)/);
    });
    
    it('should handle deleting a non-existent board', async () => {
      const result = await tools['delete-board'].handler({ 
        boardId: '12345678-1234-1234-1234-123456789012' // Valid UUID but doesn't exist
      });
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('not found');
    });
  });
  
  describe('Input Validation', () => {
    it('should reject board update with invalid JSON', async () => {
      const result = await tools['update-board'].handler({ 
        boardData: 'not-valid-json' 
      });
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('Invalid JSON format');
    });
    
    it('should reject board update without ID', async () => {
      const result = await tools['update-board'].handler({ 
        boardData: JSON.stringify({ projectName: 'No ID Board' }) 
      });
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('Board ID is required');
    });
    
    it('should reject board update with invalid ID format', async () => {
      const result = await tools['update-board'].handler({ 
        boardData: JSON.stringify({ 
          id: 'not-a-valid-uuid', 
          projectName: 'Invalid ID Board' 
        }) 
      });
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('Invalid board ID format');
    });
  });

  // --- batch-cards Tool Tests ---
  describe('batch-cards Tool', () => {
    let testBoardId;
    const col1Id = 'col-todo';
    const col2Id = 'col-done';

    // Helper to create a basic board for testing batch operations
    const setupTestBoard = async () => {
      const createResult = await tools['create-board'].handler({ name: 'Batch Test Board' });
      const boardData = JSON.parse(createResult.content[0].text);
      testBoardId = boardData.id;

      // Add columns directly for simplicity in testing batch
      boardData.columns = [
        { id: col1Id, name: 'To Do', position: 0 },
        { id: col2Id, name: 'Done', position: 1 }
      ];
      boardData.cards = []; // Start with no cards

      // Save the initial board state using the mock fs
      const boardPath = path.join(config.boardsDir, `${testBoardId}.json`);
      await fs.promises.writeFile(boardPath, JSON.stringify(boardData, null, 2));
      return boardData;
    };

    beforeEach(async () => {
      await setupTestBoard();
    });

    it('should create a single card', async () => {
      const operations = [
        {
          type: 'create',
          columnId: col1Id,
          cardData: JSON.stringify({ title: 'New Card 1', content: 'Content 1' }),
          position: 'first' // or 0
        }
      ];
      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData.success).toBe(true);
      expect(resultData.results).toHaveLength(1);
      expect(resultData.results[0].type).toBe('create');
      expect(resultData.results[0].success).toBe(true);
      const newCardId = resultData.results[0].cardId;

      // Verify board state
      const getResult = await tools['get-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      expect(board.cards).toHaveLength(1);
      expect(board.cards[0].id).toBe(newCardId);
      expect(board.cards[0].title).toBe('New Card 1');
      expect(board.cards[0].columnId).toBe(col1Id);
      expect(board.cards[0].position).toBe(0);
    });

    it('should create multiple cards with references', async () => {
      const operations = [
        { 
          type: 'create', 
          columnId: col1Id, 
          cardData: JSON.stringify({ title: 'Card A' }), 
          position: 0,
          reference: 'cardA'
        },
        { 
          type: 'create', 
          columnId: col1Id, 
          cardData: JSON.stringify({ title: 'Card B' }), 
          position: 1,
          reference: 'cardB'
        },
        { 
          type: 'create', 
          columnId: col2Id, 
          cardData: JSON.stringify({ title: 'Card C' }), 
          position: 'last',
          reference: 'cardC'
        }
      ];
      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData.success).toBe(true);
      expect(resultData.results).toHaveLength(3);
      expect(resultData.referenceMap).toBeDefined();
      expect(Object.keys(resultData.referenceMap)).toEqual(['cardA', 'cardB', 'cardC']);

      // Verify board state
      const getResult = await tools['get-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      expect(board.cards).toHaveLength(3);
      const cardA = board.cards.find(c => c.title === 'Card A');
      const cardB = board.cards.find(c => c.title === 'Card B');
      const cardC = board.cards.find(c => c.title === 'Card C');

      expect(cardA.columnId).toBe(col1Id);
      expect(cardA.position).toBe(0);
      expect(cardB.columnId).toBe(col1Id);
      expect(cardB.position).toBe(1);
      expect(cardC.columnId).toBe(col2Id);
      expect(cardC.position).toBe(0);

      // Verify reference map matches actual card IDs
      expect(resultData.referenceMap.cardA).toBe(cardA.id);
      expect(resultData.referenceMap.cardB).toBe(cardB.id);
      expect(resultData.referenceMap.cardC).toBe(cardC.id);
    });

    it('should create and then move a card in the same batch using references', async () => {
      const operations = [
        { 
          type: 'create', 
          columnId: col1Id, 
          cardData: JSON.stringify({ title: 'Move Me' }), 
          position: 0,
          reference: 'newCard'
        },
        { 
          type: 'move', 
          cardId: '$ref:newCard', 
          columnId: col2Id, 
          position: 'first'
        }
      ];

      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData.success).toBe(true);
      expect(resultData.results).toHaveLength(2);
      expect(resultData.results[0].type).toBe('create');
      expect(resultData.results[1].type).toBe('move');

      // Verify final board state
      const getResult = await tools['get-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      expect(board.cards).toHaveLength(1);
      const movedCard = board.cards[0];
      expect(movedCard.title).toBe('Move Me');
      expect(movedCard.columnId).toBe(col2Id);
      expect(movedCard.position).toBe(0);
    });

    it('should create and then update a card in the same batch using references', async () => {
      const operations = [
        { 
          type: 'create', 
          columnId: col1Id, 
          cardData: JSON.stringify({ title: 'Update Me' }), 
          position: 0,
          reference: 'cardToUpdate'
        },
        { 
          type: 'update', 
          cardId: '$ref:cardToUpdate', 
          cardData: JSON.stringify({ title: 'Updated Title', content: 'New Content' })
        }
      ];

      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData.success).toBe(true);
      expect(resultData.results).toHaveLength(2);
      expect(resultData.results[0].type).toBe('create');
      expect(resultData.results[1].type).toBe('update');

      // Verify final board state
      const getResult = await tools['get-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      expect(board.cards).toHaveLength(1);
      const updatedCard = board.cards[0];
      expect(updatedCard.title).toBe('Updated Title');
      expect(updatedCard.content).toBe('New Content');
      expect(updatedCard.columnId).toBe(col1Id);
    });

    it('should handle partial failures in batch operations', async () => {
      const operations = [
        { 
          type: 'create', 
          columnId: col1Id, 
          cardData: JSON.stringify({ title: 'Valid Card' }), 
          reference: 'validCard'
        },
        { 
          type: 'create', 
          columnId: 'invalid-column', // Invalid column ID
          cardData: JSON.stringify({ title: 'Invalid Card' })
        },
        { 
          type: 'update', 
          cardId: '$ref:validCard', 
          cardData: JSON.stringify({ title: 'Updated Valid Card' })
        }
      ];

      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData.success).toBe(false); // Overall failure due to partial error
      expect(resultData.results).toHaveLength(3);
      
      // First operation should succeed
      expect(resultData.results[0].success).toBe(true);
      expect(resultData.results[0].type).toBe('create');
      
      // Second operation should fail
      expect(resultData.results[1].success).toBe(false);
      expect(resultData.results[1].error).toContain('Target column invalid-column does not exist');
      
      // Third operation should still succeed
      expect(resultData.results[2].success).toBe(true);
      expect(resultData.results[2].type).toBe('update');

      // Verify board state - only valid operations should be applied
      const getResult = await tools['batch-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      expect(board.cards).toHaveLength(1);
      expect(board.cards[0].title).toBe('Updated Valid Card');
    });

    it('should handle position calculations consistently between single and batch operations', async () => {
      // First create cards using single operations
      const createCard1 = await tools['update-card'].handler({
        boardId: testBoardId,
        cardData: JSON.stringify({ title: 'Card 1' }),
        columnId: col1Id,
        position: 0
      });
      const createCard2 = await tools['update-card'].handler({
        boardId: testBoardId,
        cardData: JSON.stringify({ title: 'Card 2' }),
        columnId: col1Id,
        position: 1
      });

      // Then move cards using batch operations
      const batchOps = [
        {
          type: 'move',
          cardId: createCard1.id,
          columnId: col1Id,
          position: 'up'
        },
        {
          type: 'move',
          cardId: createCard2.id,
          columnId: col2Id,
          position: 'first'
        }
      ];

      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations: batchOps });
      const resultData = JSON.parse(result.content[0].text);

      expect(resultData.success).toBe(true);
      expect(resultData.results).toHaveLength(2);

      // Verify positions match expected behavior
      const getResult = await tools['get-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      
      const card1 = board.cards.find(c => c.id === createCard1.id);
      const card2 = board.cards.find(c => c.id === createCard2.id);

      expect(card1.position).toBe(0); // Should stay at 0 since already at top
      expect(card1.columnId).toBe(col1Id);
      expect(card2.position).toBe(0); // Should be at position 0 in new column
      expect(card2.columnId).toBe(col2Id);
    });

    it('should handle mixed create, update, and move operations', async () => {
       // Setup: Create initial cards to update/move
       const initialOps = [
         { type: 'create', columnId: col1Id, cardData: JSON.stringify({ title: 'Card To Update' }), position: 0 },
         { type: 'create', columnId: col1Id, cardData: JSON.stringify({ title: 'Card To Move' }), position: 1 },
       ];
       const initialResult = await tools['batch-cards'].handler({ boardId: testBoardId, operations: initialOps });
       const initialResultData = JSON.parse(initialResult.content[0].text);
       const cardToUpdateId = initialResultData.results.find(r => r.type === 'create' && JSON.parse(initialOps[0].cardData).title === 'Card To Update').cardId;
       const cardToMoveId = initialResultData.results.find(r => r.type === 'create' && JSON.parse(initialOps[1].cardData).title === 'Card To Move').cardId;


       // Mixed batch
       const mixedOps = [
         { type: 'create', columnId: col2Id, cardData: JSON.stringify({ title: 'New Card In Done' }), position: 0 },
         { type: 'update', cardId: cardToUpdateId, cardData: JSON.stringify({ title: 'UPDATED Card' }) },
         { type: 'move', cardId: cardToMoveId, columnId: col2Id, position: 'last' } // Move to end of col2
       ];
       const mixedResult = await tools['batch-cards'].handler({ boardId: testBoardId, operations: mixedOps });
       const mixedResultData = JSON.parse(mixedResult.content[0].text);

       expect(mixedResultData.success).toBe(true);
       expect(mixedResultData.results).toHaveLength(3);
       expect(mixedResultData.results.some(r => r.type === 'create')).toBe(true);
       expect(mixedResultData.results.some(r => r.type === 'update')).toBe(true);
       expect(mixedResultData.results.some(r => r.type === 'move')).toBe(true);

       // Verify final state
       const getResult = await tools['get-board'].handler({ boardId: testBoardId });
       const board = JSON.parse(getResult.content[0].text);
       expect(board.cards).toHaveLength(3); // 2 initial + 1 new

       const updatedCard = board.cards.find(c => c.id === cardToUpdateId);
       const movedCard = board.cards.find(c => c.id === cardToMoveId);
       const newCard = board.cards.find(c => c.title === 'New Card In Done');

       expect(updatedCard.title).toBe('UPDATED Card');
       expect(updatedCard.columnId).toBe(col1Id); // Still in original column
       expect(updatedCard.position).toBe(0); // Should remain at pos 0 in col1

       expect(movedCard.columnId).toBe(col2Id);
       expect(movedCard.position).toBe(1); // Moved to last (pos 1) in col2 after the new card

       expect(newCard.columnId).toBe(col2Id);
       expect(newCard.position).toBe(0); // Created at pos 0 in col2
     });

    it('should return error if creating card without cardData', async () => {
      const operations = [{ type: 'create', columnId: col1Id }];
      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("cardData and columnId are required for 'create'");
    });

     it('should return error if creating card without columnId', async () => {
      const operations = [{ type: 'create', cardData: JSON.stringify({ title: 'No Column' }) }];
      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("cardData and columnId are required for 'create'");
    });

    it('should return error if creating card in non-existent column', async () => {
      const operations = [{ type: 'create', columnId: 'non-existent-col', cardData: JSON.stringify({ title: 'Bad Column' }) }];
      const result = await tools['batch-cards'].handler({ boardId: testBoardId, operations });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Target column non-existent-col does not exist");
    });

    it('should allow creating cards without column name in cardData', async () => {
      // Test single operation
      const singleOp = {
        type: 'create',
        columnId: col1Id,
        cardData: JSON.stringify({ 
          title: 'Card without column name',
          content: 'This card has no column name in its data'
        })
      };
      const singleResult = await tools['batch-cards'].handler({ 
        boardId: testBoardId, 
        operations: [singleOp] 
      });
      const singleResultData = JSON.parse(singleResult.content[0].text);
      expect(singleResultData.success).toBe(true);

      // Test batch operation
      const batchOps = [
        {
          type: 'create',
          columnId: col1Id,
          cardData: JSON.stringify({ 
            title: 'First card no column name'
          }),
          reference: 'card1'
        },
        {
          type: 'create',
          columnId: col2Id,
          cardData: JSON.stringify({ 
            title: 'Second card no column name',
            content: 'Some content'
          })
        }
      ];
      const batchResult = await tools['batch-cards'].handler({ 
        boardId: testBoardId, 
        operations: batchOps 
      });
      const batchResultData = JSON.parse(batchResult.content[0].text);
      expect(batchResultData.success).toBe(true);
      expect(batchResultData.results.every(r => r.success)).toBe(true);

      // Verify final state
      const getResult = await tools['get-board'].handler({ boardId: testBoardId });
      const board = JSON.parse(getResult.content[0].text);
      expect(board.cards).toHaveLength(3); // All cards should be created successfully

      // Verify cards are in correct columns despite no column name in data
      const cardsInCol1 = board.cards.filter(c => c.columnId === col1Id);
      const cardsInCol2 = board.cards.filter(c => c.columnId === col2Id);
      expect(cardsInCol1).toHaveLength(2);
      expect(cardsInCol2).toHaveLength(1);
    });
  });
});
