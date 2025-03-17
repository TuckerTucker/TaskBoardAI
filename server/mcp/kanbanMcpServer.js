#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const Board = require('../models/Board');
const { z } = require('zod');
const fs = require('node:fs').promises;
const path = require('node:path');

// Load regular config
const config = require('../config/config');

// Handle environment variables for configuration
if (process.env.USE_LOCAL_BOARDS === 'true') {
  console.log('Using local boards directory (from environment variable)');
}

// Use environment variable for port if specified
if (process.env.MCP_PORT) {
  config.mcpPort = parseInt(process.env.MCP_PORT, 10);
  console.log('Using port from environment variable:', config.mcpPort);
}

console.log('Configuration loaded from environment variables and config.js')

console.log('MCP Server using boards directory:', config.boardsDir);

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
      // Direct filesystem-based board listing (bypass Board.list abstraction)
      console.log('\n--- GET-BOARDS TRACE ---');
      console.log('Function calling context: get-boards MCP tool');
      console.log('Current working directory:', process.cwd());
      
      const boardsDir = config.boardsDir;
      console.log('Configured boardsDir:', boardsDir);
      console.log('Config object:', { 
        boardsDir: config.boardsDir,
        useLocalBoards: process.env.USE_LOCAL_BOARDS,
        dataDir: config.userDataDir 
      });
      
      // Get all files in the directory
      const files = await fs.readdir(boardsDir);
      console.log('Found files:', files);
      
      // Filter for JSON files that don't start with underscore
      const boardFiles = files.filter(file => 
        file.endsWith('.json') && 
        !file.startsWith('_') && 
        file !== 'config.json'
      );
      
      console.log('Filtered to board files:', boardFiles);
      
      // Read and parse each board file
      const boards = [];
      
      for (const file of boardFiles) {
        try {
          // Skip directories
          const filePath = path.join(boardsDir, file);
          const stats = await fs.stat(filePath);
          if (stats.isDirectory()) {
            console.log(`Skipping directory: ${file}`);
            continue;
          }
          
          // Read the file
          const data = await fs.readFile(filePath, 'utf8');
          const boardData = JSON.parse(data);
          
          // Use file modification time if no last_updated
          let lastUpdated = boardData.last_updated;
          if (!lastUpdated) {
            lastUpdated = stats.mtime.toISOString();
          }
          
          boards.push({
            id: boardData.id || path.basename(file, '.json'),
            name: boardData.projectName || 'Unnamed Board',
            lastUpdated: lastUpdated || new Date().toISOString()
          });
        } catch (err) {
          console.error(`Error reading board file ${file}:`, err);
        }
      }
      
      // Sort boards by name
      boards.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('Successfully loaded boards:', boards.length);
      
      // Format the output as a numbered list with name, ID and last modified date
      let formattedOutput = '';
      
      if (boards.length === 0) {
        formattedOutput = 'No boards found. Create a new board with the create-board tool.';
      } else {
        boards.forEach((board, index) => {
          // Ensure we have a last updated date, or use current date
          const lastUpdated = board.lastUpdated || new Date().toISOString();
          
          // Convert to date object
          const date = new Date(lastUpdated);
          
          // Format date as "Month Day - HH:MMam/pm"
          const month = date.toLocaleString('en-US', { month: 'short' });
          const day = date.getDate();
          const time = date.toLocaleString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          }).toLowerCase();
          
          const formattedDate = `${month} ${day} - ${time}`;
          
          // Add to numbered list: "1) Board Name\n(board-id)\nDate"
          formattedOutput += `${index + 1}) ${board.name}\n(${board.id})\n${formattedDate}\n\n`;
        });
      }
      
      return {
        content: [{ type: 'text', text: formattedOutput }]
      };
    } catch (error) {
      console.error('Error in get-boards tool:', error);
      return {
        content: [{ type: 'text', text: `Error listing boards: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Create a new board with comprehensive structure and comments
server.tool(
  'create-board',
  { 
    name: z.string().min(1, 'Board name is required')
  },
  async ({ name }) => {
    try {
      checkRateLimit();
      
      // Create the board with detailed metadata
      const boardId = require('crypto').randomUUID();
      const now = new Date().toISOString();
      
      // Create default columns with comments
      const todoColumnId = require('crypto').randomUUID();
      const inProgressColumnId = require('crypto').randomUUID();
      const doneColumnId = require('crypto').randomUUID();
      const blockedColumnId = require('crypto').randomUUID();
      
      const columns = [
        { id: todoColumnId, name: 'To Do' }, // Column for tasks not yet started
        { id: inProgressColumnId, name: 'In Progress' }, // Column for tasks currently being worked on
        { id: doneColumnId, name: 'Done' }, // Column for completed tasks
        { id: blockedColumnId, name: 'Blocked' } // Column for tasks that cannot proceed due to dependencies or obstacles
      ];
      
      // Create sample cards with comprehensive structure and comments
      const featureOneId = require('crypto').randomUUID();
      const featureTwoId = require('crypto').randomUUID();
      const completedFeatureId = require('crypto').randomUUID();
      const blockedFeatureId = require('crypto').randomUUID();
      
      const cards = [
        {
          id: featureOneId, // Unique identifier for the card
          title: 'Feature One', // Card title displayed in the header
          content: '## Feature Description\n\n- Point 1\n- Point 2\n\nAdditional details here.', // markdown is supported
          columnId: todoColumnId, // ID of the column this card belongs to
          collapsed: false, // Whether the card is currently collapsed (boolean)
          position: 0, // Position within the column (0-indexed)
          subtasks: [ // Array of subtask strings, prefix with ✓ to mark as complete
            '✓ Task One', // completed subtask
            'Task Two' // task in progress
          ],
          tags: [ // Array of tag strings for categorization
            'feature',
            'frontend'
          ],
          dependencies: [ // Array of card IDs that this card depends on
            featureTwoId
          ],
          created_at: now, // ISO timestamp when card was created
          updated_at: now // ISO timestamp of last card update
        },
        {
          id: featureTwoId, // Unique identifier
          title: 'Feature Two', // Display title
          content: 'A basic feature description', // Markdown content
          columnId: inProgressColumnId, // Card belongs in "In Progress" column
          position: 0, // First position in column
          collapsed: true, // Card is initially collapsed
          subtasks: [], // No subtasks defined yet
          tags: ['backend', 'database', 'api'], // Multiple categorization tags
          dependencies: [], // No dependencies on other cards
          created_at: now, // Creation timestamp
          updated_at: now // Last update timestamp
        },
        {
          id: completedFeatureId, // Unique identifier
          title: 'Completed Feature', // Display title
          content: 'This feature is done', // Simple markdown content
          columnId: doneColumnId, // Card belongs in "Done" column
          position: 0, // First position in column
          collapsed: false, // Card is expanded
          subtasks: [ // All subtasks completed
            '✓ Task One',
            '✓ Task Two',
            '✓ Task Three'
          ],
          tags: ['complete'], // Tagged as complete
          dependencies: [], // No dependencies
          created_at: now, // Creation timestamp
          updated_at: now, // Last update timestamp
          completed_at: now // Timestamp when moved to Done column
        },
        {
          id: blockedFeatureId, // Unique identifier
          title: 'Blocked Feature Example', // Display title
          content: 'This feature is blocked waiting for dependencies.', // Descriptive content
          columnId: blockedColumnId, // Card belongs in "Blocked" column
          position: 0, // First position in column
          collapsed: false, // Card is expanded
          subtasks: [ // Mix of complete and incomplete tasks
            '✓ Initial research',
            '✓ Requirements gathering',
            'Implementation - blocked by Feature Two'
          ],
          tags: ['blocked', 'backend'], // Relevant tags
          dependencies: [featureTwoId], // Depends on Feature Two
          created_at: now, // Creation timestamp
          updated_at: now, // Last update timestamp
          blocked_at: now // Timestamp when moved to Blocked column
        }
      ];
      
      // Create the board object with all components
      const boardData = {
        id: boardId, // board uuid
        projectName: name.trim(), // Name displayed at the top of the board
        columns: columns, // Array of column definitions
        cards: cards, // Array of all cards in the board
        'next-steps': [ // Array of next priority tasks and focus areas
          'Complete Feature Two',
          'Review completed features for proper types, structures, and architecture'
        ],
        last_updated: now, // ISO timestamp of last board update
        isDragging: false, // Internal state for drag operations
        scrollToColumn: null // ID of column to auto-scroll to, or null
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

/**
 * Retrieves a specific board by ID with optional format parameters for token optimization.
 * 
 * @tool get-board
 * @param {string} boardId - Unique identifier of the board to retrieve
 * @param {string} [format='full'] - Optional format parameter to control response size:
 *                                  'full' (default), 'summary', 'compact', or 'cards-only'
 * @param {string} [columnId] - Optional column ID to filter cards by (only with 'cards-only' format)
 * @returns {Object} Board data in the requested format
 */
server.tool(
  'get-board',
  { 
    boardId: z.string().min(1, 'Board ID is required'),
    format: z.enum(['full', 'summary', 'compact', 'cards-only']).optional().default('full'),
    columnId: z.string().optional()
  },
  async ({ boardId, format, columnId }) => {
    try {
      const board = await Board.load(boardId);
      
      // Apply the requested format transformation with options
      const options = columnId ? { columnId } : {};
      const formattedData = board.format(format, options);
      
      return {
        content: [{ type: 'text', text: JSON.stringify(formattedData, null, 2) }]
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

/**
 * Token-optimized tool to retrieve a specific card by ID.
 * This tool is more efficient than loading the full board when only a single card is needed.
 * 
 * @tool get-card
 * @param {string} boardId - ID of the board containing the card
 * @param {string} cardId - ID of the card to retrieve
 * @returns {Object} Card data including column name
 */
server.tool(
  'get-card',
  { 
    boardId: z.string().min(1, 'Board ID is required'),
    cardId: z.string().min(1, 'Card ID is required')
  },
  async ({ boardId, cardId }) => {
    try {
      // Load the board
      const board = await Board.load(boardId);
      
      // Check if the board is using card-first architecture
      if (!board.data.cards || !Array.isArray(board.data.cards)) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to retrieve card by ID.' 
          }],
          isError: true
        };
      }
      
      // Find the card by ID
      const card = board.data.cards.find(card => card.id === cardId);
      
      if (!card) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Card with ID ${cardId} not found in board ${boardId}` 
          }],
          isError: true
        };
      }
      
      // Get column information
      let columnName = "Unknown";
      if (card.columnId && board.data.columns) {
        const column = board.data.columns.find(col => col.id === card.columnId);
        if (column) {
          columnName = column.name;
        }
      }
      
      // Add column name to the returned card data
      const cardWithContext = {
        ...card,
        columnName
      };
      
      return {
        content: [{ type: 'text', text: JSON.stringify(cardWithContext, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error retrieving card: ${error.message}` }],
        isError: true
      };
    }
  }
);

/**
 * Token-optimized tool to update properties of a specific card.
 * Updates only the specified card without requiring the entire board context.
 * 
 * @tool update-card
 * @param {string} boardId - ID of the board containing the card
 * @param {string} cardId - ID of the card to update
 * @param {string} cardData - JSON string containing the card properties to update
 * @returns {Object} Updated card data with column information
 */
server.tool(
  'update-card',
  { 
    boardId: z.string().min(1, 'Board ID is required'),
    cardId: z.string().min(1, 'Card ID is required'),
    cardData: z.string().min(1, 'Card data is required').max(200000, 'Card data too large')
  },
  async ({ boardId, cardId, cardData }) => {
    try {
      // Parse the card data
      let parsedCardData;
      try {
        parsedCardData = JSON.parse(cardData);
      } catch (e) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid JSON format for card data' }],
          isError: true
        };
      }
      
      // Validate that we have an object
      if (typeof parsedCardData !== 'object' || parsedCardData === null) {
        return {
          content: [{ type: 'text', text: 'Error: Card data must be a valid JSON object' }],
          isError: true
        };
      }
      
      // Load the board
      const board = await Board.load(boardId);
      
      // Check if the board is using card-first architecture
      if (!board.data.cards || !Array.isArray(board.data.cards)) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to update card by ID.' 
          }],
          isError: true
        };
      }
      
      // Create a backup of the board before updating
      const backupDir = path.join(config.boardsDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_card_update.json`);
      await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));
      
      // Find the card index
      const cardIndex = board.data.cards.findIndex(card => card.id === cardId);
      
      if (cardIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Card with ID ${cardId} not found in board ${boardId}` 
          }],
          isError: true
        };
      }
      
      // Get the existing card
      const existingCard = board.data.cards[cardIndex];
      
      // If columnId is being changed, verify the new column exists
      if (parsedCardData.columnId && parsedCardData.columnId !== existingCard.columnId) {
        const newColumnExists = board.data.columns.some(col => col.id === parsedCardData.columnId);
        if (!newColumnExists) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error: Target column with ID ${parsedCardData.columnId} does not exist` 
            }],
            isError: true
          };
        }
      }
      
      // Update the card - merge the changes but keep the original ID
      const updatedCard = {
        ...existingCard,           // Start with existing card properties
        ...parsedCardData,         // Override with new properties
        id: cardId,                // Ensure ID doesn't change
        updated_at: new Date().toISOString() // Set updated timestamp
      };
      
      // Validate the updated card
      if (!Board.validateItem(updatedCard)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid card data format' }],
          isError: true
        };
      }
      
      // Update the card in the board
      board.data.cards[cardIndex] = updatedCard;
      
      // If the card was moved to a "Done" column, update completed_at timestamp
      const isDoneColumn = board.data.columns
        .filter(column => column.name.toLowerCase() === 'done')
        .some(col => col.id === updatedCard.columnId);
      
      if (isDoneColumn && !updatedCard.completed_at) {
        updatedCard.completed_at = new Date().toISOString();
      } else if (!isDoneColumn) {
        // Clear completed_at if not in a Done column
        updatedCard.completed_at = null;
      }
      
      // Save the board
      await board.save();
      
      // Get updated column name for response
      let columnName = "Unknown";
      if (updatedCard.columnId) {
        const column = board.data.columns.find(col => col.id === updatedCard.columnId);
        if (column) {
          columnName = column.name;
        }
      }
      
      // Return the updated card with column info
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            ...updatedCard,
            columnName
          }, null, 2) 
        }]
      };
    } catch (error) {
      console.error('Error in update-card tool:', error);
      return {
        content: [{ type: 'text', text: `Error updating card: ${error.message}` }],
        isError: true
      };
    }
  }
);

