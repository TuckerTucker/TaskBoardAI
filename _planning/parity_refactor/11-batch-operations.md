# 11 - Batch Operations

This document outlines the implementation of batch operations for the TaskBoardAI application. Batch operations allow users to perform multiple operations in a single request, improving efficiency and enabling advanced workflows across all interfaces.

## Overview

Batch operations are essential for efficiently managing large boards or performing complex operations that require multiple steps. They reduce network overhead, ensure atomicity for related changes, and enable more advanced automation capabilities. This implementation will provide batch operation support across all interfaces:

- MCP (Model Context Protocol)
- REST API 
- CLI

## Implementation Steps

### 1. Batch Operation Schema Definitions

First, we'll define schemas for batch operations using Zod. These schemas will validate batch operation requests and ensure consistency.

```typescript
// src/schemas/batchSchemas.ts
import { z } from 'zod';
import { 
  CardSchema, 
  ColumnSchema, 
  BoardSchema,
  CardCreateSchema,
  CardUpdateSchema,
  ColumnCreateSchema,
  ColumnUpdateSchema 
} from './entitySchemas';

// Card batch operation schemas
export const CardBatchCreateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnId: z.string().uuid("Column ID must be a valid UUID"),
  cards: z.array(CardCreateSchema).min(1, "At least one card must be provided")
});

export const CardBatchUpdateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  updates: z.array(z.object({
    id: z.string().uuid("Card ID must be a valid UUID"),
    columnId: z.string().uuid("Column ID must be a valid UUID").optional(),
    updates: CardUpdateSchema
  })).min(1, "At least one card update must be provided")
});

export const CardBatchDeleteSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  cards: z.array(z.object({
    id: z.string().uuid("Card ID must be a valid UUID"),
    columnId: z.string().uuid("Column ID must be a valid UUID")
  })).min(1, "At least one card must be provided")
});

export const CardBatchMoveSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  moves: z.array(z.object({
    id: z.string().uuid("Card ID must be a valid UUID"),
    sourceColumnId: z.string().uuid("Source column ID must be a valid UUID"),
    targetColumnId: z.string().uuid("Target column ID must be a valid UUID"),
    position: z.number().int().nonnegative().optional()
  })).min(1, "At least one card move must be provided")
});

// Column batch operation schemas
export const ColumnBatchCreateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columns: z.array(ColumnCreateSchema).min(1, "At least one column must be provided")
});

export const ColumnBatchUpdateSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  updates: z.array(z.object({
    id: z.string().uuid("Column ID must be a valid UUID"),
    updates: ColumnUpdateSchema
  })).min(1, "At least one column update must be provided")
});

export const ColumnBatchDeleteSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnIds: z.array(z.string().uuid("Column ID must be a valid UUID")).min(1, "At least one column ID must be provided")
});

export const ColumnReorderSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnOrder: z.array(z.string().uuid("Column ID must be a valid UUID"))
});

// Batch operation result schemas
export const BatchResultSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    success: z.boolean(),
    data: z.any().optional(),
    error: z.any().optional()
  })),
  totalCount: z.number(),
  successCount: z.number(),
  failureCount: z.number()
});

// Export types
export type CardBatchCreate = z.infer<typeof CardBatchCreateSchema>;
export type CardBatchUpdate = z.infer<typeof CardBatchUpdateSchema>;
export type CardBatchDelete = z.infer<typeof CardBatchDeleteSchema>;
export type CardBatchMove = z.infer<typeof CardBatchMoveSchema>;
export type ColumnBatchCreate = z.infer<typeof ColumnBatchCreateSchema>;
export type ColumnBatchUpdate = z.infer<typeof ColumnBatchUpdateSchema>;
export type ColumnBatchDelete = z.infer<typeof ColumnBatchDeleteSchema>;
export type ColumnReorder = z.infer<typeof ColumnReorderSchema>;
export type BatchResult = z.infer<typeof BatchResultSchema>;
```

### 2. Service Layer Enhancements

Update the service layer to support batch operations.

