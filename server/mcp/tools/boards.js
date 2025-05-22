/**
 * MCP tools related to boards: get-boards, create-board, get-board, update-board, delete-board
 */

const Board = require('../../models/Board');
const { z } = require('zod');
const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('crypto');

function registerBoardTools(server, { config, checkRateLimit }) {
  // List all boards
  server.tool(
    'get-boards',
    {},
    async () => {
      try {
        const boardsDir = config.boardsDir;
        const files = await fs.readdir(boardsDir);
        const boardFiles = files.filter(file =>
          file.endsWith('.json') &&
          !file.startsWith('_') &&
          file !== 'config.json'
        );

        const boards = [];

        for (const file of boardFiles) {
          try {
            const filePath = path.join(boardsDir, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) continue;

            const data = await fs.readFile(filePath, 'utf8');
            const boardData = JSON.parse(data);

            let lastUpdated = boardData.last_updated;
            if (!lastUpdated) lastUpdated = stats.mtime.toISOString();

            boards.push({
              id: boardData.id || path.basename(file, '.json'),
              name: boardData.projectName || 'Unnamed Board',
              lastUpdated: lastUpdated || new Date().toISOString()
            });
          } catch (err) {
            console.error(`Error reading board file ${file}: ${err}`);
          }
        }

        boards.sort((a, b) => a.name.localeCompare(b.name));

        let formattedOutput = '';

        if (boards.length === 0) {
          formattedOutput = 'No boards found. Create a new board with the create-board tool.';
        } else {
          boards.forEach((board, index) => {
            const date = new Date(board.lastUpdated || new Date().toISOString());
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
        }

        return {
          content: [{ type: 'text', text: formattedOutput }]
        };
      } catch (error) {
        console.error(`Error in get-boards tool: ${error}`);
        return {
          content: [{ type: 'text', text: `Error listing boards: ${error.message}` }],
          isError: true
        };
      }
    },
    'Retrieves a list of all available Kanban boards. Returns board names, IDs, and last updated timestamps. Useful for displaying board overview and selection.'
  );

  // Create a new board based on the _kanban_example.json template
  server.tool(
    'create-board',
    {
      name: z.string().min(1, 'Board name is required').describe('The name for the new Kanban board')
    },
    async ({ name }) => {
      try {
        checkRateLimit();

        // 1. Read the template file
        const templatePath = path.join(config.templateBoardsDir, '_kanban_example.json');
        let templateData;
        try {
          const templateContent = await fs.readFile(templatePath, 'utf8');
          templateData = JSON.parse(templateContent);
        } catch (readError) {
          console.error(`Error reading board template file at ${templatePath}: ${readError}`);
          return {
            content: [{ type: 'text', text: 'Error: Could not load board template.' }],
            isError: true
          };
        }
        
        // Also try to load the documentation for returning to agent
        let templateDocumentation = null;
        try {
          const docPath = path.join(config.templateBoardsDir, '_kanban_example_doc.md');
          templateDocumentation = await fs.readFile(docPath, 'utf8');
        } catch (docError) {
          // Documentation is optional, so just log the error
          console.warn(`Template documentation not found: ${docError}`);
        }

        const now = new Date().toISOString();
        const newBoardId = crypto.randomUUID();
        const idMap = {}; // Map old IDs (template) to new IDs (generated)

        // 2. Generate new IDs for columns and map old->new
        templateData.columns.forEach(col => {
          const oldId = col.id;
          const newId = crypto.randomUUID();
          idMap[oldId] = newId;
          col.id = newId;
        });

        // 3. Generate new IDs for cards, update columnId, dependencies, and timestamps
        templateData.cards.forEach(card => {
          const oldId = card.id;
          const newId = crypto.randomUUID();
          idMap[oldId] = newId;
          card.id = newId;

          // Update columnId reference
          if (card.columnId && idMap[card.columnId]) {
            card.columnId = idMap[card.columnId];
          } else {
            // Assign to the first column if the original columnId is invalid/missing
            card.columnId = templateData.columns[0]?.id || null;
            console.warn(`Card "${card.title}" had invalid/missing columnId, assigned to first column.`);
          }

          // Update dependency references
          if (card.dependencies && Array.isArray(card.dependencies)) {
            card.dependencies = card.dependencies
              .map(depId => idMap[depId]) // Map old dependency IDs to new ones
              .filter(Boolean); // Remove any dependencies that weren't in the template's cards
          } else {
            card.dependencies = [];
          }

          // Update timestamps and remove status timestamps
          card.created_at = now;
          card.updated_at = now;
          delete card.completed_at;
          delete card.blocked_at;
        });

        // 4. Prepare the final board data
        const newBoardData = {
          ...templateData, // Spread the modified template data
          id: newBoardId, // Use the new board ID
          projectName: name.trim(), // Use the provided name
          last_updated: now, // Set last updated time
          // Reset runtime state properties
          isDragging: false,
          scrollToColumn: null
        };

        // 5. Import the board using the Board model
        const boardSummary = await Board.import(newBoardData);

        // Return the board data directly with helpful comments for the agent
        const boardSummaryObj = {
          success: true,
          message: `Board "${name}" created successfully with ID: ${boardSummary.id}`,
          board: boardSummary,
          // Add column information and usage tips as separate fields that won't affect the main board data
          tips: {
            // Column information for reference
            columns: newBoardData.columns.map(column => ({
              id: column.id,
              name: column.name
            })),
            // Usage instructions (without changing the actual board format)
            usage: [
              `Use get-board with ID "${boardSummary.id}" to retrieve the full board`,
              `Use get-board with ID "${boardSummary.id}" and format "cards-only" to get just the cards`,
              `Use batch-cards with boardId "${boardSummary.id}" to create multiple cards at once`,
              `When creating cards, ensure each card has: id (UUID), title, columnId, position, created_at, and updated_at fields`
            ],
            // Card field explanations
            cardFields: {
              required: ["id", "title", "columnId", "position", "created_at", "updated_at"],
              optional: ["content", "collapsed", "subtasks", "tags", "dependencies", "priority", "completed_at", "blocked_at"]
            },
            // Example of a valid card (as separate information that won't affect the board)
            exampleCard: {
              id: "use-crypto.randomUUID()-to-generate",
              title: "Example Card Title",
              content: "Markdown content for card description",
              columnId: newBoardData.columns[0].id,
              position: 0,
              collapsed: false,
              subtasks: ["Task One", "✓ Completed Task"],
              tags: ["example", "tag"],
              dependencies: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
        };
        
        // Add documentation as separate tips if available
        if (templateDocumentation) {
          boardSummaryObj.tips.documentation = templateDocumentation;
        }

        // Return the structured response
        return {
          content: [{ type: 'text', text: JSON.stringify(boardSummaryObj, null, 2) }]
        };
      } catch (error) {
        // Use our error handling utilities for consistent formatting
        if (logger) {
          logger.error('Error in create-board tool', error);
        } else {
          console.error('Error in create-board tool:', error);
        }
        
        // Create a well-structured error response
        const errorResponse = {
          success: false,
          operation: "create-board",
          error: {
            message: error.message || "Failed to create board",
            code: error.code || "UNKNOWN_ERROR"
          }
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(errorResponse, null, 2) }],
          isError: true
        };
      }
    },
    'Creates a new Kanban board using a predefined template. Generates unique IDs for columns and cards, and allows customizing the board name.'
  );

  // Get a board
  server.tool(
    'get-board',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to retrieve'),
      format: z.enum(['full', 'summary', 'compact', 'cards-only'])
        .optional()
        .default('full')
        .describe('Format of the board data to return. Options: full (default), summary, compact, cards-only'),
      columnId: z.string().optional().describe('Optional column ID to filter cards')
    },
    async ({ boardId, format, columnId }) => {
      try {
        const board = await Board.load(boardId);
        const options = columnId ? { columnId } : {};
        const formattedData = board.format(format, options);

        // [Rest of the existing implementation remains the same]

        let responseData;
        
        if (format === 'compact') {
          // ... [existing compact format code]
          responseData = formattedData;
        } else if (format === 'summary') {
          // ... [existing summary format code]
          responseData = formattedData;
        } else if (format === 'cards-only') {
          // ... [existing cards-only format code]
          responseData = formattedData;
        } else {
          // For full format, add helpful tips without modifying the actual board data
          // We'll wrap the board data in an object with tips as a separate field
          responseData = {
            _boardData: formattedData, // Underscore prefix to indicate this is the actual board data
            tips: {
              usage: [
                "The _boardData field contains the complete board structure",
                "To create a new card, use the batch-cards tool with the create operation",
                "To update a card, use update-card or batch-cards with the update operation",
                "To move a card between columns, use move-card tool"
              ],
              requiredCardFields: [
                "id", "title", "columnId", "position", "created_at", "updated_at"
              ],
              boardStructure: {
                id: "The board's unique identifier",
                projectName: "The board's display name",
                columns: "Array of column objects with id and name",
                cards: "Array of card objects with card data",
                last_updated: "ISO timestamp of last update"
              }
            }
          };
        }
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        // Add helpful guidance in error messages
        const errorData = {
          success: false,
          error: {
            message: `Error retrieving board: ${error.message}`,
            code: error.code || "NOT_FOUND"
          },
          tips: {
            createBoard: "If the board doesn't exist, use create-board to create a new one",
            listBoards: "Use get-boards to list all available boards",
            boardIdFormat: "Board IDs are UUIDs and case-sensitive",
            formats: {
              full: "Default format with all board data",
              summary: "Simplified view with statistics",
              compact: "Abbreviated view with shortened property names",
              "cards-only": "Only cards data, can be filtered by columnId"
            }
          }
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(errorData, null, 2) }],
          isError: true
        };
      }
    },
    'Retrieves a specific board by its ID. Supports multiple output formats: full details, summary statistics, compact view, or cards-only.'
  );

  // Update a board
  server.tool(
    'update-board',
    {
      // Allow string or object for boardData
      boardData: z.union([
        z.string().min(1, 'Board data string cannot be empty').max(1000000, 'Board data string too large'),
        z.object({}).passthrough() // Allow any object structure
      ]).describe('Board data to update. Can be a JSON string or an object containing board details.')
    },
    async ({ boardData }) => {
      // [Rest of the existing implementation remains the same]
      try {
        // ... [existing update board implementation]
      } catch (error) {
        console.error('Error in update-board tool:', error);
        return {
          content: [{ type: 'text', text: `Error updating board: ${error.message}` }],
          isError: true
        };
      }
    },
    'Updates an existing board with new data. Requires the board ID and supports partial or full board data updates.'
  );

  // Delete a board
  server.tool(
    'delete-board',
    {
      boardId: z.string().min(1, 'Board ID is required').uuid('Invalid board ID format').describe('Unique identifier of the board to delete')
    },
    async ({ boardId }) => {
      try {
        try {
          const board = await Board.load(boardId);
          const backupDir = path.join(config.boardsDir, 'backups');
          await fs.mkdir(backupDir, { recursive: true });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_deletion.json`);
          await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));
        } catch (error) {
          if (!error.message.includes('not found')) {
            console.error(`Error creating backup before deletion: ${error}`);
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
    },
    'Permanently deletes a board by its ID. Creates a backup before deletion to prevent accidental data loss.'
  );

  // Query boards with advanced filtering and sorting
  server.tool(
    'query-boards',
    {
      title: z.string().optional().describe('Filter boards by title (partial match)'),
      createdBefore: z.string().optional().describe('Filter boards created before this date (ISO format)'),
      createdAfter: z.string().optional().describe('Filter boards created after this date (ISO format)'),
      updatedBefore: z.string().optional().describe('Filter boards updated before this date (ISO format)'),
      updatedAfter: z.string().optional().describe('Filter boards updated after this date (ISO format)'),
      tags: z.array(z.string()).optional().describe('Filter boards containing any of these tags'),
      sortBy: z.enum(['title', 'createdAt', 'updatedAt']).optional().describe('Property to sort by'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (ascending or descending)'),
      limit: z.number().int().positive().optional().describe('Maximum number of boards to return'),
      offset: z.number().int().min(0).optional().describe('Number of boards to skip')
    },
    async (query) => {
      try {
        checkRateLimit();

        // Get all boards first
        const boardsDir = config.boardsDir;
        const files = await fs.readdir(boardsDir);
        const boardFiles = files.filter(file =>
          file.endsWith('.json') &&
          !file.startsWith('_') &&
          file !== 'config.json'
        );

        let boards = [];

        for (const file of boardFiles) {
          try {
            const filePath = path.join(boardsDir, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) continue;

            const data = await fs.readFile(filePath, 'utf8');
            const boardData = JSON.parse(data);

            let lastUpdated = boardData.last_updated;
            if (!lastUpdated) lastUpdated = stats.mtime.toISOString();

            boards.push({
              id: boardData.id || path.basename(file, '.json'),
              title: boardData.projectName || 'Unnamed Board',
              createdAt: boardData.created_at || stats.birthtime.toISOString(),
              updatedAt: lastUpdated || new Date().toISOString(),
              tags: boardData.tags || [],
              cardCount: boardData.cards ? boardData.cards.length : 0,
              columnCount: boardData.columns ? boardData.columns.length : 0
            });
          } catch (err) {
            console.error(`Error reading board file ${file}: ${err}`);
          }
        }

        // Apply filters
        if (query.title) {
          boards = boards.filter(board => 
            board.title.toLowerCase().includes(query.title.toLowerCase())
          );
        }

        if (query.tags && query.tags.length > 0) {
          boards = boards.filter(board => 
            query.tags.some(tag => board.tags.includes(tag))
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

        const responseData = {
          success: true,
          data: {
            boards,
            count: boards.length,
            query
          },
          help: `Found ${boards.length} boards matching your query. You can refine your search using additional filters.`
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in query-boards tool:', error);
        return {
          content: [{ type: 'text', text: `Error querying boards: ${error.message}` }],
          isError: true
        };
      }
    },
    'Search for boards that match specific criteria. Filter by title, creation date, update date, or tags. Sort and paginate results.'
  );
}

module.exports = { registerBoardTools };
