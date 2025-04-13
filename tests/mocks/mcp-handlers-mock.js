/**
 * Mock handlers for MCP tools testing
 * These implementations directly use the Board mock to provide consistent
 * behavior for both the MCP server tests and the token optimization tests
 */

// Load Board mock upfront to avoid circular dependencies
const Board = require('./board-mock');

// Mock direct handlers for MCP tools to test the token optimization features
// This avoids the complexity of the McpServer initialization for testing
const handlers = {
  'get-board': async ({ boardId, format = 'full', columnId }) => {
    try {
      const board = await Board.load(boardId);
      
      // Apply the format transformation
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
  },
  
  'get-card': async ({ boardId, cardId }) => {
    try {
      const board = await Board.load(boardId);
      
      // Check for card-first architecture (using direct property access)
      if (boardId === 'legacy-board') {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to retrieve card by ID.' 
          }],
          isError: true
        };
      }
      
      // Find the card (using direct property access)
      const card = board.cards.find(c => c.id === cardId);
      if (!card) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Card with ID ${cardId} not found` 
          }],
          isError: true
        };
      }
      
      // Add column name (using direct property access)
      const column = board.columns.find(col => col.id === card.columnId);
      const cardWithContext = {
        ...card,
        columnName: column ? column.name : 'Unknown'
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
  },
  
  'update-card': async ({ boardId, cardId, cardData }) => {
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
      
      const board = await Board.load(boardId);
      
      // Check for card-first architecture
      // For unit tests, pretend all boards are card-first
      if (boardId === 'legacy-board') {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to update card by ID.' 
          }],
          isError: true
        };
      }
      
      // Find the card (using direct property access)
      const cardIndex = board.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Card with ID ${cardId} not found` 
          }],
          isError: true
        };
      }
      
      // Get the existing card
      const existingCard = board.cards[cardIndex];
      
      // If changing column ID, verify the column exists
      if (parsedCardData.columnId && parsedCardData.columnId !== existingCard.columnId) {
        const columnExists = board.columns.some(col => col.id === parsedCardData.columnId);
        if (!columnExists) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error: Column with ID ${parsedCardData.columnId} does not exist` 
            }],
            isError: true
          };
        }
      }
      
      // Update the card - merge properties
      const updatedCard = {
        ...existingCard,
        ...parsedCardData,
        id: cardId,
        updated_at: new Date().toISOString()
      };
      
      // Validate the updated card
      if (!Board.validateItem(updatedCard)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid card data format' }],
          isError: true
        };
      }
      
      // Update the card in the board
      board.cards[cardIndex] = updatedCard;
      
      // Add completed_at for Done columns
      const isDoneColumn = board.columns
        .filter(column => column.name.toLowerCase() === 'done')
        .some(col => col.id === updatedCard.columnId);
      
      if (isDoneColumn && !updatedCard.completed_at) {
        updatedCard.completed_at = new Date().toISOString();
      } else if (!isDoneColumn) {
        updatedCard.completed_at = null;
      }
      
      // Save the board
      await board.save();
      
      // Add column name for response
      const column = board.columns.find(col => col.id === updatedCard.columnId);
      const responseCard = {
        ...updatedCard,
        columnName: column ? column.name : 'Unknown'
      };
      
      return {
        content: [{ type: 'text', text: JSON.stringify(responseCard, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error updating card: ${error.message}` }],
        isError: true
      };
    }
  },
  
  'move-card': async ({ boardId, cardId, columnId, position }) => {
    try {
      const board = await Board.load(boardId);
      
      // Check for card-first architecture
      if (boardId === 'legacy-board') {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to move card by ID.' 
          }],
          isError: true
        };
      }
      
      // Find the card (using direct property access)
      const cardIndex = board.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Card with ID ${cardId} not found` 
          }],
          isError: true
        };
      }
      
      // Check if target column exists
      const columnExists = board.columns.some(col => col.id === columnId);
      if (!columnExists) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error: Column with ID ${columnId} does not exist` 
          }],
          isError: true
        };
      }
      
      // Get the card and original data
      const card = board.cards[cardIndex];
      const originalColumnId = card.columnId;
      const originalPosition = card.position;
      
      // Calculate target position
      let targetPosition;
      if (typeof position === 'number') {
        targetPosition = position;
      } else if (position === 'first') {
        targetPosition = 0;
      } else if (position === 'last') {
        const cardsInColumn = board.cards.filter(c => c.columnId === columnId && c.id !== cardId);
        targetPosition = cardsInColumn.length;
      } else if (position === 'up' && originalColumnId === columnId) {
        targetPosition = Math.max(0, originalPosition - 1);
      } else if (position === 'down' && originalColumnId === columnId) {
        targetPosition = originalPosition + 1;
      } else {
        // Default for any other case
        targetPosition = 0;
      }
      
      // Update positions of other cards
      board.cards.forEach(otherCard => {
        if (otherCard.id !== cardId) {
          if (columnId === originalColumnId) {
            // Moving within the same column
            if (originalPosition < targetPosition) {
              // Moving card down - cards in between shift up
              if (otherCard.columnId === columnId && 
                  otherCard.position > originalPosition && 
                  otherCard.position <= targetPosition) {
                otherCard.position--;
              }
            } else if (originalPosition > targetPosition) {
              // Moving card up - cards in between shift down
              if (otherCard.columnId === columnId && 
                  otherCard.position >= targetPosition && 
                  otherCard.position < originalPosition) {
                otherCard.position++;
              }
            }
          } else if (otherCard.columnId === columnId && otherCard.position >= targetPosition) {
            // Moving to a different column - shift positions in target column
            otherCard.position++;
          }
        }
      });
      
      // Check if the card is moving to a Done column
      const isDoneColumn = board.columns
        .filter(column => column.name.toLowerCase() === 'done')
        .some(col => col.id === columnId);
      
      // Update the card
      card.columnId = columnId;
      card.position = targetPosition;
      card.updated_at = new Date().toISOString();
      
      if (isDoneColumn && !card.completed_at) {
        card.completed_at = new Date().toISOString();
      } else if (!isDoneColumn) {
        card.completed_at = null;
      }
      
      // Save the board
      await board.save();
      
      // Get column name for response
      const column = board.columns.find(col => col.id === columnId);
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            message: 'Card moved successfully',
            card: {
              id: cardId,
              columnId,
              columnName: column ? column.name : 'Unknown',
              position: targetPosition,
              updated_at: card.updated_at,
              completed_at: card.completed_at
            }
          }, null, 2) 
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error moving card: ${error.message}` }],
        isError: true
      };
    }
  },
  
  'batch-cards': async ({ boardId, operations }) => {
    try {
      const board = await Board.load(boardId);
      
      // Check for card-first architecture
      if (boardId === 'legacy-board') {
        return {
          content: [{ 
            type: 'text', 
            text: 'Error: Board is not using card-first architecture. Unable to batch process cards.' 
          }],
          isError: true
        };
      }
      
      // Validate all operations first
      for (const operation of operations) {
        const { type, cardId } = operation;
        
        if (!cardId) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error: cardId is required for all operations` 
            }],
            isError: true
          };
        }
        
        // Check if card exists
        const cardExists = board.cards.some(card => card.id === cardId);
        if (!cardExists) {
          return {
            content: [{ 
              type: 'text', 
              text: `Error: Card with ID ${cardId} not found` 
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
          
          if (operation.position === undefined) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: position is required for move operations (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
          
          // Check if target column exists
          const columnExists = board.columns.some(col => col.id === operation.columnId);
          if (!columnExists) {
            return {
              content: [{ 
                type: 'text', 
                text: `Error: Column with ID ${operation.columnId} does not exist (cardId: ${cardId})` 
              }],
              isError: true
            };
          }
        }
      }
      
      // Process all operations
      const results = [];
      
      for (const operation of operations) {
        const { type, cardId } = operation;
        
        if (type === 'update') {
          // Handle update operation
          const parsedCardData = JSON.parse(operation.cardData);
          const cardIndex = board.cards.findIndex(card => card.id === cardId);
          const existingCard = board.cards[cardIndex];
          
          // Update the card
          const updatedCard = {
            ...existingCard,
            ...parsedCardData,
            id: cardId,
            updated_at: new Date().toISOString()
          };
          
          // Update the card in the board
          board.cards[cardIndex] = updatedCard;
          
          // Get column name for response
          const column = board.columns.find(col => col.id === updatedCard.columnId);
          
          results.push({
            type: 'update',
            cardId,
            success: true,
            data: { 
              ...updatedCard,
              columnName: column ? column.name : 'Unknown'
            }
          });
        } else if (type === 'move') {
          // Handle move operation
          const { columnId, position } = operation;
          const cardIndex = board.cards.findIndex(card => card.id === cardId);
          const card = board.cards[cardIndex];
          const originalColumnId = card.columnId;
          const originalPosition = card.position;
          
          // Calculate target position
          let targetPosition;
          if (typeof position === 'number') {
            targetPosition = position;
          } else if (position === 'first') {
            targetPosition = 0;
          } else if (position === 'last') {
            const cardsInColumn = board.cards.filter(c => c.columnId === columnId && c.id !== cardId);
            targetPosition = cardsInColumn.length;
          } else if (position === 'up' && originalColumnId === columnId) {
            targetPosition = Math.max(0, originalPosition - 1);
          } else if (position === 'down' && originalColumnId === columnId) {
            targetPosition = originalPosition + 1;
          } else {
            // Default
            targetPosition = 0;
          }
          
          // Update the card
          card.columnId = columnId;
          card.position = targetPosition;
          card.updated_at = new Date().toISOString();
          
          // Check if moving to a Done column
          const isDoneColumn = board.columns
            .filter(column => column.name.toLowerCase() === 'done')
            .some(col => col.id === columnId);
          
          if (isDoneColumn && !card.completed_at) {
            card.completed_at = new Date().toISOString();
          } else if (!isDoneColumn) {
            card.completed_at = null;
          }
          
          // Get column name for response
          const column = board.columns.find(col => col.id === columnId);
          
          results.push({
            type: 'move',
            cardId,
            success: true,
            data: {
              id: cardId,
              columnId,
              columnName: column ? column.name : 'Unknown',
              position: targetPosition,
              updated_at: card.updated_at,
              completed_at: card.completed_at
            }
          });
        }
      }
      
      // Save the board after all operations
      await board.save();
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            success: true,
            message: `Successfully processed ${operations.length} operations`,
            results: results
          }, null, 2) 
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error processing batch operations: ${error.message}` }],
        isError: true
      };
    }
  }
};

module.exports = { handlers };