```typescript
// src/services/CardService.ts - addition to existing methods
export class CardService {
  // ... existing methods
  
  async batchCreateCards(batchCreate: CardBatchCreate): Promise<BatchResult> {
    try {
      // Validate the batch create request
      const validatedBatchCreate = CardBatchCreateSchema.parse(batchCreate);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchCreate.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchCreate.boardId} not found`);
      }
      
      // Find the column
      const column = board.columns.find(col => col.id === validatedBatchCreate.columnId);
      if (!column) {
        throw new NotFoundError(`Column with ID ${validatedBatchCreate.columnId} not found in board ${validatedBatchCreate.boardId}`);
      }
      
      // Create cards and track results
      const results = [];
      let successCount = 0;
      
      for (const cardData of validatedBatchCreate.cards) {
        try {
          // Create a new card
          const newCard: Card = {
            id: uuidv4(),
            title: cardData.title,
            content: cardData.content || '',
            priority: cardData.priority || 'medium',
            status: cardData.status || 'pending',
            assignee: cardData.assignee || '',
            tags: cardData.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Add card to the column
          column.cards.push(newCard);
          
          // Add success result
          results.push({
            id: newCard.id,
            success: true,
            data: newCard
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: 'error',
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchCreate.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchCreate.cards.length,
        successCount,
        failureCount: validatedBatchCreate.cards.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch create cards request', error);
      }
      throw error;
    }
  }
  
  async batchUpdateCards(batchUpdate: CardBatchUpdate): Promise<BatchResult> {
    try {
      // Validate the batch update request
      const validatedBatchUpdate = CardBatchUpdateSchema.parse(batchUpdate);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchUpdate.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchUpdate.boardId} not found`);
      }
      
      // Update cards and track results
      const results = [];
      let successCount = 0;
      
      for (const updateItem of validatedBatchUpdate.updates) {
        try {
          // Find the column containing the card
          let column = board.columns.find(col => 
            col.cards.some(card => card.id === updateItem.id)
          );
          
          if (!column) {
            throw new NotFoundError(`Card with ID ${updateItem.id} not found in board ${validatedBatchUpdate.boardId}`);
          }
          
          // Find the card
          let cardIndex = column.cards.findIndex(card => card.id === updateItem.id);
          let card = column.cards[cardIndex];
          
          // If card is being moved to a different column
          if (updateItem.columnId && updateItem.columnId !== column.id) {
            // Find the target column
            const targetColumn = board.columns.find(col => col.id === updateItem.columnId);
            if (!targetColumn) {
              throw new NotFoundError(`Target column with ID ${updateItem.columnId} not found in board ${validatedBatchUpdate.boardId}`);
            }
            
            // Remove card from current column
            column.cards.splice(cardIndex, 1);
            
            // Update the card with the provided updates
            card = {
              ...card,
              ...updateItem.updates,
              updatedAt: new Date().toISOString()
            };
            
            // Add card to the target column
            targetColumn.cards.push(card);
          } else {
            // Update the card in place
            card = {
              ...card,
              ...updateItem.updates,
              updatedAt: new Date().toISOString()
            };
            
            // Replace the card in the column
            column.cards[cardIndex] = card;
          }
          
          // Add success result
          results.push({
            id: card.id,
            success: true,
            data: card
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: updateItem.id,
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchUpdate.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchUpdate.updates.length,
        successCount,
        failureCount: validatedBatchUpdate.updates.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch update cards request', error);
      }
      throw error;
    }
  }
  
  async batchDeleteCards(batchDelete: CardBatchDelete): Promise<BatchResult> {
    try {
      // Validate the batch delete request
      const validatedBatchDelete = CardBatchDeleteSchema.parse(batchDelete);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchDelete.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchDelete.boardId} not found`);
      }
      
      // Delete cards and track results
      const results = [];
      let successCount = 0;
      
      for (const cardInfo of validatedBatchDelete.cards) {
        try {
          // Find the column
          const column = board.columns.find(col => col.id === cardInfo.columnId);
          if (!column) {
            throw new NotFoundError(`Column with ID ${cardInfo.columnId} not found in board ${validatedBatchDelete.boardId}`);
          }
          
          // Find the card
          const cardIndex = column.cards.findIndex(card => card.id === cardInfo.id);
          if (cardIndex === -1) {
            throw new NotFoundError(`Card with ID ${cardInfo.id} not found in column ${cardInfo.columnId}`);
          }
          
          // Remove the card
          const deletedCard = column.cards.splice(cardIndex, 1)[0];
          
          // Add success result
          results.push({
            id: cardInfo.id,
            success: true,
            data: { deleted: true, card: deletedCard }
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: cardInfo.id,
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchDelete.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchDelete.cards.length,
        successCount,
        failureCount: validatedBatchDelete.cards.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch delete cards request', error);
      }
      throw error;
    }
  }
  
  async batchMoveCards(batchMove: CardBatchMove): Promise<BatchResult> {
    try {
      // Validate the batch move request
      const validatedBatchMove = CardBatchMoveSchema.parse(batchMove);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchMove.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchMove.boardId} not found`);
      }
      
      // Move cards and track results
      const results = [];
      let successCount = 0;
      
      for (const moveInfo of validatedBatchMove.moves) {
        try {
          // Find the source column
          const sourceColumn = board.columns.find(col => col.id === moveInfo.sourceColumnId);
          if (!sourceColumn) {
            throw new NotFoundError(`Source column with ID ${moveInfo.sourceColumnId} not found in board ${validatedBatchMove.boardId}`);
          }
          
          // Find the target column
          const targetColumn = board.columns.find(col => col.id === moveInfo.targetColumnId);
          if (!targetColumn) {
            throw new NotFoundError(`Target column with ID ${moveInfo.targetColumnId} not found in board ${validatedBatchMove.boardId}`);
          }
          
          // Find the card in the source column
          const cardIndex = sourceColumn.cards.findIndex(card => card.id === moveInfo.id);
          if (cardIndex === -1) {
            throw new NotFoundError(`Card with ID ${moveInfo.id} not found in column ${moveInfo.sourceColumnId}`);
          }
          
          // Remove the card from the source column
          const card = sourceColumn.cards.splice(cardIndex, 1)[0];
          
          // Update the card's updated timestamp
          card.updatedAt = new Date().toISOString();
          
          // Add the card to the target column
          if (moveInfo.position !== undefined) {
            // Insert at the specified position
            targetColumn.cards.splice(moveInfo.position, 0, card);
          } else {
            // Add to the end
            targetColumn.cards.push(card);
          }
          
          // Add success result
          results.push({
            id: moveInfo.id,
            success: true,
            data: { 
              card,
              sourceColumnId: moveInfo.sourceColumnId,
              targetColumnId: moveInfo.targetColumnId,
              position: moveInfo.position
            }
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: moveInfo.id,
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchMove.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchMove.moves.length,
        successCount,
        failureCount: validatedBatchMove.moves.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch move cards request', error);
      }
      throw error;
    }
  }
}

// src/services/ColumnService.ts - addition to existing methods
export class ColumnService {
  // ... existing methods
  
  async batchCreateColumns(batchCreate: ColumnBatchCreate): Promise<BatchResult> {
    try {
      // Validate the batch create request
      const validatedBatchCreate = ColumnBatchCreateSchema.parse(batchCreate);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchCreate.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchCreate.boardId} not found`);
      }
      
      // Create columns and track results
      const results = [];
      let successCount = 0;
      
      for (const columnData of validatedBatchCreate.columns) {
        try {
          // Create a new column
          const newColumn: Column = {
            id: uuidv4(),
            title: columnData.title,
            cards: []
          };
          
          // Add column to the board
          board.columns.push(newColumn);
          
          // Add success result
          results.push({
            id: newColumn.id,
            success: true,
            data: newColumn
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: 'error',
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchCreate.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchCreate.columns.length,
        successCount,
        failureCount: validatedBatchCreate.columns.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch create columns request', error);
      }
      throw error;
    }
  }
  
  async batchUpdateColumns(batchUpdate: ColumnBatchUpdate): Promise<BatchResult> {
    try {
      // Validate the batch update request
      const validatedBatchUpdate = ColumnBatchUpdateSchema.parse(batchUpdate);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchUpdate.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchUpdate.boardId} not found`);
      }
      
      // Update columns and track results
      const results = [];
      let successCount = 0;
      
      for (const updateItem of validatedBatchUpdate.updates) {
        try {
          // Find the column
          const columnIndex = board.columns.findIndex(col => col.id === updateItem.id);
          if (columnIndex === -1) {
            throw new NotFoundError(`Column with ID ${updateItem.id} not found in board ${validatedBatchUpdate.boardId}`);
          }
          
          // Update the column
          const column = board.columns[columnIndex];
          board.columns[columnIndex] = {
            ...column,
            ...updateItem.updates
          };
          
          // Add success result
          results.push({
            id: updateItem.id,
            success: true,
            data: board.columns[columnIndex]
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: updateItem.id,
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchUpdate.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchUpdate.updates.length,
        successCount,
        failureCount: validatedBatchUpdate.updates.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch update columns request', error);
      }
      throw error;
    }
  }
  
  async batchDeleteColumns(batchDelete: ColumnBatchDelete): Promise<BatchResult> {
    try {
      // Validate the batch delete request
      const validatedBatchDelete = ColumnBatchDeleteSchema.parse(batchDelete);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedBatchDelete.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedBatchDelete.boardId} not found`);
      }
      
      // Delete columns and track results
      const results = [];
      let successCount = 0;
      
      for (const columnId of validatedBatchDelete.columnIds) {
        try {
          // Find the column
          const columnIndex = board.columns.findIndex(col => col.id === columnId);
          if (columnIndex === -1) {
            throw new NotFoundError(`Column with ID ${columnId} not found in board ${validatedBatchDelete.boardId}`);
          }
          
          // Remove the column
          const deletedColumn = board.columns.splice(columnIndex, 1)[0];
          
          // Add success result
          results.push({
            id: columnId,
            success: true,
            data: { deleted: true, column: deletedColumn }
          });
          
          successCount++;
        } catch (error) {
          // Add failure result
          results.push({
            id: columnId,
            success: false,
            error: formatError(error)
          });
        }
      }
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedBatchDelete.boardId, board);
      
      // Return batch operation result
      return {
        success: successCount > 0,
        results,
        totalCount: validatedBatchDelete.columnIds.length,
        successCount,
        failureCount: validatedBatchDelete.columnIds.length - successCount
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid batch delete columns request', error);
      }
      throw error;
    }
  }
  
  async reorderColumns(reorderData: ColumnReorder): Promise<Board> {
    try {
      // Validate the reorder request
      const validatedReorderData = ColumnReorderSchema.parse(reorderData);
      
      // Get the board
      const board = await this.boardRepository.getBoardById(validatedReorderData.boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${validatedReorderData.boardId} not found`);
      }
      
      // Ensure all column IDs are valid and present in the board
      const columnIds = new Set(board.columns.map(col => col.id));
      for (const id of validatedReorderData.columnOrder) {
        if (!columnIds.has(id)) {
          throw new NotFoundError(`Column with ID ${id} not found in board ${validatedReorderData.boardId}`);
        }
      }
      
      // Ensure all columns are in the reorder list
      if (validatedReorderData.columnOrder.length !== board.columns.length) {
        throw new ValidationError('Reorder list must contain all columns in the board');
      }
      
      // Create a map of columns by ID
      const columnsById = new Map(board.columns.map(col => [col.id, col]));
      
      // Reorder the columns
      const reorderedColumns = validatedReorderData.columnOrder.map(id => columnsById.get(id)!);
      board.columns = reorderedColumns;
      
      // Save the updated board
      await this.boardRepository.updateBoard(validatedReorderData.boardId, board);
      
      return board;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid column reorder request', error);
      }
      throw error;
    }
  }
}

// Helper function for formatting errors
function formatError(error: any): any {
  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.constructor.name
    };
  }
  return { message: String(error) };
}
```

### 3. MCP Interface Implementation

Update the MCP interface to provide batch operation capabilities to agents.

```typescript
// src/mcp/tools/cards.js - addition to existing methods
export const cardsTools = {
  // ... existing tools
  
  batchCreateCards: {
    description: "Create multiple cards in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "columnId", "cards"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board where cards will be created"
        },
        columnId: {
          type: "string",
          description: "ID of the column where cards will be added"
        },
        cards: {
          type: "array",
          description: "Array of card data objects to create",
          items: {
            type: "object",
            required: ["title"],
            properties: {
              title: {
                type: "string",
                description: "Card title"
              },
              content: {
                type: "string",
                description: "Card content/description"
              },
              priority: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Card priority level"
              },
              status: {
                type: "string",
                description: "Card status"
              },
              assignee: {
                type: "string",
                description: "Person assigned to the card"
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Tags associated with the card"
              }
            }
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        const result = await cardService.batchCreateCards(params);
        
        return {
          success: result.success,
          data: result,
          help: `Created ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  batchUpdateCards: {
    description: "Update multiple cards in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "updates"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the cards"
        },
        updates: {
          type: "array",
          description: "Array of card update objects",
          items: {
            type: "object",
            required: ["id", "updates"],
            properties: {
              id: {
                type: "string",
                description: "ID of the card to update"
              },
              columnId: {
                type: "string",
                description: "ID of the column to move the card to (if moving)"
              },
              updates: {
                type: "object",
                description: "Updates to apply to the card",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  priority: { 
                    type: "string",
                    enum: ["low", "medium", "high"]
                  },
                  status: { type: "string" },
                  assignee: { type: "string" },
                  tags: { 
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        const result = await cardService.batchUpdateCards(params);
        
        return {
          success: result.success,
          data: result,
          help: `Updated ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  batchDeleteCards: {
    description: "Delete multiple cards in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "cards"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the cards"
        },
        cards: {
          type: "array",
          description: "Array of card identifiers to delete",
          items: {
            type: "object",
            required: ["id", "columnId"],
            properties: {
              id: {
                type: "string",
                description: "ID of the card to delete"
              },
              columnId: {
                type: "string",
                description: "ID of the column containing the card"
              }
            }
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        const result = await cardService.batchDeleteCards(params);
        
        return {
          success: result.success,
          data: result,
          help: `Deleted ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  batchMoveCards: {
    description: "Move multiple cards between columns in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "moves"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the cards"
        },
        moves: {
          type: "array",
          description: "Array of card move operations",
          items: {
            type: "object",
            required: ["id", "sourceColumnId", "targetColumnId"],
            properties: {
              id: {
                type: "string",
                description: "ID of the card to move"
              },
              sourceColumnId: {
                type: "string",
                description: "ID of the column currently containing the card"
              },
              targetColumnId: {
                type: "string",
                description: "ID of the column to move the card to"
              },
              position: {
                type: "integer",
                description: "Position to insert the card at in the target column (0-based index)"
              }
            }
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        const result = await cardService.batchMoveCards(params);
        
        return {
          success: result.success,
          data: result,
          help: `Moved ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  }
};

// src/mcp/tools/columns.js - addition to existing methods
export const columnsTools = {
  // ... existing tools
  
  batchCreateColumns: {
    description: "Create multiple columns in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "columns"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board where columns will be created"
        },
        columns: {
          type: "array",
          description: "Array of column data objects to create",
          items: {
            type: "object",
            required: ["title"],
            properties: {
              title: {
                type: "string",
                description: "Column title"
              }
            }
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const columnService = serviceFactory.createColumnService();
        
        const result = await columnService.batchCreateColumns(params);
        
        return {
          success: result.success,
          data: result,
          help: `Created ${result.successCount} of ${result.totalCount} columns. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  batchUpdateColumns: {
    description: "Update multiple columns in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "updates"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the columns"
        },
        updates: {
          type: "array",
          description: "Array of column update objects",
          items: {
            type: "object",
            required: ["id", "updates"],
            properties: {
              id: {
                type: "string",
                description: "ID of the column to update"
              },
              updates: {
                type: "object",
                description: "Updates to apply to the column",
                properties: {
                  title: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const columnService = serviceFactory.createColumnService();
        
        const result = await columnService.batchUpdateColumns(params);
        
        return {
          success: result.success,
          data: result,
          help: `Updated ${result.successCount} of ${result.totalCount} columns. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  batchDeleteColumns: {
    description: "Delete multiple columns in a single operation",
    parameters: {
      type: "object",
      required: ["boardId", "columnIds"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the columns"
        },
        columnIds: {
          type: "array",
          description: "Array of column IDs to delete",
          items: {
            type: "string"
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const columnService = serviceFactory.createColumnService();
        
        const result = await columnService.batchDeleteColumns(params);
        
        return {
          success: result.success,
          data: result,
          help: `Deleted ${result.successCount} of ${result.totalCount} columns. ${result.failureCount} failed.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  reorderColumns: {
    description: "Reorder columns within a board",
    parameters: {
      type: "object",
      required: ["boardId", "columnOrder"],
      properties: {
        boardId: {
          type: "string",
          description: "ID of the board containing the columns"
        },
        columnOrder: {
          type: "array",
          description: "Array of column IDs in the desired order",
          items: {
            type: "string"
          }
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const columnService = serviceFactory.createColumnService();
        
        const board = await columnService.reorderColumns(params);
        
        return {
          success: true,
          data: {
            board,
            columnOrder: board.columns.map(col => col.id)
          },
          help: `Reordered ${board.columns.length} columns in board ${board.id}.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  }
};
```

### 4. REST API Implementation

Update the REST API to provide batch operation endpoints.

```typescript
// src/controllers/cardController.ts - addition to existing methods
export class CardController {
  // ... existing methods
  
  async batchCreateCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, columnId, cards } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const cardService = serviceFactory.createCardService();
      
      const result = await cardService.batchCreateCards({
        boardId,
        columnId,
        cards
      });
      
      return res.status(201).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async batchUpdateCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, updates } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const cardService = serviceFactory.createCardService();
      
      const result = await cardService.batchUpdateCards({
        boardId,
        updates
      });
      
      return res.status(200).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async batchDeleteCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, cards } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const cardService = serviceFactory.createCardService();
      
      const result = await cardService.batchDeleteCards({
        boardId,
        cards
      });
      
      return res.status(200).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async batchMoveCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, moves } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const cardService = serviceFactory.createCardService();
      
      const result = await cardService.batchMoveCards({
        boardId,
        moves
      });
      
      return res.status(200).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

// src/controllers/columnController.ts - addition to existing methods
export class ColumnController {
  // ... existing methods
  
  async batchCreateColumns(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, columns } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const columnService = serviceFactory.createColumnService();
      
      const result = await columnService.batchCreateColumns({
        boardId,
        columns
      });
      
      return res.status(201).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async batchUpdateColumns(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, updates } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const columnService = serviceFactory.createColumnService();
      
      const result = await columnService.batchUpdateColumns({
        boardId,
        updates
      });
      
      return res.status(200).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async batchDeleteColumns(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, columnIds } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const columnService = serviceFactory.createColumnService();
      
      const result = await columnService.batchDeleteColumns({
        boardId,
        columnIds
      });
      
      return res.status(200).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async reorderColumns(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId, columnOrder } = req.body;
      
      const serviceFactory = new ServiceFactory();
      const columnService = serviceFactory.createColumnService();
      
      const board = await columnService.reorderColumns({
        boardId,
        columnOrder
      });
      
      return res.status(200).json({
        success: true,
        data: {
          board,
          columnOrder: board.columns.map(col => col.id)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

// src/routes/cardRoutes.ts - addition to existing routes
router.post('/batch/create', cardController.batchCreateCards);
router.put('/batch/update', cardController.batchUpdateCards);
router.delete('/batch/delete', cardController.batchDeleteCards);
router.post('/batch/move', cardController.batchMoveCards);

// src/routes/columnRoutes.ts - addition to existing routes
router.post('/batch/create', columnController.batchCreateColumns);
router.put('/batch/update', columnController.batchUpdateColumns);
router.delete('/batch/delete', columnController.batchDeleteColumns);
router.post('/reorder', columnController.reorderColumns);
```

### 5. CLI Implementation

Update the CLI to provide batch operation commands.

```typescript
// src/cli/commands/cardCommands.ts - addition to existing commands
export function setupCardCommands(program: Command): void {
  // ... existing commands
  
  program
    .command('cards:batch-create')
    .description('Create multiple cards in a single operation')
    .requiredOption('--board <id>', 'ID of the board where cards will be created')
    .requiredOption('--column <id>', 'ID of the column where cards will be added')
    .requiredOption('--file <path>', 'Path to JSON file containing card data array')
    .action(async (options) => {
      try {
        // Read the JSON file
        const cardsData = JSON.parse(await fs.readFile(options.file, 'utf-8'));
        
        // Ensure it's an array
        if (!Array.isArray(cardsData)) {
          console.error(chalk.red('Error: File must contain a JSON array of card objects'));
          return;
        }
        
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        // Execute the batch create operation
        const result = await cardService.batchCreateCards({
          boardId: options.board,
          columnId: options.column,
          cards: cardsData
        });
        
        // Display results
        console.log(chalk.green(`Created ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`));
        
        if (result.failureCount > 0) {
          console.log(chalk.yellow('\nFailed operations:'));
          result.results
            .filter(r => !r.success)
            .forEach(r => {
              console.log(chalk.red(`- Error: ${r.error.message}`));
            });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  program
    .command('cards:batch-update')
    .description('Update multiple cards in a single operation')
    .requiredOption('--board <id>', 'ID of the board containing the cards')
    .requiredOption('--file <path>', 'Path to JSON file containing card update objects')
    .action(async (options) => {
      try {
        // Read the JSON file
        const updatesData = JSON.parse(await fs.readFile(options.file, 'utf-8'));
        
        // Ensure it's an array
        if (!Array.isArray(updatesData)) {
          console.error(chalk.red('Error: File must contain a JSON array of card update objects'));
          return;
        }
        
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        // Execute the batch update operation
        const result = await cardService.batchUpdateCards({
          boardId: options.board,
          updates: updatesData
        });
        
        // Display results
        console.log(chalk.green(`Updated ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`));
        
        if (result.failureCount > 0) {
          console.log(chalk.yellow('\nFailed operations:'));
          result.results
            .filter(r => !r.success)
            .forEach(r => {
              console.log(chalk.red(`- Card ID ${r.id}: ${r.error.message}`));
            });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  // Similar implementations for batch-delete and batch-move commands
  // ...
  
  program
    .command('cards:batch-move')
    .description('Move multiple cards between columns in a single operation')
    .requiredOption('--board <id>', 'ID of the board containing the cards')
    .requiredOption('--file <path>', 'Path to JSON file containing card move operations')
    .action(async (options) => {
      try {
        // Read the JSON file
        const movesData = JSON.parse(await fs.readFile(options.file, 'utf-8'));
        
        // Ensure it's an array
        if (!Array.isArray(movesData)) {
          console.error(chalk.red('Error: File must contain a JSON array of card move objects'));
          return;
        }
        
        const serviceFactory = new ServiceFactory();
        const cardService = serviceFactory.createCardService();
        
        // Execute the batch move operation
        const result = await cardService.batchMoveCards({
          boardId: options.board,
          moves: movesData
        });
        
        // Display results
        console.log(chalk.green(`Moved ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`));
        
        if (result.failureCount > 0) {
          console.log(chalk.yellow('\nFailed operations:'));
          result.results
            .filter(r => !r.success)
            .forEach(r => {
              console.log(chalk.red(`- Card ID ${r.id}: ${r.error.message}`));
            });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
}

// src/cli/commands/columnCommands.ts - addition to existing commands
export function setupColumnCommands(program: Command): void {
  // ... existing commands
  
  program
    .command('columns:batch-create')
    .description('Create multiple columns in a single operation')
    .requiredOption('--board <id>', 'ID of the board where columns will be created')
    .requiredOption('--file <path>', 'Path to JSON file containing column data array')
    .action(async (options) => {
      try {
        // Read the JSON file
        const columnsData = JSON.parse(await fs.readFile(options.file, 'utf-8'));
        
        // Ensure it's an array
        if (!Array.isArray(columnsData)) {
          console.error(chalk.red('Error: File must contain a JSON array of column objects'));
          return;
        }
        
        const serviceFactory = new ServiceFactory();
        const columnService = serviceFactory.createColumnService();
        
        // Execute the batch create operation
        const result = await columnService.batchCreateColumns({
          boardId: options.board,
          columns: columnsData
        });
        
        // Display results
        console.log(chalk.green(`Created ${result.successCount} of ${result.totalCount} columns. ${result.failureCount} failed.`));
        
        if (result.failureCount > 0) {
          console.log(chalk.yellow('\nFailed operations:'));
          result.results
            .filter(r => !r.success)
            .forEach(r => {
              console.log(chalk.red(`- Error: ${r.error.message}`));
            });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  // Similar implementations for batch-update and batch-delete commands
  // ...
  
  program
    .command('columns:reorder')
    .description('Reorder columns within a board')
    .requiredOption('--board <id>', 'ID of the board containing the columns')
    .requiredOption('--order <ids>', 'Comma-separated list of column IDs in the desired order')
    .action(async (options) => {
      try {
        const columnOrder = options.order.split(',').map(id => id.trim());
        
        const serviceFactory = new ServiceFactory();
        const columnService = serviceFactory.createColumnService();
        
        // Execute the reorder operation
        const board = await columnService.reorderColumns({
          boardId: options.board,
          columnOrder
        });
        
        // Display results
        console.log(chalk.green(`Reordered ${board.columns.length} columns in board ${board.id}.`));
        console.log(chalk.cyan('\nNew column order:'));
        board.columns.forEach((col, index) => {
          console.log(`${index + 1}. ${col.title} (${col.id})`);
        });
      } catch (error) {
        handleCliError(error);
      }
    });
}
```

### 6. Interactive CLI Batch Operations

Enhance the CLI with interactive batch operation capabilities.

```typescript
// src/cli/commands/interactiveBatchCommands.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ServiceFactory } from '../../services/ServiceFactory';
import { handleCliError } from '../utils/errorHandler';

export function setupInteractiveBatchCommands(program: Command): void {
  const batchCommand = program
    .command('batch')
    .description('Interactive batch operations');
  
  batchCommand
    .command('move-cards')
    .description('Interactively move multiple cards between columns')
    .requiredOption('--board <id>', 'ID of the board containing the cards')
    .action(async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const boardService = serviceFactory.createBoardService();
        const cardService = serviceFactory.createCardService();
        
        // Get the board
        const board = await boardService.getBoardById(options.board);
        
        // Get all columns for selection
        const columnChoices = board.columns.map(col => ({
          name: `${col.title} (${col.cards.length} cards)`,
          value: col.id
        }));
        
        // Select source column
        const sourceColumnAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'columnId',
            message: 'Select source column:',
            choices: columnChoices
          }
        ]);
        
        const sourceColumn = board.columns.find(col => col.id === sourceColumnAnswer.columnId);
        
        // If no cards in the column, exit
        if (sourceColumn.cards.length === 0) {
          console.log(chalk.yellow('No cards in the selected column.'));
          return;
        }
        
        // Select cards to move
        const cardChoices = sourceColumn.cards.map(card => ({
          name: card.title,
          value: card.id
        }));
        
        const cardSelectionAnswer = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'cardIds',
            message: 'Select cards to move:',
            choices: cardChoices,
            validate: (input) => input.length > 0 || 'Please select at least one card'
          }
        ]);
        
        // If no cards selected, exit
        if (cardSelectionAnswer.cardIds.length === 0) {
          console.log(chalk.yellow('No cards selected.'));
          return;
        }
        
        // Select target column (excluding source column)
        const targetColumnChoices = board.columns
          .filter(col => col.id !== sourceColumn.id)
          .map(col => ({
            name: col.title,
            value: col.id
          }));
        
        const targetColumnAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'columnId',
            message: 'Select target column:',
            choices: targetColumnChoices
          }
        ]);
        
        // Create the batch move operation
        const moves = cardSelectionAnswer.cardIds.map(cardId => ({
          id: cardId,
          sourceColumnId: sourceColumn.id,
          targetColumnId: targetColumnAnswer.columnId
        }));
        
        // Execute the batch move
        const result = await cardService.batchMoveCards({
          boardId: options.board,
          moves
        });
        
        // Display results
        console.log(chalk.green(`Moved ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`));
        
        if (result.failureCount > 0) {
          console.log(chalk.yellow('\nFailed operations:'));
          result.results
            .filter(r => !r.success)
            .forEach(r => {
              console.log(chalk.red(`- Card ID ${r.id}: ${r.error.message}`));
            });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  batchCommand
    .command('update-status')
    .description('Update status for multiple cards in a batch')
    .requiredOption('--board <id>', 'ID of the board containing the cards')
    .action(async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const boardService = serviceFactory.createBoardService();
        const cardService = serviceFactory.createCardService();
        
        // Get the board
        const board = await boardService.getBoardById(options.board);
        
        // Get all columns for selection
        const columnChoices = board.columns.map(col => ({
          name: `${col.title} (${col.cards.length} cards)`,
          value: col.id
        }));
        
        // Select column
        const columnAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'columnId',
            message: 'Select column containing cards:',
            choices: columnChoices
          }
        ]);
        
        const column = board.columns.find(col => col.id === columnAnswer.columnId);
        
        // If no cards in the column, exit
        if (column.cards.length === 0) {
          console.log(chalk.yellow('No cards in the selected column.'));
          return;
        }
        
        // Select cards to update
        const cardChoices = column.cards.map(card => ({
          name: `${card.title} (Status: ${card.status || 'none'})`,
          value: card.id
        }));
        
        const cardSelectionAnswer = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'cardIds',
            message: 'Select cards to update:',
            choices: cardChoices,
            validate: (input) => input.length > 0 || 'Please select at least one card'
          }
        ]);
        
        // If no cards selected, exit
        if (cardSelectionAnswer.cardIds.length === 0) {
          console.log(chalk.yellow('No cards selected.'));
          return;
        }
        
        // Get new status
        const statusAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'status',
            message: 'Enter new status for selected cards:',
            validate: (input) => input.trim() !== '' || 'Status cannot be empty'
          }
        ]);
        
        // Create the batch update operation
        const updates = cardSelectionAnswer.cardIds.map(cardId => ({
          id: cardId,
          updates: {
            status: statusAnswer.status
          }
        }));
        
        // Execute the batch update
        const result = await cardService.batchUpdateCards({
          boardId: options.board,
          updates
        });
        
        // Display results
        console.log(chalk.green(`Updated status to "${statusAnswer.status}" for ${result.successCount} of ${result.totalCount} cards. ${result.failureCount} failed.`));
        
        if (result.failureCount > 0) {
          console.log(chalk.yellow('\nFailed operations:'));
          result.results
            .filter(r => !r.success)
            .forEach(r => {
              console.log(chalk.red(`- Card ID ${r.id}: ${r.error.message}`));
            });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  // Additional interactive batch commands
  // ...
  
  return batchCommand;
}

// Register the interactive batch commands
// In src/cli/index.ts
import { setupInteractiveBatchCommands } from './commands/interactiveBatchCommands';

// In the setupCli function
export function setupCli(): Command {
  // ... existing code
  
  // Register interactive batch commands
  setupInteractiveBatchCommands(program);
  
  return program;
}
```

## Testing Strategy

### Unit Tests

Create comprehensive unit tests for batch operations:

```typescript
// src/tests/unit/services/CardService.test.ts
describe('CardService - Batch Operations', () => {
  let cardService: CardService;
  let mockBoardRepository: jest.Mocked<BoardRepository>;
  
  beforeEach(() => {
    const mockBoard = {
      id: 'board-123',
      title: 'Test Board',
      columns: [
        {
          id: 'column-1',
          title: 'Column 1',
          cards: [
            { 
              id: 'card-1', 
              title: 'Card 1',
              content: 'Content 1',
              priority: 'medium',
              status: 'pending',
              assignee: '',
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 'column-2',
          title: 'Column 2',
          cards: []
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      settings: {}
    };
    
    mockBoardRepository = {
      getBoardById: jest.fn().mockResolvedValue(mockBoard),
      updateBoard: jest.fn().mockResolvedValue(mockBoard),
      // ... other methods
    } as any;
    
    cardService = new CardService(mockBoardRepository);
  });
  
  describe('batchCreateCards', () => {
    it('should create multiple cards in a single operation', async () => {
      const batchCreate = {
        boardId: 'board-123',
        columnId: 'column-1',
        cards: [
          { title: 'New Card 1', content: 'Content 1' },
          { title: 'New Card 2', content: 'Content 2' }
        ]
      };
      
      const result = await cardService.batchCreateCards(batchCreate);
      
      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results.length).toBe(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      expect(mockBoardRepository.updateBoard).toHaveBeenCalledTimes(1);
    });
    
    it('should handle errors properly', async () => {
      // Setup a case where the column doesn't exist
      const batchCreate = {
        boardId: 'board-123',
        columnId: 'nonexistent-column',
        cards: [
          { title: 'New Card 1', content: 'Content 1' }
        ]
      };
      
      await expect(cardService.batchCreateCards(batchCreate))
        .rejects.toThrow(NotFoundError);
    });
    
    it('should validate input data', async () => {
      const batchCreate = {
        boardId: 'board-123',
        columnId: 'column-1',
        cards: [
          { title: '', content: 'Content 1' } // Invalid title
        ]
      };
      
      await expect(cardService.batchCreateCards(batchCreate))
        .rejects.toThrow(ValidationError);
    });
  });
  
  describe('batchMoveCards', () => {
    it('should move multiple cards between columns', async () => {
      const batchMove = {
        boardId: 'board-123',
        moves: [
          {
            id: 'card-1',
            sourceColumnId: 'column-1',
            targetColumnId: 'column-2'
          }
        ]
      };
      
      const result = await cardService.batchMoveCards(batchMove);
      
      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockBoardRepository.updateBoard).toHaveBeenCalledTimes(1);
    });
    
    it('should handle nonexistent cards gracefully', async () => {
      const batchMove = {
        boardId: 'board-123',
        moves: [
          {
            id: 'card-1',
            sourceColumnId: 'column-1',
            targetColumnId: 'column-2'
          },
          {
            id: 'nonexistent-card',
            sourceColumnId: 'column-1',
            targetColumnId: 'column-2'
          }
        ]
      };
      
      const result = await cardService.batchMoveCards(batchMove);
      
      expect(result.success).toBe(true); // At least one operation succeeded
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(mockBoardRepository.updateBoard).toHaveBeenCalledTimes(1);
    });
  });
  
  // Additional tests for other batch operations
});

// Similar tests for other batch operations and column batch operations
```

### Integration Tests

Create integration tests for batch operation endpoints:

```typescript
// src/tests/integration/routes/batchOperations.test.ts
import request from 'supertest';
import app from '../../../app';

describe('Batch Operations API', () => {
  let testBoardId;
  let testColumnId;
  let testCardIds = [];
  
  beforeAll(async () => {
    // Create test data
    const boardResponse = await request(app)
      .post('/api/boards')
      .send({
        title: 'Test Batch Operations Board'
      });
    
    testBoardId = boardResponse.body.data.id;
    
    // Create a column
    const columnResponse = await request(app)
      .post(`/api/boards/${testBoardId}/columns`)
      .send({
        title: 'Test Column'
      });
    
    testColumnId = columnResponse.body.data.id;
    
    // Create some test cards
    for (let i = 0; i < 3; i++) {
      const cardResponse = await request(app)
        .post(`/api/boards/${testBoardId}/columns/${testColumnId}/cards`)
        .send({
          title: `Test Card ${i + 1}`,
          content: `Content for card ${i + 1}`
        });
      
      testCardIds.push(cardResponse.body.data.id);
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    await request(app)
      .delete(`/api/boards/${testBoardId}`);
  });
  
  describe('Card Batch Operations', () => {
    it('should create multiple cards in a batch', async () => {
      const response = await request(app)
        .post('/api/cards/batch/create')
        .send({
          boardId: testBoardId,
          columnId: testColumnId,
          cards: [
            { title: 'Batch Card 1', content: 'Content 1' },
            { title: 'Batch Card 2', content: 'Content 2' }
          ]
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successCount).toBe(2);
      expect(response.body.data.failureCount).toBe(0);
      
      // Verify the cards were added
      const boardResponse = await request(app)
        .get(`/api/boards/${testBoardId}`);
      
      const column = boardResponse.body.data.columns.find(col => col.id === testColumnId);
      expect(column.cards.length).toBe(5); // 3 initial + 2 new
    });
    
    it('should update multiple cards in a batch', async () => {
      const response = await request(app)
        .put('/api/cards/batch/update')
        .send({
          boardId: testBoardId,
          updates: [
            {
              id: testCardIds[0],
              updates: { status: 'in-progress', priority: 'high' }
            },
            {
              id: testCardIds[1],
              updates: { status: 'in-progress', priority: 'medium' }
            }
          ]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successCount).toBe(2);
      
      // Verify the cards were updated
      const boardResponse = await request(app)
        .get(`/api/boards/${testBoardId}`);
      
      const column = boardResponse.body.data.columns.find(col => col.id === testColumnId);
      const card1 = column.cards.find(card => card.id === testCardIds[0]);
      const card2 = column.cards.find(card => card.id === testCardIds[1]);
      
      expect(card1.status).toBe('in-progress');
      expect(card1.priority).toBe('high');
      expect(card2.status).toBe('in-progress');
      expect(card2.priority).toBe('medium');
    });
    
    // Additional tests for batch delete and batch move operations
  });
  
  describe('Column Batch Operations', () => {
    it('should create multiple columns in a batch', async () => {
      const response = await request(app)
        .post('/api/columns/batch/create')
        .send({
          boardId: testBoardId,
          columns: [
            { title: 'Batch Column 1' },
            { title: 'Batch Column 2' }
          ]
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successCount).toBe(2);
      
      // Verify the columns were added
      const boardResponse = await request(app)
        .get(`/api/boards/${testBoardId}`);
      
      expect(boardResponse.body.data.columns.length).toBe(3); // 1 initial + 2 new
    });
    
    // Additional tests for batch update, batch delete, and reorder operations
  });
});
```

### MCP Tests

Create tests for MCP batch operation tools:

```typescript
// src/tests/unit/mcp/tools/batch-operations.test.ts
describe('MCP Batch Operation Tools', () => {
  let mockCardService;
  let mockColumnService;
  
  beforeEach(() => {
    mockCardService = {
      batchCreateCards: jest.fn(),
      batchUpdateCards: jest.fn(),
      batchDeleteCards: jest.fn(),
      batchMoveCards: jest.fn()
    };
    
    mockColumnService = {
      batchCreateColumns: jest.fn(),
      batchUpdateColumns: jest.fn(),
      batchDeleteColumns: jest.fn(),
      reorderColumns: jest.fn()
    };
    
    // Mock the ServiceFactory to return our mock services
    jest.spyOn(ServiceFactory.prototype, 'createCardService').mockReturnValue(mockCardService);
    jest.spyOn(ServiceFactory.prototype, 'createColumnService').mockReturnValue(mockColumnService);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Card Batch Operations', () => {
    it('should batch create cards', async () => {
      const mockResult = {
        success: true,
        results: [
          { id: 'card-1', success: true, data: { id: 'card-1', title: 'Card 1' } },
          { id: 'card-2', success: true, data: { id: 'card-2', title: 'Card 2' } }
        ],
        totalCount: 2,
        successCount: 2,
        failureCount: 0
      };
      
      mockCardService.batchCreateCards.mockResolvedValue(mockResult);
      
      const params = {
        boardId: 'board-123',
        columnId: 'column-123',
        cards: [
          { title: 'Card 1', content: 'Content 1' },
          { title: 'Card 2', content: 'Content 2' }
        ]
      };
      
      const result = await cardsTools.batchCreateCards.handler(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockCardService.batchCreateCards).toHaveBeenCalledWith(params);
    });
    
    it('should handle errors properly', async () => {
      mockCardService.batchCreateCards.mockRejectedValue(
        new ValidationError('Invalid batch data')
      );
      
      const params = {
        boardId: 'board-123',
        columnId: 'column-123',
        cards: []
      };
      
      const result = await cardsTools.batchCreateCards.handler(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Invalid batch data');
    });
    
    // Additional tests for other batch operations
  });
  
  describe('Column Batch Operations', () => {
    it('should batch create columns', async () => {
      const mockResult = {
        success: true,
        results: [
          { id: 'column-1', success: true, data: { id: 'column-1', title: 'Column 1' } },
          { id: 'column-2', success: true, data: { id: 'column-2', title: 'Column 2' } }
        ],
        totalCount: 2,
        successCount: 2,
        failureCount: 0
      };
      
      mockColumnService.batchCreateColumns.mockResolvedValue(mockResult);
      
      const params = {
        boardId: 'board-123',
        columns: [
          { title: 'Column 1' },
          { title: 'Column 2' }
        ]
      };
      
      const result = await columnsTools.batchCreateColumns.handler(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockColumnService.batchCreateColumns).toHaveBeenCalledWith(params);
    });
    
    // Additional tests for other batch operations
  });
});
```

## Benefits and Impact

Implementing batch operations provides several benefits:

1. **Improved Performance**: Reduces the number of network requests, leading to faster operations for bulk actions.

2. **Atomic Operations**: Related changes can be applied together, ensuring data consistency.

3. **Enhanced User Experience**: Users can perform complex operations more efficiently.

4. **Better Agent Capabilities**: MCP agents can perform sophisticated multi-step board operations in a single request.

5. **Automation Support**: Batch operations enable more advanced automation scenarios, especially when integrated with webhooks.

## Conclusion

Batch operations significantly enhance the TaskBoardAI application by allowing users to perform multiple operations efficiently across all interfaces. These capabilities are particularly important for managing large boards, performing bulk updates, and enabling advanced automation scenarios. By implementing batch operations consistently across MCP, REST API, and CLI interfaces, we ensure a powerful and consistent experience for all users.