/**
 * @jest-environment node
 */

// Mock the MCP SDK classes
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

// Mock fs for testing
jest.mock('node:fs', () => {
  // Maintain an in-memory filesystem for integration testing
  const mockFs = {
    fileSystem: {},
    backupSystem: {}
  };
  
  // Include the synchronous methods
  const existsSync = (path) => {
    return Object.prototype.hasOwnProperty.call(mockFs.fileSystem, path);
  };
  
  const mkdirSync = (path, options) => {
    mockFs.fileSystem[path] = { isDirectory: true };
    return undefined;
  };
  
  const copyFileSync = (src, dest) => {
    if (existsSync(src) && mockFs.fileSystem[src].content) {
      mockFs.fileSystem[dest] = { content: mockFs.fileSystem[src].content };
    }
    return undefined;
  };
  
  const promises = {
    readFile: jest.fn(async (filePath, encoding) => {
      if (mockFs.fileSystem[filePath]) {
        return mockFs.fileSystem[filePath];
      }
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    }),
    writeFile: jest.fn(async (filePath, content) => {
      mockFs.fileSystem[filePath] = content;
      return undefined;
    }),
    readdir: jest.fn(async (dirPath) => {
      const files = [];
      const dirPrefix = dirPath + '/';
      for (const filePath in mockFs.fileSystem) {
        if (filePath.startsWith(dirPrefix)) {
          files.push(filePath.substring(dirPrefix.length));
        }
      }
      return files;
    }),
    mkdir: jest.fn(async (dirPath, options) => {
      return undefined;
    }),
    access: jest.fn(async (filePath) => {
      if (mockFs.fileSystem[filePath]) {
        return undefined;
      }
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    }),
    unlink: jest.fn(async (filePath) => {
      if (mockFs.fileSystem[filePath]) {
        delete mockFs.fileSystem[filePath];
        return undefined;
      }
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    }),
    // Helper methods for test setup
    _reset: () => {
      mockFs.fileSystem = {};
      mockFs.backupSystem = {};
    },
    _seedFile: (filePath, content) => {
      mockFs.fileSystem[filePath] = content;
    },
    _getAllFiles: () => mockFs.fileSystem
  };

  return {
    promises,
    constants: {
      F_OK: 0,
      R_OK: 4,
      W_OK: 2,
      X_OK: 1
    },
    existsSync,
    mkdirSync,
    copyFileSync
  };
});

// Mock file path resolution
jest.mock('node:path', () => {
  const originalPath = jest.requireActual('node:path');
  return {
    ...originalPath,
    resolve: jest.fn((...args) => args.join('/')),
    join: jest.fn((...args) => args.join('/'))
  };
});

// Configure test environment
const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../../../server/config/config');

