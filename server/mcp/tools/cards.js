/**
 * MCP tools related to cards: get-card, update-card, move-card, batch-cards
 */

const Board = require('../../models/Board');
const { z } = require('zod');
const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto'); // Import crypto

function registerCardTools(server, { config, checkRateLimit }) {
  server.tool(
    'get-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to retrieve')
    },
    async ({ boardId, cardId }) => {
      try {
        checkRateLimit();
        const board = await Board.load(boardId);

        if (!board.data.cards || !Array.isArray(board.data.cards)) {
          return {
            content: [{ type: 'text', text: 'Error: Board is not using card-first architecture.' }],
            isError: true
          };
        }

        const card = board.data.cards.find(c => c.id === cardId);
        if (!card) {
          return {
            content: [{ type: 'text', text: `Error: Card with ID ${cardId} not found` }],
            isError: true
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(card, null, 2) }]
        };
      } catch (error) {
        console.error(`[get-card] Error: ${error}`);
        return {
          content: [{ type: 'text', text: `Error getting card: ${error.message}` }],
          isError: true
        };
      }
    },
    'Retrieves a specific card by its ID from a given board. Requires both board ID and card ID to locate the exact card.'
  );

  server.tool(
    'update-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to update'),
      // Allow string or object for cardData
      cardData: z.union([
        z.string().min(1, 'Card data string cannot be empty').max(200000, 'Card data string too large'),
        z.object({}).passthrough() // Allow any object structure
      ]).describe('Card data to update. Can be a JSON string or an object containing card details.')
    },
    async ({ boardId, cardId, cardData }) => {
      console.log(`[update-card] Invoked with boardId=${boardId}, cardId=${cardId}`);
      try {
        checkRateLimit();

        let parsedCardData;
        if (typeof cardData === 'string') {
          try {
            parsedCardData = JSON.parse(cardData);
          } catch {
            return {
              content: [{ type: 'text', text: 'Error: Invalid JSON format for card data string' }],
              isError: true
            };
          }
        } else if (typeof cardData === 'object' && cardData !== null) {
          parsedCardData = cardData; // Use the object directly
        } else {
          return {
            content: [{ type: 'text', text: 'Error: Invalid card data type. Must be a JSON string or an object.' }],
            isError: true
          };
        }

        const board = await Board.load(boardId);

        if (!board.data.cards || !Array.isArray(board.data.cards)) {
          console.log('[update-card] Board is not using card-first architecture');
          return {
            content: [{ type: 'text', text: 'Error: Board is not using card-first architecture.' }],
            isError: true
          };
        }

        const backupDir = path.join(config.boardsDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_card_update.json`);
        await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));

        const cardIndex = board.data.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) {
          return {
            content: [{ type: 'text', text: `Error: Card with ID ${cardId} not found` }],
            isError: true
          };
        }

        const existingCard = board.data.cards[cardIndex];

        if (parsedCardData.columnId && parsedCardData.columnId !== existingCard.columnId) {
          const newColExists = board.data.columns.some(c => c.id === parsedCardData.columnId);
          if (!newColExists) {
            return {
              content: [{ type: 'text', text: `Error: Target column ${parsedCardData.columnId} does not exist` }],
              isError: true
            };
          }
        }

        const updatedCard = {
          ...existingCard,
          ...parsedCardData,
          id: cardId,
          updated_at: new Date().toISOString()
        };

        board.data.cards[cardIndex] = updatedCard;

        await board.save();

        console.log('[update-card] Card updated successfully');
        return {
          content: [{ type: 'text', text: JSON.stringify(updatedCard, null, 2) }]
        };
      } catch (error) {
        console.error(`[update-card] Error: ${error}`);
        return {
          content: [{ type: 'text', text: `Error updating card: ${error.message}` }],
          isError: true
        };
      }
    },
    'Updates the properties of a specific card within a board. Allows partial or full card data updates, including moving to a different column.'
  );

  server.tool(
    'move-card',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('Unique identifier of the card to move'),
      columnId: z.string().min(1, 'Target column ID is required').describe('Unique identifier of the destination column'),
      position: z.union([
        z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
        z.enum(['first', 'last', 'up', 'down'])
      ]).describe('Position within the column. Can be a specific index, or keywords: first, last, up, down')
    },
    async ({ boardId, cardId, columnId, position }) => {
      console.log(`[move-card] Invoked with boardId=${boardId}, cardId=${cardId}, columnId=${columnId}, position=${position}`);
      try {
        checkRateLimit();

        const board = await Board.load(boardId);

        if (!board.data.cards || !Array.isArray(board.data.cards)) {
          console.log('[move-card] Board is not using card-first architecture');
          return {
            content: [{ type: 'text', text: 'Error: Board is not using card-first architecture.' }],
            isError: true
          };
        }

        const backupDir = path.join(config.boardsDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_card_move.json`);
        await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));

        const cardIndex = board.data.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) {
          return {
            content: [{ type: 'text', text: `Error: Card with ID ${cardId} not found` }],
            isError: true
          };
        }

        const card = board.data.cards[cardIndex];

        const targetColExists = board.data.columns.some(c => c.id === columnId);
        if (!targetColExists) {
          return {
            content: [{ type: 'text', text: `Error: Target column ${columnId} does not exist` }],
            isError: true
          };
        }

        const cardsInTarget = board.data.cards
          .filter(c => c.columnId === columnId && c.id !== cardId)
          .sort((a, b) => a.position - b.position);

        let newPos;
        if (typeof position === 'number') {
          newPos = position;
        } else {
          switch (position) {
            case 'first':
              newPos = 0;
              break;
            case 'last':
              newPos = cardsInTarget.length;
              break;
            case 'up':
              newPos = Math.max(0, card.position - 1);
              break;
            case 'down':
              newPos = card.position + 1;
              break;
            default:
              newPos = cardsInTarget.length;
          }
        }

        newPos = Math.min(newPos, cardsInTarget.length);

        // Adjust other cards' positions
        if (columnId === card.columnId) {
          board.data.cards.forEach(c => {
            if (c.id !== cardId && c.columnId === columnId) {
              if (card.position < newPos && c.position > card.position && c.position <= newPos) {
                c.position--;
              } else if (card.position > newPos && c.position >= newPos && c.position < card.position) {
                c.position++;
              }
            }
          });
        } else {
          board.data.cards.forEach(c => {
            if (c.id !== cardId && c.columnId === columnId && c.position >= newPos) {
              c.position++;
            }
          });
        }

        card.columnId = columnId;
        card.position = newPos;
        card.updated_at = new Date().toISOString();

        await board.save();

        console.log('[move-card] Card moved successfully');
        return {
          content: [{ type: 'text', text: JSON.stringify(card, null, 2) }]
        };
      } catch (error) {
        console.error(`[move-card] Error: ${error}`);
        return {
          content: [{ type: 'text', text: `Error moving card: ${error.message}` }],
          isError: true
        };
      }
    },
    'Moves a card to a different column and/or adjusts its position within that column. Supports precise positioning and relative movements.'
  );

  // Helper function to parse card data consistently
  const parseCardData = (cardData, context = '') => {
    if (typeof cardData === 'string') {
      try {
        return JSON.parse(cardData);
      } catch {
        throw new Error(`Invalid JSON format for card data string${context ? ` in ${context}` : ''}`);
      }
    } else if (typeof cardData === 'object' && cardData !== null) {
      return cardData;
    }
    throw new Error(`Invalid card data type${context ? ` in ${context}` : ''}. Must be a JSON string or an object.`);
  };

  // Helper function to validate column existence
  const validateColumn = (board, columnId, context = '') => {
    const colExists = board.data.columns.some(c => c.id === columnId);
    if (!colExists) {
      throw new Error(`Target column ${columnId} does not exist${context ? ` in ${context}` : ''}`);
    }
  };

  // Helper function to calculate new position
  const calculatePosition = (board, columnId, requestedPosition, currentCard = null, newCards = []) => {
    const cardsInColumn = [
      ...board.data.cards.filter(c => c.columnId === columnId && (!currentCard || c.id !== currentCard.id)),
      ...newCards.filter(nc => nc.columnId === columnId && (!currentCard || nc.id !== currentCard.id))
    ].sort((a, b) => a.position - b.position);

    if (typeof requestedPosition === 'number') {
      return Math.min(Math.max(0, requestedPosition), cardsInColumn.length);
    }

    switch (requestedPosition) {
      case 'first':
        return 0;
      case 'last':
        return cardsInColumn.length;
      case 'up':
        if (!currentCard || currentCard.columnId !== columnId) {
          throw new Error("Cannot use 'up' when moving to a different column");
        }
        return Math.max(0, currentCard.position - 1);
      case 'down':
        if (!currentCard || currentCard.columnId !== columnId) {
          throw new Error("Cannot use 'down' when moving to a different column");
        }
        return currentCard.position + 1;
      default:
        return cardsInColumn.length;
    }
  };

  server.tool(
    'batch-cards',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('Unique identifier of the board to perform batch operations'),
      operations: z.array(z.object({
        type: z.enum(['create', 'update', 'move']).describe('Type of operation to perform on a card'),
        cardId: z.string().min(1, 'Card ID is required for update/move').optional().describe('Unique identifier of the card to update or move'),
        cardData: z.union([
          z.string().min(1, 'Card data string cannot be empty').max(200000, 'Card data string too large'),
          z.object({}).passthrough()
        ]).optional().describe('Card data for create or update operations. When omitted for create, a default card will be created'),
        columnId: z.string().optional().describe('Target column ID for create or move operations. When omitted for create, first column will be used'),
        position: z.union([
          z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
          z.enum(['first', 'last', 'up', 'down'])
        ]).optional().describe('Position within the column for create or move operations'),
        reference: z.string().optional().describe('Optional reference ID to link cards within the same batch operation')
      })).min(1, 'At least one operation is required').max(100, 'Maximum 100 operations allowed').describe('Array of card operations to perform atomically'),
    },
    async ({ boardId, operations }) => {
      console.log(`[batch-cards] Invoked with boardId=${boardId}, ${operations.length} operations`);
      try {
        checkRateLimit();
        const board = await Board.load(boardId);

        if (!board.data.cards || !Array.isArray(board.data.cards)) {
          console.log('[batch-cards] Board is not using card-first architecture');
          return {
            content: [{ type: 'text', text: 'Error: Board is not using card-first architecture.' }],
            isError: true
          };
        }

        // Create backup
        const backupDir = path.join(config.boardsDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_batch.json`);
        await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));

        const results = [];
        const newCards = [];
        const referenceMap = new Map(); // Map reference IDs to actual card IDs

        // First pass: Process all create operations to build reference map
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          if (op.type === 'create') {
            try {
              // Generate ID and timestamp once for this operation
              const newCardId = crypto.randomUUID();
              const now = new Date().toISOString();
              
              // Default to first column if columnId is not provided
              let targetColumnId = op.columnId;
              if (!targetColumnId && board.data.columns && board.data.columns.length > 0) {
                targetColumnId = board.data.columns[0].id;
                console.log(`[batch-cards] No columnId provided, defaulting to first column: ${targetColumnId}`);
              } else if (!targetColumnId) {
                throw new Error("Could not determine a column ID - board has no columns");
              }
              
              // Validate the column exists
              validateColumn(board, targetColumnId, `create operation ${i + 1}`);
              
              // Create default cardData if not provided
              let parsedCardData;
              if (!op.cardData) {
                parsedCardData = {
                  title: `New Card ${newCardId.substring(0, 8)}`,
                  content: "",
                };
                console.log(`[batch-cards] No cardData provided, using default card title`);
              } else {
                parsedCardData = parseCardData(op.cardData, `create operation ${i + 1}`);
              }
              
              // Calculate position (default to last)
              const newPos = calculatePosition(
                board,
                targetColumnId,
                op.position || 'last',
                null,
                newCards
              );

              // Adjust positions
              board.data.cards.forEach(c => {
                if (c.columnId === targetColumnId && c.position >= newPos) {
                  c.position++;
                }
              });
              newCards.forEach(nc => {
                if (nc.columnId === targetColumnId && nc.position >= newPos) {
                  nc.position++;
                }
              });

              const newCard = {
                ...parsedCardData,
                id: newCardId,
                columnId: targetColumnId,
                position: newPos,
                created_at: now,
                updated_at: now
              };

              newCards.push(newCard);
              results.push({ type: 'create', cardId: newCardId, success: true });

              // Store reference if provided
              if (op.reference) {
                referenceMap.set(op.reference, newCardId);
              }
            } catch (error) {
              results.push({ 
                type: 'create',
                error: error.message,
                success: false,
                operation: i + 1
              });
              // Continue processing other operations
              continue;
            }
          }
        }

        // Second pass: Process update and move operations
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i];
          
          if (op.type === 'update' || op.type === 'move') {
            try {
              // Resolve card ID from reference if provided
              let effectiveCardId = op.cardId;
              if (op.cardId && op.cardId.startsWith('$ref:')) {
                const refId = op.cardId.substring(5);
                if (!referenceMap.has(refId)) {
                  throw new Error(`Referenced card '${refId}' not found or creation failed`);
                }
                effectiveCardId = referenceMap.get(refId);
              }

              if (!effectiveCardId) {
                throw new Error(`cardId is required for '${op.type}' operation`);
              }

              // Find the card (either in original board or newly created)
              let cardIndex = board.data.cards.findIndex(c => c.id === effectiveCardId);
              let card;
              let isNewCard = false;
              let newCardIdx = -1;

              if (cardIndex === -1) {
                newCardIdx = newCards.findIndex(nc => nc.id === effectiveCardId);
                if (newCardIdx === -1) {
                  throw new Error(`Card ${effectiveCardId} not found`);
                }
                card = newCards[newCardIdx];
                isNewCard = true;
              } else {
                card = board.data.cards[cardIndex];
              }

              if (op.type === 'update') {
                if (!op.cardData) {
                  throw new Error("cardData is required for 'update' operation");
                }

                const parsedCardData = parseCardData(op.cardData, `update operation ${i + 1}`);

                if (parsedCardData.columnId && parsedCardData.columnId !== card.columnId) {
                  validateColumn(board, parsedCardData.columnId, `update operation ${i + 1}`);
                }

                const updated = {
                  ...card,
                  ...parsedCardData,
                  id: effectiveCardId,
                  updated_at: new Date().toISOString()
                };

                if (isNewCard) {
                  newCards[newCardIdx] = updated;
                } else {
                  board.data.cards[cardIndex] = updated;
                }

                results.push({ type: 'update', cardId: effectiveCardId, success: true });

              } else if (op.type === 'move') {
                if (!op.columnId || op.position === undefined) {
                  throw new Error("columnId and position are required for 'move' operation");
                }

                validateColumn(board, op.columnId, `move operation ${i + 1}`);

                const newPos = calculatePosition(
                  board,
                  op.columnId,
                  op.position,
                  card,
                  newCards
                );

                // Handle position adjustments
                if (card.columnId !== op.columnId) {
                  // Moving to different column
                  board.data.cards.forEach(c => {
                    if (c.columnId === card.columnId && c.position > card.position) {
                      c.position--;
                    } else if (c.columnId === op.columnId && c.position >= newPos) {
                      c.position++;
                    }
                  });
                  newCards.forEach(nc => {
                    if (nc.columnId === card.columnId && nc.position > card.position) {
                      nc.position--;
                    } else if (nc.columnId === op.columnId && nc.position >= newPos) {
                      nc.position++;
                    }
                  });
                } else {
                  // Moving within same column
                  board.data.cards.forEach(c => {
                    if (c.id !== effectiveCardId && c.columnId === op.columnId) {
                      if (card.position < newPos && c.position > card.position && c.position <= newPos) {
                        c.position--;
                      } else if (card.position > newPos && c.position >= newPos && c.position < card.position) {
                        c.position++;
                      }
                    }
                  });
                  newCards.forEach(nc => {
                    if (nc.id !== effectiveCardId && nc.columnId === op.columnId) {
                      if (card.position < newPos && nc.position > card.position && nc.position <= newPos) {
                        nc.position--;
                      } else if (card.position > newPos && nc.position >= newPos && nc.position < card.position) {
                        nc.position++;
                      }
                    }
                  });
                }

                card.columnId = op.columnId;
                card.position = newPos;
                card.updated_at = new Date().toISOString();

                if (isNewCard) {
                  newCards[newCardIdx] = card;
                }

                results.push({ type: 'move', cardId: effectiveCardId, success: true });
              }
            } catch (error) {
              results.push({
                type: op.type,
                error: error.message,
                success: false,
                operation: i + 1
              });
              // Continue processing other operations
              continue;
            }
          }
        }

        // Add all newly created cards to the board data
        board.data.cards.push(...newCards);

        // Save changes
        await board.save();

        console.log('[batch-cards] Batch operations completed');
        
        // Create an enriched response with guidance
        const responseData = {
          // Original response data
          success: results.every(r => r.success),
          results,
          referenceMap: Object.fromEntries(referenceMap),
          
          // Add guidance without affecting the original format
          tips: {
            createCardExamples: {
              // Full example with all fields
              detailed: {
                type: 'create',
                columnId: board.data.columns[0]?.id || "column-id", 
                cardData: {
                  title: "New Card Title",
                  content: "Card content with **markdown** support",
                  subtasks: ["First subtask", "✓ Completed subtask"],
                  tags: ["example", "tag"],
                  priority: "high"
                }
              },
              
              // Minimal example (everything else auto-generated)
              minimal: {
                type: 'create'
                // Will create a card with auto-generated title in the first column
              },
              
              // Common pattern with just title and content
              simple: {
                type: 'create',
                cardData: {
                  title: "Simple Card",
                  content: "Just the essential information"
                }
              }
            },
            
            createCardNotes: [
              "Both columnId and cardData are now optional",
              "If columnId is omitted, first column will be used",
              "If cardData is omitted, a card with default title will be created",
              "Column ID must exist in the board if specified",
              "Card ID, timestamps, and position are auto-generated"
            ],
            
            updateCardExample: {
              type: 'update',
              cardId: "existing-card-id",
              cardData: {
                title: "Updated Card Title",
                content: "Updated content"
                // Can include any card property to update
              }
            },
            
            moveCardExample: {
              type: 'move',
              cardId: "existing-card-id",
              columnId: "target-column-id",
              position: "last" // Can be a number or "first", "last", "up", "down"
            },
            
            requiredCardFields: [
              "id (auto-generated for create operations)",
              "title",
              "columnId (must be a valid column ID in this board)",
              "position (0-indexed within column)",
              "created_at (auto-generated for create operations)",
              "updated_at (auto-set during operations)"
            ]
          }
        };
        
        return {
          content: [{ 
            type: 'text',
            text: JSON.stringify(responseData, null, 2)
          }]
        };
      } catch (error) {
        console.error(`[batch-cards] Error: ${error}`);
        return {
          content: [{ type: 'text', text: `Error processing batch: ${error.message}` }],
          isError: true
        };
      }
    },
    `Perform multiple card operations atomically in a single request.
     - Supports batch create, update, and move operations
     - Can reference newly created cards in subsequent operations
     - Provides detailed results for each operation
     - Maintains card and column positioning integrity
     - Allows complex multi-step card manipulations in one transaction`
  );

  // Query cards with advanced filtering and sorting
  server.tool(
    'query-cards',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('ID of the board containing the cards to query'),
      title: z.string().optional().describe('Filter cards by title (partial match)'),
      content: z.string().optional().describe('Filter cards by content (partial match)'),
      columnId: z.string().optional().describe('Filter cards by column ID'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter cards by priority level'),
      status: z.string().optional().describe('Filter cards by status'),
      assignee: z.string().optional().describe('Filter cards by assignee'),
      tags: z.array(z.string()).optional().describe('Filter cards containing any of these tags'),
      createdBefore: z.string().optional().describe('Filter cards created before this date (ISO format)'),
      createdAfter: z.string().optional().describe('Filter cards created after this date (ISO format)'),
      updatedBefore: z.string().optional().describe('Filter cards updated before this date (ISO format)'),
      updatedAfter: z.string().optional().describe('Filter cards updated after this date (ISO format)'),
      sortBy: z.enum(['title', 'priority', 'createdAt', 'updatedAt', 'status']).optional().describe('Property to sort by'),
      sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort order (ascending or descending)'),
      limit: z.number().int().positive().optional().describe('Maximum number of cards to return'),
      offset: z.number().int().min(0).optional().describe('Number of cards to skip')
    },
    async (params) => {
      try {
        checkRateLimit();
        
        const { boardId, ...query } = params;
        const board = await Board.load(boardId);

        if (!board.data.cards || !Array.isArray(board.data.cards)) {
          return {
            content: [{ type: 'text', text: 'Error: Board is not using card-first architecture.' }],
            isError: true
          };
        }

        // Start with all cards from the board
        let cards = [...board.data.cards];

        // Apply filters
        if (query.title) {
          cards = cards.filter(card => 
            card.title.toLowerCase().includes(query.title.toLowerCase())
          );
        }

        if (query.content) {
          cards = cards.filter(card => 
            card.content && card.content.toLowerCase().includes(query.content.toLowerCase())
          );
        }

        if (query.columnId) {
          cards = cards.filter(card => card.columnId === query.columnId);
        }

        if (query.priority) {
          cards = cards.filter(card => card.priority === query.priority);
        }

        if (query.status) {
          cards = cards.filter(card => card.status === query.status);
        }

        if (query.assignee) {
          cards = cards.filter(card => card.assignee === query.assignee);
        }

        if (query.tags && query.tags.length > 0) {
          cards = cards.filter(card => 
            card.tags && query.tags.some(tag => card.tags.includes(tag))
          );
        }

        if (query.createdAfter) {
          const date = new Date(query.createdAfter);
          cards = cards.filter(card => new Date(card.created_at) >= date);
        }

        if (query.createdBefore) {
          const date = new Date(query.createdBefore);
          cards = cards.filter(card => new Date(card.created_at) <= date);
        }

        if (query.updatedAfter) {
          const date = new Date(query.updatedAfter);
          cards = cards.filter(card => new Date(card.updated_at) >= date);
        }

        if (query.updatedBefore) {
          const date = new Date(query.updatedBefore);
          cards = cards.filter(card => new Date(card.updated_at) <= date);
        }

        // Apply sorting
        if (query.sortBy) {
          const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
          cards.sort((a, b) => {
            if (query.sortBy === 'title') {
              return sortOrder * a.title.localeCompare(b.title);
            } else if (query.sortBy === 'priority') {
              const priorityValues = { low: 0, medium: 1, high: 2 };
              return sortOrder * (priorityValues[a.priority] - priorityValues[b.priority]);
            } else if (query.sortBy === 'createdAt') {
              return sortOrder * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            } else if (query.sortBy === 'updatedAt') {
              return sortOrder * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
            } else if (query.sortBy === 'status') {
              return sortOrder * (a.status || '').localeCompare(b.status || '');
            }
            return 0;
          });
        }

        // Apply pagination
        if (query.offset !== undefined || query.limit !== undefined) {
          const offset = query.offset || 0;
          const limit = query.limit || cards.length;
          cards = cards.slice(offset, offset + limit);
        }

        // Enrich cards with column information
        const enrichedCards = cards.map(card => {
          const column = board.data.columns.find(col => col.id === card.columnId);
          return {
            ...card,
            columnName: column ? column.name : 'Unknown Column'
          };
        });

        const responseData = {
          success: true,
          data: {
            cards: enrichedCards,
            count: enrichedCards.length,
            boardId,
            query
          },
          help: `Found ${enrichedCards.length} cards matching your query. You can refine your search using additional filters.`
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in query-cards tool:', error);
        return {
          content: [{ type: 'text', text: `Error querying cards: ${error.message}` }],
          isError: true
        };
      }
    },
    'Search for cards within a board that match specific criteria. Filter by title, content, column, priority, status, assignee, or tags. Sort and paginate results.'
  );
}

module.exports = { registerCardTools };
