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
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required')
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
    'Get a specific card by ID.'
  );

  server.tool(
    'update-card',
    {
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required'),
      // Allow string or object for cardData
      cardData: z.union([
        z.string().min(1, 'Card data string cannot be empty').max(200000, 'Card data string too large'),
        z.object({}).passthrough() // Allow any object structure
      ])
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
    'Update properties of a specific card by ID.'
  );

  server.tool(
    'move-card',
    {
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required'),
      columnId: z.string().min(1, 'Target column ID is required'),
      position: z.union([
        z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
        z.enum(['first', 'last', 'up', 'down'])
      ])
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
    'Move a card to a different column or position within a board.'
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
      boardId: z.string().min(1, 'Board ID is required'),
      operations: z.array(z.object({
        type: z.enum(['create', 'update', 'move']),
        cardId: z.string().min(1, 'Card ID is required for update/move').optional(),
        cardData: z.union([
          z.string().min(1, 'Card data string cannot be empty').max(200000, 'Card data string too large'),
          z.object({}).passthrough()
        ]).optional(),
        columnId: z.string().optional(),
        position: z.union([
          z.number().int('Position must be an integer').min(0, 'Position must be non-negative'),
          z.enum(['first', 'last', 'up', 'down'])
        ]).optional(),
        reference: z.string().optional() // Allow referencing cards created in same batch
      })).min(1, 'At least one operation is required').max(100, 'Maximum 100 operations allowed')
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
              if (!op.cardData || !op.columnId) {
                throw new Error("cardData and columnId are required for 'create' operation");
              }

              const parsedCardData = parseCardData(op.cardData, `create operation ${i + 1}`);
              validateColumn(board, op.columnId, `create operation ${i + 1}`);

              const newCardId = crypto.randomUUID();
              const now = new Date().toISOString();

              // Calculate position
              const newPos = calculatePosition(
                board,
                op.columnId,
                op.position || 'last',
                null,
                newCards
              );

              // Adjust positions
              board.data.cards.forEach(c => {
                if (c.columnId === op.columnId && c.position >= newPos) {
                  c.position++;
                }
              });
              newCards.forEach(nc => {
                if (nc.columnId === op.columnId && nc.position >= newPos) {
                  nc.position++;
                }
              });

              const newCard = {
                ...parsedCardData,
                id: newCardId,
                columnId: op.columnId,
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
        return {
          content: [{ 
            type: 'text',
            text: JSON.stringify({
              success: results.every(r => r.success),
              results,
              referenceMap: Object.fromEntries(referenceMap)
            }, null, 2)
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
    `Batch create, update, and move multiple cards atomically.
     - For 'create': Omit cardId, provide type='create', cardData (JSON string), columnId, optional position ('first', 'last', or index), and optional 'reference' to identify the card in subsequent operations.
     - For 'update': Provide cardId (or $ref:reference), type='update', and cardData (JSON string).
     - For 'move': Provide cardId (or $ref:reference), type='move', columnId, and position ('first', 'last', 'up', 'down', or index).
     - Use $ref:reference to reference cards created earlier in the batch (e.g. cardId: '$ref:newCard1').
     - Operations continue processing on error, with detailed per-operation results returned.`
  );
}

module.exports = { registerCardTools };
