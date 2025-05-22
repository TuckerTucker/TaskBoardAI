import { BaseService } from './BaseService';
import { IBoardService, IValidationService } from './interfaces';
import { IBoardRepository } from '@core/repositories';
import { 
  Board, Card, Column, CreateBoard, UpdateBoard, CreateCard, UpdateCard, 
  CreateColumn, UpdateColumn, CardFilter, PaginationParams, EntityFactory
} from '@core/schemas';
import { BoardQuery, CardQuery, BoardQuerySchema, CardQuerySchema } from '@core/schemas/querySchemas';
import { z } from 'zod';
import { validate as uuidValidate } from 'uuid';
import { NotFoundError, ValidationError, ConflictError } from '@core/errors';

export class BoardService extends BaseService<Board, CreateBoard, UpdateBoard> implements IBoardService {
  
  constructor(
    repository: IBoardRepository,
    private validationService: IValidationService
  ) {
    super(repository);
  }

  protected getEntityName(): string {
    return 'Board';
  }

  private get boardRepository(): IBoardRepository {
    return this.repository as IBoardRepository;
  }

  protected async validateCreate(data: CreateBoard): Promise<void> {
    this.validationService.validateCreateBoard(data);
    
    // Check for duplicate titles
    const existing = await this.findByTitle(data.title);
    if (existing) {
      throw new ConflictError(`Board with title '${data.title}' already exists`);
    }
  }

