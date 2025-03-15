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
  name: "TaskBoardAI",
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
  { 
    name: z.string().min(1, 'Board name is required'),
    template: z.enum(['empty', 'basic', 'full']).optional().default('basic')
  },
  async ({ name, template }) => {
    try {
      checkRateLimit();
      
      // Create the board with basic metadata
      const boardId = require('crypto').randomUUID();
      const columns = [];
      const cards = [];
      const now = new Date().toISOString();
      
      // Add columns based on template
      if (template === 'empty') {
        // No columns or cards - just the empty board
      } else {
        // Add default columns for basic and full templates
        const todoColumnId = require('crypto').randomUUID();
        const inProgressColumnId = require('crypto').randomUUID();
        const doneColumnId = require('crypto').randomUUID();
        
        columns.push(
          { id: todoColumnId, name: 'To Do' },
          { id: inProgressColumnId, name: 'In Progress' },
          { id: doneColumnId, name: 'Done' }
        );
        
        // Add sample cards for full template
        if (template === 'full') {
          cards.push({
            id: require('crypto').randomUUID(),
            title: 'Welcome to your new board',
            content: '# Getting Started\n\nThis board uses the card-first architecture, where cards are stored in a top-level array and reference their parent column.\n\n## Features:\n- Markdown formatting\n- Subtasks\n- Tags\n- Dependencies',
            columnId: todoColumnId,
            position: 0,
            collapsed: false,
            subtasks: ['✓ Create board', 'Add your own cards', 'Customize columns'],
            tags: ['welcome', 'getting-started'],
            dependencies: [],
            created_at: now,
            updated_at: now
          });
          
          cards.push({
            id: require('crypto').randomUUID(),
            title: 'Example Task',
            content: 'This is an example task in progress',
            columnId: inProgressColumnId,
            position: 0,
            collapsed: false,
            subtasks: ['✓ Step 1', 'Step 2', 'Step 3'],
            tags: ['example'],
            dependencies: [],
            created_at: now,
            updated_at: now
          });
        }
      }
      
      // Create the board object
      const boardData = {
        id: boardId,
        projectName: name.trim(),
        columns: columns,
        cards: cards,
        'next-steps': [],
        last_updated: now
      };
      
      // Import the board
      const board = await Board.import(boardData);
      
      return {
        content: [{ type: 'text', text: JSON.stringify(board, null, 2) }]
      };
    } catch (error) {
      console.error('Error in create-board tool:', error);
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
      
      // For card-first architecture - validate column references
      if (parsedData.cards && Array.isArray(parsedData.cards) && parsedData.columns && Array.isArray(parsedData.columns)) {
        // Get all valid column IDs
        const validColumnIds = new Set(parsedData.columns.map(column => column.id));
        
        // Check each card references a valid column
        for (const card of parsedData.cards) {
          if (!card.columnId || !validColumnIds.has(card.columnId)) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Card "${card.title || card.id}" references non-existent column ID: ${card.columnId}` 
              }],
              isError: true
            };
          }
        }
      }
      
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
      
      // Check card limits for card-first architecture
      if (parsedData.cards && Array.isArray(parsedData.cards)) {
        if (parsedData.cards.length > 1000) {
          return {
            content: [{ type: 'text', text: 'Error: Maximum number of cards (1000) exceeded' }],
            isError: true
          };
        }
      }
      // Legacy support for column-based architecture
      else if (parsedData.columns) {
        let totalItems = 0;
        for (const column of parsedData.columns) {
          if (column.items && Array.isArray(column.items)) {
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

// Migrate a board to card-first architecture
server.tool(
  'migrate-to-card-first',
  { boardId: z.string().min(1, 'Board ID is required') },
  async ({ boardId }) => {
    try {
      // Load the board
      const board = await Board.load(boardId);
      
      // Check if already using card-first architecture
      if (board.data.cards && Array.isArray(board.data.cards)) {
        return {
          content: [{ type: 'text', text: 'Board is already using card-first architecture.' }]
        };
      }
      
      // Create a backup before migrating
      const backupDir = path.join(config.boardsDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_migration.json`);
      await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));
      
      // Convert to card-first format
      if (!board.data.cards) {
        board.data.cards = [];
        
        if (board.data.columns && Array.isArray(board.data.columns)) {
          for (let columnIndex = 0; columnIndex < board.data.columns.length; columnIndex++) {
            const column = board.data.columns[columnIndex];
            
            if (column.items && Array.isArray(column.items)) {
              // Process each card in the column
              for (let cardIndex = 0; cardIndex < column.items.length; cardIndex++) {
                const card = column.items[cardIndex];
                
                // Add the card to the cards array with columnId and position
                board.data.cards.push({
                  ...card,
                  columnId: column.id,
                  position: cardIndex,
                  created_at: card.created_at || new Date().toISOString(),
                  updated_at: card.updated_at || new Date().toISOString()
                });
              }
              
              // Remove items array from column
              delete column.items;
            }
          }
        }
      }
      
      // Save the migrated board
      await board.save();
      
      return {
        content: [{ 
          type: 'text', 
          text: `Board "${board.data.projectName}" successfully migrated to card-first architecture. Backup created at ${backupPath}` 
        }]
      };
    } catch (error) {
      console.error('Error in migrate-to-card-first tool:', error);
      return {
        content: [{ type: 'text', text: `Error migrating board: ${error.message}` }],
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