/**
 * Token-optimized tool to move a card to a different column or position.
 * Handles position adjustments and completion status automatically.
 * 
 * @tool move-card
 * @param {string} boardId - ID of the board containing the card
 * @param {string} cardId - ID of the card to move
 * @param {string} columnId - ID of the target column
 * @param {number|string} position - Target position, can be a specific position number or one of:
 *                                  'first', 'last', 'up', or 'down'
 * @returns {Object} Result information including the card's new position and column
 */
server.tool(
  'move-card',
  { 
    boardId: z.string().min(1, 'Board ID is required'),
    cardId: z.string().min(1, 'Card ID is required'),
    columnId: z.string().min(1, 'Column ID is required'),
    position: z.union([
      z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
      z.enum(['first', 'last', 'up', 'down'])
    ])
  },
  async ({ boardId, cardId, columnId, position }) => {
    try {
      // Load the board
      const board = await Board.load(boardId);
      
      // Check if the board is using card-first architecture
      if (!board.data.cards || !Array.isArray(board.data.cards)) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to move card by ID.' 
          }],
          isError: true
        };
      }
      
      // Create a backup of the board before moving the card
      const backupDir = path.join(config.boardsDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_card_move.json`);
      await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));
      
      // Find the card
      const cardIndex = board.data.cards.findIndex(card => card.id === cardId);
      
      if (cardIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Card with ID ${cardId} not found in board ${boardId}` 
          }],
          isError: true
        };
      }
      
      // Get the card
      const card = board.data.cards[cardIndex];
      const originalColumnId = card.columnId;
      
      // Check if the target column exists
      const columnExists = board.data.columns.some(col => col.id === columnId);
      if (!columnExists) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Target column with ID ${columnId} does not exist` 
          }],
          isError: true
        };
      }
      
      // Store the original position and column ID
      const originalPosition = card.position;
      
      // Get cards in the target column (excluding the card being moved)
      const cardsInTargetColumn = board.data.cards
        .filter(c => c.columnId === columnId && c.id !== cardId)
        .sort((a, b) => a.position - b.position);
      
      // Calculate new position based on position parameter
      let newPosition;
      if (typeof position === 'number') {
        // Absolute position
        newPosition = position;
      } else {
        // Handle relative positions
        switch (position) {
          case 'first':
            newPosition = 0;
            break;
          case 'last':
            newPosition = cardsInTargetColumn.length;
            break;
          case 'up':
            // Move up one position (only relevant if same column)
            if (originalColumnId === columnId && card.position > 0) {
              newPosition = card.position - 1;
            } else {
              newPosition = 0;
            }
            break;
          case 'down':
            // Move down one position (only relevant if same column)
            if (originalColumnId === columnId) {
              newPosition = card.position + 1;
            } else {
              newPosition = cardsInTargetColumn.length;
            }
            break;
          default:
            newPosition = cardsInTargetColumn.length;
        }
      }
      
      // Ensure position is valid (not beyond the end of the column)
      newPosition = Math.min(newPosition, cardsInTargetColumn.length);
      
      // First handle the position adjustments for other cards
      if (columnId === originalColumnId) {
        // Moving within the same column
        board.data.cards.forEach(otherCard => {
          if (otherCard.id !== cardId && otherCard.columnId === columnId) {
            if (originalPosition < newPosition) {
              // Moving card down - cards in between shift up
              if (otherCard.position > originalPosition && otherCard.position <= newPosition) {
                otherCard.position--;
              }
            } else if (originalPosition > newPosition) {
              // Moving card up - cards in between shift down
              if (otherCard.position >= newPosition && otherCard.position < originalPosition) {
                otherCard.position++;
              }
            }
          }
        });
      } else {
        // Moving to a different column - shift positions in target column
        board.data.cards.forEach(otherCard => {
          if (otherCard.id !== cardId && otherCard.columnId === columnId && otherCard.position >= newPosition) {
            otherCard.position++;
          }
        });
      }
      
      // Check if the card is moving to/from a Done column
      const isDoneColumn = board.data.columns
        .filter(column => column.name.toLowerCase() === 'done')
        .some(col => col.id === columnId);
      
      // Now update the card itself
      card.columnId = columnId;
      card.position = newPosition;
      card.updated_at = new Date().toISOString();
      
      // Update completed_at timestamp based on the target column
      if (isDoneColumn && !card.completed_at) {
        card.completed_at = new Date().toISOString();
      } else if (!isDoneColumn) {
        card.completed_at = null;
      }
      
      // Save the board
      await board.save();
      
      // Get column name for the response
      const column = board.data.columns.find(col => col.id === columnId);
      const columnName = column ? column.name : "Unknown";
      
      // Return success response
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            message: 'Card moved successfully',
            card: {
              id: cardId,
              columnId,
              columnName,
              position: newPosition,
              updated_at: card.updated_at,
              completed_at: card.completed_at
            }
          }, null, 2) 
        }]
      };
    } catch (error) {
      console.error('Error in move-card tool:', error);
      return {
        content: [{ type: 'text', text: `Error moving card: ${error.message}` }],
        isError: true
      };
    }
  }
);

/**
 * Most token-efficient tool for processing multiple card operations in a single transaction.
 * Supports both update and move operations with all-or-nothing transaction semantics.
 * 
 * @tool batch-cards
 * @param {string} boardId - ID of the board containing the cards
 * @param {Array<Object>} operations - Array of operation objects
 * @param {string} operations[].type - Operation type: 'update' or 'move'
 * @param {string} operations[].cardId - ID of the card to operate on
 * @param {string} [operations[].cardData] - Required for update operations: JSON string with card properties to update
 * @param {string} [operations[].columnId] - Required for move operations: Target column ID
 * @param {number|string} [operations[].position] - Required for move operations: Target position
 * @returns {Object} Results of all operations with success status and details
 */
server.tool(
  'batch-cards',
  { 
    boardId: z.string().min(1, 'Board ID is required'),
    operations: z.array(z.object({
      type: z.enum(['update', 'move']),
      cardId: z.string().min(1, 'Card ID is required'),
      // For update operations
      cardData: z.string().optional(),
      // For move operations
      columnId: z.string().optional(),
      position: z.union([
        z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
        z.enum(['first', 'last', 'up', 'down'])
      ]).optional()
    })).min(1, 'At least one operation is required').max(100, 'Maximum 100 operations allowed')
  },
  async ({ boardId, operations }) => {
    try {
      // Load the board
      const board = await Board.load(boardId);
      
      // Check if the board is using card-first architecture
      if (!board.data.cards || !Array.isArray(board.data.cards)) {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to batch process cards.' 
          }],
          isError: true
        };
      }
      
      // Create a backup before processing
      const backupDir = path.join(config.boardsDir, 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_batch_operations.json`);
      await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));
      
      // Validate all operations first
      for (const operation of operations) {
        const { type, cardId } = operation;
        
        // Check if card exists
        const cardIndex = board.data.cards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error: Card with ID ${cardId} not found in board ${boardId}` 
            }],
            isError: true
          };
        }
        
        // Validate operation-specific fields
        if (type === 'update') {
          if (!operation.cardData) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: cardData is required for update operations (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
          
          // Try to parse cardData
          try {
            JSON.parse(operation.cardData);
          } catch (e) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Invalid JSON format for cardData (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
        } else if (type === 'move') {
          if (!operation.columnId) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: columnId is required for move operations (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
          
          if (!operation.position) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: position is required for move operations (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
          
          // Check if target column exists
          const columnExists = board.data.columns.some(col => col.id === operation.columnId);
          if (!columnExists) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Target column with ID ${operation.columnId} does not exist (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
        }
      }
      
      // Process all operations
      const operationResults = [];
      
      for (const operation of operations) {
        const { type, cardId } = operation;
        
        // Find the card
        const cardIndex = board.data.cards.findIndex(card => card.id === cardId);
        const card = board.data.cards[cardIndex];
        
        if (type === 'update') {
          // Parse the card data
          const parsedCardData = JSON.parse(operation.cardData);
          
          // Check if columnId is changing and validate it
          if (parsedCardData.columnId && parsedCardData.columnId !== card.columnId) {
            const newColumnExists = board.data.columns.some(col => col.id === parsedCardData.columnId);
            if (!newColumnExists) {
              return {
                content: [{ 
                  type: 'text', 
                  text: `Error: Target column with ID ${parsedCardData.columnId} does not exist for card ${cardId}` 
                }],
                isError: true
              };
            }
          }
          
          // Update the card - merge properties
          const updatedCard = {
            ...card,                   // Start with existing properties
            ...parsedCardData,         // Override with new properties
            id: cardId,                // Ensure ID doesn't change
            updated_at: new Date().toISOString() // Set updated timestamp
          };
          
          // Validate the updated card
          if (!Board.validateItem(updatedCard)) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Invalid card data format for card ${cardId}` 
              }],
              isError: true
            };
          }
          
          // Update the card in the board
          board.data.cards[cardIndex] = updatedCard;
          
          // Handle completion status
          const isDoneColumn = board.data.columns
            .filter(column => column.name.toLowerCase() === 'done')
            .some(col => col.id === updatedCard.columnId);
          
          if (isDoneColumn && !updatedCard.completed_at) {
            updatedCard.completed_at = new Date().toISOString();
          } else if (!isDoneColumn) {
            updatedCard.completed_at = null;
          }
          
          // Get column name for response
          let columnName = "Unknown";
          if (updatedCard.columnId) {
            const column = board.data.columns.find(col => col.id === updatedCard.columnId);
            if (column) {
              columnName = column.name;
            }
          }
          
          // Add to results
          operationResults.push({
            type: 'update',
            cardId,
            success: true,
            data: { 
              ...updatedCard,
              columnName
            }
          });
          
        } else if (type === 'move') {
          const { columnId, position } = operation;
          const originalColumnId = card.columnId;
          const originalPosition = card.position;
          
          // Get cards in the target column (excluding the card being moved)
          const cardsInTargetColumn = board.data.cards
            .filter(c => c.columnId === columnId && c.id !== cardId)
            .sort((a, b) => a.position - b.position);
          
          // Calculate new position based on position parameter
          let newPosition;
          if (typeof position === 'number') {
            // Absolute position
            newPosition = position;
          } else {
            // Handle relative positions
            switch (position) {
              case 'first':
                newPosition = 0;
                break;
              case 'last':
                newPosition = cardsInTargetColumn.length;
                break;
              case 'up':
                // Move up one position (only relevant if same column)
                if (originalColumnId === columnId && card.position > 0) {
                  newPosition = card.position - 1;
                } else {
                  newPosition = 0;
                }
                break;
              case 'down':
                // Move down one position (only relevant if same column)
                if (originalColumnId === columnId) {
                  newPosition = card.position + 1;
                } else {
                  newPosition = cardsInTargetColumn.length;
                }
                break;
              default:
                newPosition = cardsInTargetColumn.length;
            }
          }
          
          // Ensure position is valid (not beyond the end of the column)
          newPosition = Math.min(newPosition, cardsInTargetColumn.length);
          
          // Handle position adjustments for other cards
          if (columnId === originalColumnId) {
            // Moving within the same column
            board.data.cards.forEach(otherCard => {
              if (otherCard.id !== cardId && otherCard.columnId === columnId) {
                if (originalPosition < newPosition) {
                  // Moving card down - cards in between shift up
                  if (otherCard.position > originalPosition && otherCard.position <= newPosition) {
                    otherCard.position--;
                  }
                } else if (originalPosition > newPosition) {
                  // Moving card up - cards in between shift down
                  if (otherCard.position >= newPosition && otherCard.position < originalPosition) {
                    otherCard.position++;
                  }
                }
              }
            });
          } else {
            // Moving to a different column - shift positions in target column
            board.data.cards.forEach(otherCard => {
              if (otherCard.id !== cardId && otherCard.columnId === columnId && otherCard.position >= newPosition) {
                otherCard.position++;
              }
            });
          }
          
          // Check if the card is moving to/from a Done column
          const isDoneColumn = board.data.columns
            .filter(column => column.name.toLowerCase() === 'done')
            .some(col => col.id === columnId);
          
          // Now update the card itself
          card.columnId = columnId;
          card.position = newPosition;
          card.updated_at = new Date().toISOString();
          
          // Update completed_at timestamp based on the target column
          if (isDoneColumn && !card.completed_at) {
            card.completed_at = new Date().toISOString();
          } else if (!isDoneColumn) {
            card.completed_at = null;
          }
          
          // Get column name for the response
          const column = board.data.columns.find(col => col.id === columnId);
          const columnName = column ? column.name : "Unknown";
          
          // Add to results
          operationResults.push({
            type: 'move',
            cardId,
            success: true,
            data: {
              id: cardId,
              columnId,
              columnName,
              position: newPosition,
              updated_at: card.updated_at,
              completed_at: card.completed_at
            }
          });
        }
      }
      
      // Save the board after all operations
      await board.save();
      
      // Return success response with all operation results
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            message: `Successfully processed ${operations.length} operations`,
            results: operationResults
          }, null, 2) 
        }]
      };
    } catch (error) {
      console.error('Error in batch-cards tool:', error);
      return {
        content: [{ type: 'text', text: `Error processing batch operations: ${error.message}` }],
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
  // Print environment information for debugging
  console.log('\nEnvironment Information:');
  console.log('- Process ID:', process.pid);
  console.log('- Node Version:', process.version);
  console.log('- Working Directory:', process.cwd());
  console.log('- Platform:', process.platform);
  console.log('- Environment Variables:');
  console.log('  USE_LOCAL_BOARDS:', process.env.USE_LOCAL_BOARDS);
  console.log('  BOARD_FILE:', process.env.BOARD_FILE);
  
  // Log filesystem access check
  (async () => {
    try {
      console.log('\nFile system access check:');
      const boardsDir = config.boardsDir;
      console.log('- Checking access to boardsDir:', boardsDir);
      await fs.access(boardsDir).then(() => console.log('  ✅ Directory exists and is accessible'));
      
      // Try to list files
      console.log('- Listing files in directory:');
      const files = await fs.readdir(boardsDir);
      console.log(`  ✅ Found ${files.length} files/directories`);
      console.log('  First 5 entries:', files.slice(0, 5));
    } catch (err) {
      console.error('❌ Filesystem access error:', err);
    }
  })();
  
  // Create a stdio transport
  const transport = new StdioServerTransport();
  
  // Connect the server to the transport
  server.connect(transport).catch(error => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

module.exports = server;