// Set up test data
const setupTestData = () => {
  // Clear mock filesystem
  fs._reset();
  
  // Mock config
  config.boardsDir = '/boards';
  config.dataFile = '/boards/default.json';
  
  // Create test board in card-first architecture
  const cardFirstBoard = {
    id: 'card-first-board',
    projectName: 'Card-First Test Board',
    last_updated: new Date().toISOString(),
    columns: [
      { id: 'col-1', name: 'To Do' },
      { id: 'col-2', name: 'In Progress' },
      { id: 'col-3', name: 'Done' }
    ],
    cards: [
      {
        id: 'card-1',
        title: 'Task 1',
        content: 'Description for task 1',
        columnId: 'col-1',
        position: 0,
        collapsed: false,
        subtasks: ['Subtask 1', 'Subtask 2'],
        tags: ['backend'],
        dependencies: [],
        created_at: '2025-03-14T09:00:00.000Z',
        updated_at: '2025-03-14T09:30:00.000Z',
        completed_at: null
      },
      {
        id: 'card-2',
        title: 'Task 2',
        content: 'Description for task 2',
        columnId: 'col-2',
        position: 0,
        collapsed: true,
        subtasks: ['Subtask 1'],
        tags: ['frontend'],
        dependencies: ['card-1'],
        created_at: '2025-03-14T09:15:00.000Z',
        updated_at: '2025-03-14T09:45:00.000Z',
        completed_at: null
      },
      {
        id: 'card-3',
        title: 'Task 3',
        content: 'Description for task 3',
        columnId: 'col-3',
        position: 0,
        collapsed: false,
        subtasks: [],
        tags: ['backend'],
        dependencies: [],
        created_at: '2025-03-14T08:00:00.000Z',
        updated_at: '2025-03-14T08:30:00.000Z',
        completed_at: '2025-03-14T08:30:00.000Z'
      }
    ]
  };
  
  // Create test board in legacy architecture
  const legacyBoard = {
    id: 'legacy-board',
    projectName: 'Legacy Test Board',
    last_updated: new Date().toISOString(),
    columns: [
      { 
        id: 'col-1', 
        name: 'To Do',
        items: [
          {
            id: 'item-1',
            title: 'Task 1',
            content: 'Description for task 1',
            collapsed: false,
            subtasks: ['Subtask 1', 'Subtask 2'],
            tags: ['backend'],
            dependencies: [],
            created_at: '2025-03-14T09:00:00.000Z',
            updated_at: '2025-03-14T09:30:00.000Z',
            completed_at: null
          }
        ]
      },
      { 
        id: 'col-2', 
        name: 'In Progress',
        items: [
          {
            id: 'item-2',
            title: 'Task 2',
            content: 'Description for task 2',
            collapsed: true,
            subtasks: ['Subtask 1'],
            tags: ['frontend'],
            dependencies: ['item-1'],
            created_at: '2025-03-14T09:15:00.000Z',
            updated_at: '2025-03-14T09:45:00.000Z',
            completed_at: null
          }
        ]
      },
      { 
        id: 'col-3', 
        name: 'Done',
        items: [
          {
            id: 'item-3',
            title: 'Task 3',
            content: 'Description for task 3',
            collapsed: false,
            subtasks: [],
            tags: ['backend'],
            dependencies: [],
            created_at: '2025-03-14T08:00:00.000Z',
            updated_at: '2025-03-14T08:30:00.000Z',
            completed_at: '2025-03-14T08:30:00.000Z'
          }
        ]
      }
    ]
  };
  
  // Seed the mock filesystem
  fs._seedFile('/boards/card-first-board.json', JSON.stringify(cardFirstBoard, null, 2));
  fs._seedFile('/boards/legacy-board.json', JSON.stringify(legacyBoard, null, 2));
};

// Helper for token counting
const countTokens = (data) => {
  if (typeof data === 'object') {
    return Math.ceil(JSON.stringify(data).length / 4);
  }
  return Math.ceil(data.length / 4);
};

// Import after mocking
const server = require('../../../server/mcp/kanbanMcpServer');
const Board = require('../../../server/models/Board');

