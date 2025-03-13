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

// Custom mock for fs to simulate file operations without touching the disk
jest.mock('node:fs', () => {
  return {
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
    it('should support full board lifecycle operations', async () => {
      // Create a board
      const createParams = { name: 'Integration Test Board' };
      const createResult = await tools['create-board'].handler(createParams);
      
      // Extract board ID from the JSON string in the response
      const createdBoard = JSON.parse(createResult.content[0].text);
      expect(createdBoard).toHaveProperty('id');
      expect(createdBoard).toHaveProperty('name', 'Integration Test Board');
      
      const boardId = createdBoard.id;
      
      // Get the boards list to verify it appears
      const listResult = await tools['get-boards'].handler({});
      const boardsList = JSON.parse(listResult.content[0].text);
      
      // Find our board in the list
      const listedBoard = boardsList.find(board => board.id === boardId);
      expect(listedBoard).toBeDefined();
      expect(listedBoard).toHaveProperty('name', 'Integration Test Board');
      
      // Get the board by ID
      const getResult = await tools['get-board'].handler({ boardId });
      const retrievedBoard = JSON.parse(getResult.content[0].text);
      expect(retrievedBoard).toHaveProperty('id', boardId);
      expect(retrievedBoard).toHaveProperty('projectName', 'Integration Test Board');
      
      // Update the board
      const updatedBoardData = {
        ...retrievedBoard,
        projectName: 'Updated Integration Test Board',
        columns: [
          {
            id: 'col1',
            name: 'To Do',
            items: [
              {
                id: 'item1',
                title: 'Test Task',
                content: 'This is a test task'
              }
            ]
          }
        ]
      };
      
      const updateResult = await tools['update-board'].handler({ 
        boardData: JSON.stringify(updatedBoardData) 
      });
      expect(updateResult.content[0].text).toContain('success');
      
      // Get the updated board to verify changes
      const getUpdatedResult = await tools['get-board'].handler({ boardId });
      const updatedRetrievedBoard = JSON.parse(getUpdatedResult.content[0].text);
      expect(updatedRetrievedBoard).toHaveProperty('projectName', 'Updated Integration Test Board');
      expect(updatedRetrievedBoard.columns).toHaveLength(1);
      expect(updatedRetrievedBoard.columns[0].items).toHaveLength(1);
      
      // Delete the board
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
});