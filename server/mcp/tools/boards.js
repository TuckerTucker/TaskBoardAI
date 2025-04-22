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
    }
  );

  // Create a new board based on the _kanban_example.json template
  server.tool(
    'create-board',
    {
      name: z.string().min(1, 'Board name is required')
    },
    async ({ name }) => {
      try {
        checkRateLimit();

        // 1. Read the template file
        const templatePath = path.join(__dirname, '../../config/_kanban_example.json');
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
        const board = await Board.import(newBoardData);

        // Return the newly created board data (or a success message)
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

  // Get a board
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
        const options = columnId ? { columnId } : {};
        const formattedData = board.format(format, options);

        if (format === 'compact') {
          const data = formattedData;
          const date = new Date(data.up);
          const month = date.toLocaleString('en-US', { month: 'short' });
          const day = date.getDate();
          const time = date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }).toLowerCase();

          const formattedDate = `${month} ${day} - ${time}`;

          let output = `Board: ${data.name}\nupdate: ${formattedDate}\n\n`;

          const cardsByColumn = {};
          data.cols.forEach(col => {
            cardsByColumn[col.id] = {
              name: col.n,
              cards: []
            };
          });

          data.cards.forEach(card => {
            if (cardsByColumn[card.col]) {
              cardsByColumn[card.col].cards.push(card);
            }
          });

          Object.values(cardsByColumn).forEach(column => {
            output += `[${column.name}]\n`;

            if (column.cards.length === 0) {
              output += 'No cards\n\n';
            } else {
              column.cards.forEach(card => {
                output += `- ${card.t}\n`;

                if (card.tag && card.tag.length > 0) {
                  output += `Tags: ${card.tag.join(', ')}\n`;
                }

                if (card.c) {
                  output += `Desc: ${card.c.split('\n')[0]}\n`;
                }

                if (card.sub && card.sub.length > 0) {
                  output += `Subs: ${card.sub.join(', ')}\n`;
                }

                if (card.dep && card.dep.length > 0) {
                  output += `Deps: ${card.dep.join(', ')}\n`;
                }

                if (card.comp) {
                  const compDate = new Date(card.comp);
                  const compMonth = compDate.toLocaleString('en-US', { month: 'short' });
                  const compDay = compDate.getDate();
                  const compTime = compDate.toLocaleString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  }).toLowerCase();
                  output += `Complete: ${compMonth} ${compDay} - ${compTime}\n`;
                }

                output += '\n';
              });
            }
          });

          return {
            content: [{ type: 'text', text: output }]
          };
        } else if (format === 'summary') {
          const data = formattedData;
          const date = new Date(data.last_updated);
          const month = date.toLocaleString('en-US', { month: 'short' });
          const day = date.getDate();
          const time = date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }).toLowerCase();

          const formattedDate = `${month} ${day} - ${time}`;

          let output = `Board: ${data.projectName}\n`;
          output += `Last Updated: ${formattedDate}\n\n`;
          output += `STATS:\n`;
          output += `Total Cards: ${data.stats.totalCards}\n`;
          output += `Completed: ${data.stats.completedCards} (${data.stats.progressPercentage}%)\n\n`;
          output += `COLUMNS:\n`;
          data.columns.forEach(column => {
            output += `${column.name}: ${column.cardCount} card(s)\n`;
          });

          return {
            content: [{ type: 'text', text: output }]
          };
        } else if (format === 'cards-only') {
          const data = {
            cards: board.data.cards
              .filter(card => !columnId || card.columnId === columnId)
              .map(card => ({
                id: card.id,
                title: card.title,
                content: card.content,
                columnId: card.columnId,
                position: card.position,
                dependencies: card.dependencies || [],
                created_at: card.created_at,
                updated_at: card.updated_at
              }))
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
          };
        } else {
          return {
            content: [{ type: 'text', text: JSON.stringify(formattedData, null, 2) }]
          };
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error retrieving board: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Update a board
  server.tool(
    'update-board',
    {
      // Allow string or object for boardData
      boardData: z.union([
        z.string().min(1, 'Board data string cannot be empty').max(1000000, 'Board data string too large'),
        z.object({}).passthrough() // Allow any object structure
      ])
    },
    async ({ boardData }) => {
      try {
        let parsedData;
        if (typeof boardData === 'string') {
          try {
            parsedData = JSON.parse(boardData);
          } catch (e) {
            return {
              content: [{ type: 'text', text: 'Error: Invalid JSON format for board data string' }],
              isError: true
            };
          }
        } else if (typeof boardData === 'object' && boardData !== null) {
          parsedData = boardData; // Use the object directly
        } else {
          return {
            content: [{ type: 'text', text: 'Error: Invalid board data type. Must be a JSON string or an object.' }],
            isError: true
          };
        }

        if (!parsedData.id) {
          return {
            content: [{ type: 'text', text: 'Error: Board ID is required when updating a board' }],
            isError: true
          };
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(parsedData.id)) {
          return {
            content: [{ type: 'text', text: 'Error: Invalid board ID format' }],
            isError: true
          };
        }

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
          console.error(`Error creating backup: ${error}`);
          throw error;
        }

        parsedData.created_at = existingBoard.data.created_at || new Date().toISOString();

        if (parsedData.cards && Array.isArray(parsedData.cards) && parsedData.columns && Array.isArray(parsedData.columns)) {
          const validColumnIds = new Set(parsedData.columns.map(column => column.id));

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

        if (!board.validate()) {
          return {
            content: [{ type: 'text', text: 'Error: Invalid board data format' }],
            isError: true
          };
        }

        if (parsedData.columns && parsedData.columns.length > 20) {
          return {
            content: [{ type: 'text', text: 'Error: Maximum number of columns (20) exceeded' }],
            isError: true
          };
        }

        if (parsedData.cards && Array.isArray(parsedData.cards)) {
          if (parsedData.cards.length > 1000) {
            return {
              content: [{ type: 'text', text: 'Error: Maximum number of cards (1000) exceeded' }],
              isError: true
            };
          }
        } else if (parsedData.columns) {
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
    {
      boardId: z.string().min(1, 'Board ID is required').uuid('Invalid board ID format')
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
    }
  );
}

module.exports = { registerBoardTools };