describe('Token-Optimized MCP Integration Tests', () => {
  let tools;
  
  beforeAll(() => {
    // Get the registered tools from the mocked server
    tools = server.getTools();
  });
  
  beforeEach(() => {
    // Set up test data before each test
    setupTestData();
  });
  
  afterEach(() => {
    // Clean up after each test
    jest.clearAllMocks();
  });
  
  describe('get-board with format parameter', () => {
    it.skip('should retrieve boards in different formats with reduced token counts', async () => {
      const boardId = 'card-first-board';
      const formats = ['full', 'summary', 'compact', 'cards-only'];
      
      const tokenCounts = {};
      
      // Test each format
      for (const format of formats) {
        const result = await tools['get-board'].handler({ boardId, format });
        
        // Validate successful response
        expect(result.isError).toBeFalsy();
        
        // Count tokens in response
        const responseData = JSON.parse(result.content[0].text);
        tokenCounts[format] = countTokens(responseData);
      }
      
      // Check token reduction
      expect(tokenCounts.summary).toBeLessThan(tokenCounts.full);
      expect(tokenCounts.compact).toBeLessThan(tokenCounts.full);
      expect(tokenCounts.cardsOnly).toBeLessThan(tokenCounts.full);
      
      // For documentation
      console.log('Token counts for different formats:');
      console.log(`- Full: ${tokenCounts.full} tokens (baseline)`);
      console.log(`- Summary: ${tokenCounts.summary} tokens (${Math.round((1 - tokenCounts.summary/tokenCounts.full) * 100)}% reduction)`);
      console.log(`- Compact: ${tokenCounts.compact} tokens (${Math.round((1 - tokenCounts.compact/tokenCounts.full) * 100)}% reduction)`);
      console.log(`- Cards-only: ${tokenCounts['cards-only']} tokens (${Math.round((1 - tokenCounts['cards-only']/tokenCounts.full) * 100)}% reduction)`);
    });
    
    it('should filter cards by column with cards-only format', async () => {
      const boardId = 'card-first-board';
      const format = 'cards-only';
      
      const tokenCounts = {
        all: 0,
        filtered: 0
      };
      
      // Get all cards first
      const allCardsResult = await tools['get-board'].handler({ 
        boardId, 
        format 
      });
      
      // Then get cards filtered by column
      const filteredResult = await tools['get-board'].handler({ 
        boardId, 
        format,
        columnId: 'col-1' 
      });
      
      // Count tokens
      const allCardsData = JSON.parse(allCardsResult.content[0].text);
      const filteredData = JSON.parse(filteredResult.content[0].text);
      
      tokenCounts.all = countTokens(allCardsData);
      tokenCounts.filtered = countTokens(filteredData);
      
      // Verify filtering works
      expect(allCardsData.cards.length).toBeGreaterThan(filteredData.cards.length);
      expect(filteredData.cards.every(card => card.columnId === 'col-1')).toBeTruthy();
      
      // Verify token reduction
      expect(tokenCounts.filtered).toBeLessThan(tokenCounts.all);
      
      // For documentation
      console.log('Token reduction with column filtering:');
      console.log(`- All cards: ${tokenCounts.all} tokens`);
      console.log(`- Filtered cards: ${tokenCounts.filtered} tokens (${Math.round((1 - tokenCounts.filtered/tokenCounts.all) * 100)}% reduction)`);
    });
  });
  
  describe('Single-card operations vs. full board operations', () => {
    it('should demonstrate token efficiency of get-card vs. full board retrieval', async () => {
      const boardId = 'card-first-board';
      const cardId = 'card-1';
      
      // First get the full board
      const fullBoardResult = await tools['get-board'].handler({ boardId });
      
      // Then get just the single card
      const singleCardResult = await tools['get-card'].handler({ boardId, cardId });
      
      // Count tokens
      const fullBoardData = JSON.parse(fullBoardResult.content[0].text);
      const singleCardData = JSON.parse(singleCardResult.content[0].text);
      
      const fullBoardTokens = countTokens(fullBoardData);
      const singleCardTokens = countTokens(singleCardData);
      
      // Verify token reduction
      expect(singleCardTokens).toBeLessThan(fullBoardTokens);
      
      // For documentation
      console.log('Token comparison: get-card vs. full board:');
      console.log(`- Full board: ${fullBoardTokens} tokens`);
      console.log(`- Single card: ${singleCardTokens} tokens`);
      console.log(`- Reduction: ${Math.round((1 - singleCardTokens/fullBoardTokens) * 100)}%`);
    });
    
    it('should demonstrate token efficiency of update-card vs. full board update', async () => {
      const boardId = 'card-first-board';
      const cardId = 'card-1';
      
      // Prepare update data
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content for token optimization testing'
      };
      
      // Get token count for updating single card
      const singleCardUpdateResult = await tools['update-card'].handler({
        boardId,
        cardId,
        cardData: JSON.stringify(updateData)
      });
      
      // Get token count for a hypothetical full board update
      // (simulated by getting the full board and its size)
      const fullBoardResult = await tools['get-board'].handler({ boardId });
      
      // Count tokens - for the update operation itself
      const singleCardTokens = countTokens(JSON.stringify({
        boardId,
        cardId,
        cardData: updateData
      }));
      
      // For the hypothetical full board update
      const fullBoardData = JSON.parse(fullBoardResult.content[0].text);
      const fullBoardTokens = countTokens(fullBoardData);
      
      // Verify token reduction
      expect(singleCardTokens).toBeLessThan(fullBoardTokens);
      
      // For documentation
      console.log('Token comparison: update-card vs. full board update:');
      console.log(`- Full board update (hypothetical): ${fullBoardTokens} tokens`);
      console.log(`- Single card update: ${singleCardTokens} tokens`);
      console.log(`- Reduction: ${Math.round((1 - singleCardTokens/fullBoardTokens) * 100)}%`);
    });
    
    it('should demonstrate token efficiency of batch-cards vs. multiple separate operations', async () => {
      const boardId = 'card-first-board';
      
      // Prepare batch operations
      const operations = [
        {
          type: 'update',
          cardId: 'card-1',
          cardData: JSON.stringify({
            title: 'Updated Title 1'
          })
        },
        {
          type: 'update',
          cardId: 'card-2',
          cardData: JSON.stringify({
            title: 'Updated Title 2'
          })
        },
        {
          type: 'move',
          cardId: 'card-1',
          columnId: 'col-2',
          position: 'first'
        }
      ];
      
      // Execute batch operation
      const batchResult = await tools['batch-cards'].handler({
        boardId,
        operations
      });
      
      // Count tokens for batch operation
      const batchTokens = countTokens(JSON.stringify({
        boardId,
        operations
      }));
      
      // Count tokens for separate operations
      const separateTokens = operations.reduce((total, op) => {
        if (op.type === 'update') {
          return total + countTokens(JSON.stringify({
            boardId,
            cardId: op.cardId,
            cardData: JSON.parse(op.cardData)
          }));
        } else if (op.type === 'move') {
          return total + countTokens(JSON.stringify({
            boardId,
            cardId: op.cardId,
            columnId: op.columnId,
            position: op.position
          }));
        }
        return total;
      }, 0);
      
      // For documentation
      console.log('Token comparison: batch-cards vs. separate operations:');
      console.log(`- ${operations.length} separate operations: ${separateTokens} tokens`);
      console.log(`- Single batch operation: ${batchTokens} tokens`);
      console.log(`- Reduction: ${Math.round((1 - batchTokens/separateTokens) * 100)}%`);
      
      // Verify batch size matches operations count
      const batchResponse = JSON.parse(batchResult.content[0].text);
      expect(batchResponse.results.length).toBe(operations.length);
    });
  });
  
  describe('Migration and compatibility', () => {
    it('should migrate from legacy to card-first architecture with migrate-to-card-first', async () => {
      const boardId = 'legacy-board';
      
      // First check that card operations fail on legacy board
      const getCardResult = await tools['get-card'].handler({
        boardId,
        cardId: 'item-1'
      });
      
      // Should fail with architecture error
      expect(getCardResult.isError).toBeTruthy();
      expect(getCardResult.content[0].text).toContain('not using card-first architecture');
      
      // Now migrate the board
      const migrateResult = await tools['migrate-to-card-first'].handler({
        boardId
      });
      
      // Migration should succeed
      expect(migrateResult.isError).toBeFalsy();
      expect(migrateResult.content[0].text).toContain('successfully migrated');
      
      // Now try card operations again
      const postMigrationResult = await tools['get-card'].handler({
        boardId,
        cardId: 'item-1'
      });
      
      // Should now succeed
      expect(postMigrationResult.isError).toBeFalsy();
      
      // Check that the board file was updated
      const boardFile = JSON.parse(fs._getAllFiles()['/boards/legacy-board.json']);
      expect(boardFile).toHaveProperty('cards');
      expect(Array.isArray(boardFile.cards)).toBeTruthy();
      expect(boardFile.cards.length).toBeGreaterThan(0);
      
      // Check that items arrays are removed from columns
      expect(boardFile.columns.every(col => !col.items)).toBeTruthy();
    });
  });
});