  protected async validateUpdate(id: string, data: UpdateBoard): Promise<void> {
    this.validationService.validateUpdateBoard(data);
    
    // Check for duplicate titles if title is being updated
    if (data.title) {
      const existing = await this.findByTitle(data.title);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Board with title '${data.title}' already exists`);
      }
    }
  }

  // Board operations
  async findByTitle(title: string): Promise<Board | null> {
    try {
      return await this.boardRepository.findByTitle(title);
    } catch (error) {
      this.logger.error('Failed to find board by title', { title, error });
      throw error;
    }
  }

  verifyBoard(boardData: unknown): Board {
    return this.validationService.validateBoardWithRules(boardData);
  }

  // Card operations
  async addCard(boardId: string, cardData: CreateCard): Promise<Card> {
    try {
      this.logger.debug('Adding card to board', { boardId, cardData });
      
      const validatedData = this.validationService.validateCreateCard(cardData);
      const board = await this.ensureExists(boardId);
      
      // Validate column exists
      const column = board.columns.find(col => col.id === validatedData.columnId);
      if (!column) {
        throw new NotFoundError('Column', validatedData.columnId);
      }

      const card = EntityFactory.createCard(validatedData);
      const validatedCard = this.validationService.validateCardWithRules(card, board);
      
      await this.boardRepository.addCard(boardId, validatedCard);
      
      this.logger.info('Card added to board', { boardId, cardId: card.id });
      return card;
    } catch (error) {
      this.logger.error('Failed to add card to board', { boardId, cardData, error });
      throw error;
    }
  }

  async updateCard(boardId: string, cardId: string, updates: UpdateCard): Promise<Card> {
    try {
      this.logger.debug('Updating card', { boardId, cardId, updates });
      
      const validatedUpdates = this.validationService.validateUpdateCard(updates);
      const board = await this.ensureExists(boardId);
      
      const card = board.cards.find(c => c.id === cardId);
      if (!card) {
        throw new NotFoundError('Card', cardId);
      }

      const updatedCard = { ...card, ...validatedUpdates };
      this.validationService.validateCardWithRules(updatedCard, board);

      await this.boardRepository.updateCard(boardId, cardId, validatedUpdates);
      
      this.logger.info('Card updated', { boardId, cardId });
      return updatedCard;
    } catch (error) {
      this.logger.error('Failed to update card', { boardId, cardId, updates, error });
      throw error;
    }
  }

  async deleteCard(boardId: string, cardId: string): Promise<void> {
    try {
      this.logger.debug('Deleting card', { boardId, cardId });
      
      const board = await this.ensureExists(boardId);
      const card = board.cards.find(c => c.id === cardId);
      if (!card) {
        throw new NotFoundError('Card', cardId);
      }

      await this.boardRepository.deleteCard(boardId, cardId);
      
      this.logger.info('Card deleted', { boardId, cardId });
    } catch (error) {
      this.logger.error('Failed to delete card', { boardId, cardId, error });
      throw error;
    }
  }

  async moveCard(boardId: string, cardId: string, toColumnId: string, position: number): Promise<Card> {
    try {
      this.logger.debug('Moving card', { boardId, cardId, toColumnId, position });
      
      const board = await this.ensureExists(boardId);
      
      const card = board.cards.find(c => c.id === cardId);
      if (!card) {
        throw new NotFoundError('Card', cardId);
      }

      const toColumn = board.columns.find(col => col.id === toColumnId);
      if (!toColumn) {
        throw new NotFoundError('Column', toColumnId);
      }

      await this.boardRepository.moveCard(boardId, cardId, toColumnId, position);
      
      const updatedCard = { ...card, columnId: toColumnId, position };
      this.logger.info('Card moved', { boardId, cardId, toColumnId, position });
      
      return updatedCard;
    } catch (error) {
      this.logger.error('Failed to move card', { boardId, cardId, toColumnId, position, error });
      throw error;
    }
  }

  async findCard(boardId: string, cardId: string): Promise<Card> {
    try {
      const board = await this.ensureExists(boardId);
      const card = board.cards.find(c => c.id === cardId);
      
      if (!card) {
        throw new NotFoundError('Card', cardId);
      }
      
      return card;
    } catch (error) {
      this.logger.error('Failed to find card', { boardId, cardId, error });
      throw error;
    }
  }

  async findCards(boardId: string, filter?: CardFilter, pagination?: PaginationParams): Promise<Card[]> {
    try {
      if (filter) {
        this.validationService.validateCardFilter(filter);
      }
      if (pagination) {
        this.validationService.validatePagination(pagination);
      }
      
      return await this.boardRepository.findCards(boardId, filter, pagination);
    } catch (error) {
      this.logger.error('Failed to find cards', { boardId, filter, pagination, error });
      throw error;
    }
  }

  async searchCards(boardId: string, query: string): Promise<Card[]> {
    try {
      if (!query || query.trim().length === 0) {
        throw new ValidationError('Search query cannot be empty');
      }
      
      return await this.boardRepository.searchCards(boardId, query.trim());
    } catch (error) {
      this.logger.error('Failed to search cards', { boardId, query, error });
      throw error;
    }
  }

  // Column operations
  async addColumn(boardId: string, columnData: CreateColumn): Promise<Column> {
    try {
      this.logger.debug('Adding column to board', { boardId, columnData });
      
      const validatedData = this.validationService.validateCreateColumn(columnData);
      const board = await this.ensureExists(boardId);
      
      const position = EntityFactory.generateNextPosition(board.columns);
      const column = EntityFactory.createColumn(validatedData, position);
      
      this.validationService.validateColumnWithRules(column, board);
      
      await this.boardRepository.addColumn(boardId, column);
      
      this.logger.info('Column added to board', { boardId, columnId: column.id });
      return column;
    } catch (error) {
      this.logger.error('Failed to add column to board', { boardId, columnData, error });
      throw error;
    }
  }

  async updateColumn(boardId: string, columnId: string, updates: UpdateColumn): Promise<Column> {
    try {
      this.logger.debug('Updating column', { boardId, columnId, updates });
      
      const validatedUpdates = this.validationService.validateUpdateColumn(updates);
      const board = await this.ensureExists(boardId);
      
      const column = board.columns.find(col => col.id === columnId);
      if (!column) {
        throw new NotFoundError('Column', columnId);
      }

      const updatedColumn = { ...column, ...validatedUpdates };
      this.validationService.validateColumnWithRules(updatedColumn, board);

      await this.boardRepository.updateColumn(boardId, columnId, validatedUpdates);
      
      this.logger.info('Column updated', { boardId, columnId });
      return updatedColumn;
    } catch (error) {
      this.logger.error('Failed to update column', { boardId, columnId, updates, error });
      throw error;
    }
  }

  async deleteColumn(boardId: string, columnId: string): Promise<void> {
    try {
      this.logger.debug('Deleting column', { boardId, columnId });
      
      const board = await this.ensureExists(boardId);
      const column = board.columns.find(col => col.id === columnId);
      if (!column) {
        throw new NotFoundError('Column', columnId);
      }

      // Check if column has cards
      const cardsInColumn = board.cards.filter(card => card.columnId === columnId);
      if (cardsInColumn.length > 0) {
        throw new ConflictError(`Cannot delete column with ${cardsInColumn.length} cards`);
      }

      await this.boardRepository.deleteColumn(boardId, columnId);
      
      this.logger.info('Column deleted', { boardId, columnId });
    } catch (error) {
      this.logger.error('Failed to delete column', { boardId, columnId, error });
      throw error;
    }
  }

  async reorderColumns(boardId: string, columnOrder: string[]): Promise<Column[]> {
    try {
      this.logger.debug('Reordering columns', { boardId, columnOrder });
      
      const board = await this.ensureExists(boardId);
      
      if (columnOrder.length !== board.columns.length) {
        throw new ValidationError('Column order must include all columns');
      }

      // Validate all column IDs exist
      const boardColumnIds = new Set(board.columns.map(col => col.id));
      for (const columnId of columnOrder) {
        if (!boardColumnIds.has(columnId)) {
          throw new NotFoundError('Column', columnId);
        }
      }

      const updatedBoard = await this.boardRepository.reorderColumns(boardId, columnOrder);
      
      this.logger.info('Columns reordered', { boardId });
      return updatedBoard.columns;
    } catch (error) {
      this.logger.error('Failed to reorder columns', { boardId, columnOrder, error });
      throw error;
    }
  }

  async findColumn(boardId: string, columnId: string): Promise<Column> {
    try {
      const board = await this.ensureExists(boardId);
      const column = board.columns.find(col => col.id === columnId);
      
      if (!column) {
        throw new NotFoundError('Column', columnId);
      }
      
      return column;
    } catch (error) {
      this.logger.error('Failed to find column', { boardId, columnId, error });
      throw error;
    }
  }

  // Analytics and utilities
  async getBoardStats(boardId: string): Promise<{
    totalCards: number;
    cardsByColumn: Record<string, number>;
    cardsByPriority: Record<string, number>;
    overdueTasks: number;
    completionRate: number;
  }> {
    try {
      const board = await this.ensureExists(boardId);
      const now = new Date();
      
      const cardsByColumn: Record<string, number> = {};
      const cardsByPriority: Record<string, number> = { low: 0, medium: 0, high: 0 };
      let overdueTasks = 0;
      
      // Initialize column counts
      board.columns.forEach(col => {
        cardsByColumn[col.title] = 0;
      });

      // Count cards
      board.cards.forEach(card => {
        const column = board.columns.find(col => col.id === card.columnId);
        if (column) {
          cardsByColumn[column.title]++;
        }
        
        cardsByPriority[card.priority]++;
        
        if (card.dueDate && new Date(card.dueDate) < now) {
          overdueTasks++;
        }
      });

      // Calculate completion rate (assuming last column is "done")
      const lastColumn = board.columns[board.columns.length - 1];
      const completedCards = lastColumn ? cardsByColumn[lastColumn.title] : 0;
      const completionRate = board.cards.length > 0 ? (completedCards / board.cards.length) * 100 : 0;

      return {
        totalCards: board.cards.length,
        cardsByColumn,
        cardsByPriority,
        overdueTasks,
        completionRate: Math.round(completionRate * 100) / 100
      };
    } catch (error) {
      this.logger.error('Failed to get board stats', { boardId, error });
      throw error;
    }
  }

  async duplicateBoard(boardId: string, newTitle?: string): Promise<Board> {
    try {
      this.logger.debug('Duplicating board', { boardId, newTitle });
      
      const originalBoard = await this.ensureExists(boardId);
      
      const duplicateTitle = newTitle || `${originalBoard.title} (Copy)`;
      
      // Check for duplicate titles
      const existing = await this.findByTitle(duplicateTitle);
      if (existing) {
        throw new ConflictError(`Board with title '${duplicateTitle}' already exists`);
      }

      const duplicateData: CreateBoard = {
        title: duplicateTitle,
        description: originalBoard.description,
        columns: originalBoard.columns.map(col => col.title),
        settings: { ...originalBoard.settings }
      };

      const newBoard = await this.create(duplicateData);
      
      // Duplicate cards
      for (const originalCard of originalBoard.cards) {
        const cardData: CreateCard = {
          title: originalCard.title,
          description: originalCard.description,
          columnId: newBoard.columns[originalCard.position]?.id || newBoard.columns[0].id,
          tags: [...originalCard.tags],
          priority: originalCard.priority,
          assignee: originalCard.assignee,
          dueDate: originalCard.dueDate
        };
        
        await this.addCard(newBoard.id, cardData);
      }

      this.logger.info('Board duplicated', { originalId: boardId, newId: newBoard.id });
      return await this.findById(newBoard.id);
    } catch (error) {
      this.logger.error('Failed to duplicate board', { boardId, newTitle, error });
      throw error;
    }
  }

  async exportBoard(boardId: string, format: 'json' | 'csv'): Promise<string> {
    try {
      const board = await this.ensureExists(boardId);
      
      if (format === 'json') {
        return JSON.stringify(board, null, 2);
      }
      
      if (format === 'csv') {
        const headers = ['Card ID', 'Title', 'Description', 'Column', 'Priority', 'Assignee', 'Due Date', 'Tags', 'Created', 'Updated'];
        const rows = board.cards.map(card => {
          const column = board.columns.find(col => col.id === card.columnId);
          return [
            card.id,
            `"${card.title}"`,
            `"${card.description || ''}"`,
            `"${column?.title || ''}"`,
            card.priority,
            `"${card.assignee || ''}"`,
            card.dueDate || '',
            `"${card.tags.join(', ')}"`,
            card.createdAt,
            card.updatedAt
          ].join(',');
        });
        
        return [headers.join(','), ...rows].join('\n');
      }
      
      throw new ValidationError(`Unsupported export format: ${format}`);
    } catch (error) {
      this.logger.error('Failed to export board', { boardId, format, error });
      throw error;
    }
  }

  async validateBoardIntegrity(boardId: string): Promise<{ isValid: boolean; issues: string[] }> {
    try {
      const board = await this.ensureExists(boardId);
      const issues: string[] = [];
      
      // Validate board structure
      try {
        this.validationService.validateBoardWithRules(board);
      } catch (error) {
        issues.push(`Board validation failed: ${error}`);
      }

      // Check for orphaned cards
      const columnIds = new Set(board.columns.map(col => col.id));
      board.cards.forEach(card => {
        if (!columnIds.has(card.columnId)) {
          issues.push(`Card ${card.id} references non-existent column ${card.columnId}`);
        }
      });

      // Check for duplicate card positions within columns
      const cardsByColumn = new Map<string, Card[]>();
      board.cards.forEach(card => {
        if (!cardsByColumn.has(card.columnId)) {
          cardsByColumn.set(card.columnId, []);
        }
        cardsByColumn.get(card.columnId)!.push(card);
      });

      cardsByColumn.forEach((cards, columnId) => {
        const positions = cards.map(card => card.position);
        const uniquePositions = new Set(positions);
        if (positions.length !== uniquePositions.size) {
          issues.push(`Column ${columnId} has duplicate card positions`);
        }
      });

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      this.logger.error('Failed to validate board integrity', { boardId, error });
      throw error;
    }
  }

  // Query operations
  async queryBoards(query: BoardQuery): Promise<Board[]> {
    try {
      this.logger.debug('Querying boards', { query });
      
      const validatedQuery = BoardQuerySchema.parse(query);
      const boards = await this.boardRepository.queryBoards(validatedQuery);
      
      this.logger.info('Boards query completed', { count: boards.length, query });
      return boards;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid board query parameters', { query, error: error.errors });
        throw new ValidationError('Invalid query parameters', error);
      }
      this.logger.error('Failed to query boards', { query, error });
      throw error;
    }
  }

  async queryCards(boardId: string, query: CardQuery): Promise<Card[]> {
    try {
      this.logger.debug('Querying cards', { boardId, query });
      
      // Validate boardId
      if (!uuidValidate(boardId)) {
        throw new ValidationError(`Invalid board ID: ${boardId}`);
      }
      
      const validatedQuery = CardQuerySchema.parse(query);
      const cards = await this.boardRepository.queryCards(boardId, validatedQuery);
      
      this.logger.info('Cards query completed', { boardId, count: cards.length, query });
      return cards;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid card query parameters', { boardId, query, error: error.errors });
        throw new ValidationError('Invalid query parameters', error);
      }
      this.logger.error('Failed to query cards', { boardId, query, error });
      throw error;
    }
  }
}