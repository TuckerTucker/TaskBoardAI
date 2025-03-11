#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const Board = require('../models/Board');
const { z } = require('zod');
const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../config/config');

// Global rate limiting
const rateLimits = {
  operations: new Map(), // Map to track operations per minute
  maxOperationsPerMinute: 60 // Maximum operations allowed per minute
};

// Rate limiting middleware
const checkRateLimit = () => {
  const now = Date.now();
  const minute = Math.floor(now / 60000); // Current minute
  
  // Clean up old entries
  for (const [key, timestamp] of rateLimits.operations.entries()) {
    if (Math.floor(timestamp / 60000) < minute) {
      rateLimits.operations.delete(key);
    }
  }
  
  // Count operations in the current minute
  let count = 0;
  for (const timestamp of rateLimits.operations.values()) {
    if (Math.floor(timestamp / 60000) === minute) {
      count++;
    }
  }
  
  // Check if limit exceeded
  if (count >= rateLimits.maxOperationsPerMinute) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  // Record this operation
  const operationId = `op_${now}_${Math.random().toString(36).substring(2, 15)}`;
  rateLimits.operations.set(operationId, now);
};

// Create server instance
const server = new McpServer({
  name: "kanban",
  version: "1.0.0",
});

// Get all available boards
server.tool(
  'get-boards',
  {}, // No parameters needed
  async () => {
    try {
      const boards = await Board.list();
      return {
        content: [{ type: 'text', text: JSON.stringify(boards, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error listing boards: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Create a new board
server.tool(
  'create-board',
  { name: z.string().min(1, 'Board name is required') },
  async ({ name }) => {
    try {
      const board = await Board.create(name.trim());
      return {
        content: [{ type: 'text', text: JSON.stringify(board, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error creating board: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Get a specific board by ID
server.tool(
  'get-board',
  { boardId: z.string().min(1, 'Board ID is required') },
  async ({ boardId }) => {
    try {
      const board = await Board.load(boardId);
      return {
        content: [{ type: 'text', text: JSON.stringify(board.data, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error retrieving board: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Update an existing board
server.tool(
  'update-board',
  { boardData: z.string().min(1, 'Board data is required').max(1000000, 'Board data too large') },
  async ({ boardData }) => {
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(boardData);
      } catch (e) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid JSON format for board data' }],
          isError: true
        };
      }
      
      // Enforce that an ID is required for updates
      if (!parsedData.id) {
        return {
          content: [{ type: 'text', text: 'Error: Board ID is required when updating a board' }],
          isError: true
        };
      }
      
      // Validate ID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(parsedData.id)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid board ID format' }],
          isError: true
        };
      }
      
      // Create a backup of the existing board before updating
      let existingBoard;
      try {
        existingBoard = await Board.load(parsedData.id);
        const backupDir = path.join(config.boardsDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${parsedData.id}_${timestamp}.json`);
        await fs.writeFile(backupPath, JSON.stringify(existingBoard.data, null, 2));
      } catch (error) {
        if (error.message.includes('not found')) {
          return {
            content: [{ type: 'text', text: `Error: Board with ID ${parsedData.id} not found` }],
            isError: true
          };
        }
        console.error('Error creating backup:', error);
        throw error; // Re-throw other errors
      }
      
      // Preserve creation date and other metadata
      parsedData.created_at = existingBoard.data.created_at || new Date().toISOString();
      
      const board = new Board(parsedData);
      
      // Validate board data
      if (!board.validate()) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid board data format' }],
          isError: true
        };
      }
      
      // Check for reasonable limits
      if (parsedData.columns && parsedData.columns.length > 20) {
        return {
          content: [{ type: 'text', text: 'Error: Maximum number of columns (20) exceeded' }],
          isError: true
        };
      }
      
      let totalItems = 0;
      if (parsedData.columns) {
        for (const column of parsedData.columns) {
          if (column.items) {
            totalItems += column.items.length;
            if (totalItems > 1000) {
              return {
                content: [{ type: 'text', text: 'Error: Maximum number of items (1000) exceeded' }],
                isError: true
              };
            }
          }
        }
      }

      // Save board
      await board.save();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Board updated successfully' }) }]
      };
    } catch (error) {
      console.error('Error in update-board tool:', error);
      return {
        content: [{ type: 'text', text: `Error updating board: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Delete a board
server.tool(
  'delete-board',
  { boardId: z.string().min(1, 'Board ID is required').uuid('Invalid board ID format') },
  async ({ boardId }) => {
    try {
      // Create a backup before deletion
      try {
        const board = await Board.load(boardId);
        const backupDir = path.join(config.boardsDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_deletion.json`);
        await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));
      } catch (error) {
        // If the board doesn't exist, we can't back it up, but we should still try to delete it
        if (!error.message.includes('not found')) {
          console.error('Error creating backup before deletion:', error);
        }
      }
      
      const result = await Board.delete(boardId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }]
      };
    } catch (error) {
      console.error('Error in delete-board tool:', error);
      return {
        content: [{ type: 'text', text: `Error deleting board: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Start the Kanban web server
server.tool(
  'start-webserver',
  { port: z.number().int('Port must be an integer').min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535').optional().default(3001) },
  async ({ port }) => {
    try {
      // Import the Kanban server module
      const path = require('node:path');
      const { spawn } = require('node:child_process');
      const net = require('node:net');
      
      // Check if the port is already in use
      const isPortInUse = await new Promise((resolve) => {
        const tester = net.createServer()
          .once('error', () => resolve(true))
          .once('listening', () => {
            tester.once('close', () => resolve(false));
            tester.close();
          })
          .listen(port);
      });
      
      if (isPortInUse) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Port ${port} is already in use. Please specify a different port.` 
          }],
          isError: true
        };
      }
      
      // Path to the server.js file
      const serverPath = path.resolve(__dirname, '../server.js');
      
      // Start the server as a child process
      const serverProcess = spawn('node', [serverPath], {
        env: { ...process.env, PORT: port.toString() },
        detached: true,
        stdio: 'ignore'
      });
      
      // Unref the child process so it can run independently
      serverProcess.unref();
      
      // Wait a moment to see if the server crashes immediately
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if the process is still running
      if (serverProcess.exitCode !== null) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Server failed to start (exit code: ${serverProcess.exitCode})` 
          }],
          isError: true
        };
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `Kanban web server started on port ${port}. You can access it at http://localhost:${port}` 
        }]
      };
    } catch (error) {
      console.error('Error in start-webserver tool:', error);
      return {
        content: [{ type: 'text', text: `Error starting Kanban web server: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Start the server when this file is run directly
if (require.main === module) {
  // Create a stdio transport
  const transport = new StdioServerTransport();
  
  // Connect the server to the transport
  server.connect(transport).catch(error => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

module.exports = server;
