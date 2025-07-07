import { join } from 'path';
import { BaseRepository } from './BaseRepository';
import { IBoardRepository } from './interfaces';
import { Board, Card, Column, CreateBoard, UpdateBoard, CardFilter, PaginationParams } from '@core/schemas';
import { EntityFactory, createSafeParser, BoardSchema, CreateBoardSchema, UpdateBoardSchema } from '@core/schemas';
import { NotFoundError, ValidationError, ConflictError } from '@core/errors';
import { validateUniqueTitle, validateWipLimit } from '@core/schemas';
import { BoardQuery, CardQuery } from '@core/schemas/querySchemas';

export class BoardRepository extends BaseRepository<Board, CreateBoard, UpdateBoard> implements IBoardRepository {
  
  constructor(fileSystem: any, basePath: string = 'boards') {
    super(fileSystem, basePath);
  }

  protected getFilePath(id?: string): string {
    return id ? join(this.basePath, `${id}.json`) : this.basePath;
  }

  protected async validateCreate(data: CreateBoard): Promise<void> {
    const parseCreateBoard = createSafeParser(CreateBoardSchema);
    parseCreateBoard(data);

    // Check for duplicate titles
    const existingBoard = await this.findByTitle(data.title);
    if (existingBoard) {
      throw new ConflictError(`Board with title '${data.title}' already exists`);
    }
  }

  protected async validateUpdate(data: UpdateBoard): Promise<void> {
    const parseUpdateBoard = createSafeParser(UpdateBoardSchema);
    parseUpdateBoard(data);
  }

  protected async createEntity(data: CreateBoard): Promise<Board> {
    await this.ensureDirectoryExists();
    return EntityFactory.createBoard(data);
  }

  protected async updateEntity(existing: Board, updates: UpdateBoard): Promise<Board> {
    const updated = {
      ...existing,
      ...updates,
      settings: updates.settings ? { ...existing.settings, ...updates.settings } : existing.settings
    };
    
    return EntityFactory.updateTimestamp(updated);
  }

  async findByTitle(title: string): Promise<Board | null> {
    try {
      const boards = await this.findAll();
      return boards.find(board => board.title === title) || null;
    } catch (error) {
      this.logger.error('Failed to find board by title', { title, error });
      throw error;
    }
  }

  async findCardsInColumn(boardId: string, columnId: string): Promise<Card[]> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const column = board.columns.find(col => col.id === columnId);
      if (!column) {
        throw new NotFoundError('Column', columnId);
      }

      return board.cards
        .filter(card => card.columnId === columnId)
        .sort((a, b) => a.position - b.position);
    } catch (error) {
      this.logger.error('Failed to find cards in column', { boardId, columnId, error });
      throw error;
    }
  }

  async addCard(boardId: string, card: Card): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const column = board.columns.find(col => col.id === card.columnId);
      if (!column) {
        throw new NotFoundError('Column', card.columnId);
      }

      // Check WIP limit
      const cardsInColumn = board.cards.filter(c => c.columnId === card.columnId);
      if (!board.settings.allowWipLimitExceeding && column.wipLimit) {
        validateWipLimit(cardsInColumn.length, column.wipLimit);
      }

      // Set position to end of column
      const maxPosition = cardsInColumn.length > 0 
        ? Math.max(...cardsInColumn.map(c => c.position)) + 1 
        : 0;
      
      const cardWithPosition = { ...card, position: maxPosition };
      const updatedBoard = {
        ...board,
        cards: [...board.cards, cardWithPosition]
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to add card', { boardId, card: card.id, error });
      throw error;
    }
  }

  async updateCard(boardId: string, cardId: string, updates: Partial<Card>): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const cardIndex = board.cards.findIndex(card => card.id === cardId);
      if (cardIndex === -1) {
        throw new NotFoundError('Card', cardId);
      }

      const updatedCard = EntityFactory.updateTimestamp({
        ...board.cards[cardIndex],
        ...updates
      });

      const updatedCards = [...board.cards];
      updatedCards[cardIndex] = updatedCard;

      const updatedBoard = {
        ...board,
        cards: updatedCards
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to update card', { boardId, cardId, error });
      throw error;
    }
  }

  async deleteCard(boardId: string, cardId: string): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const cardExists = board.cards.some(card => card.id === cardId);
      if (!cardExists) {
        throw new NotFoundError('Card', cardId);
      }

      const updatedCards = board.cards.filter(card => card.id !== cardId);
      
      // Normalize positions within each column
      const cardsByColumn = new Map<string, Card[]>();
      updatedCards.forEach(card => {
        if (!cardsByColumn.has(card.columnId)) {
          cardsByColumn.set(card.columnId, []);
        }
        cardsByColumn.get(card.columnId)!.push(card);
      });

      const normalizedCards: Card[] = [];
      cardsByColumn.forEach(cards => {
        const sorted = EntityFactory.normalizePositions(cards);
        normalizedCards.push(...sorted);
      });

      const updatedBoard = {
        ...board,
        cards: normalizedCards
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to delete card', { boardId, cardId, error });
      throw error;
    }
  }

  async moveCard(boardId: string, cardId: string, toColumnId: string, position: number): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const card = board.cards.find(c => c.id === cardId);
      if (!card) {
        throw new NotFoundError('Card', cardId);
      }

      const toColumn = board.columns.find(col => col.id === toColumnId);
      if (!toColumn) {
        throw new NotFoundError('Column', toColumnId);
      }

      // Check WIP limit for destination column
      const cardsInDestination = board.cards.filter(c => c.columnId === toColumnId && c.id !== cardId);
      if (!board.settings.allowWipLimitExceeding && toColumn.wipLimit) {
        validateWipLimit(cardsInDestination.length, toColumn.wipLimit);
      }

      // Remove card from current position
      let updatedCards = board.cards.filter(c => c.id !== cardId);
      
      // Update card with new column
      const movedCard = {
        ...card,
        columnId: toColumnId,
        position
      };

      // Insert at new position
      const destinationCards = updatedCards.filter(c => c.columnId === toColumnId);
      const otherCards = updatedCards.filter(c => c.columnId !== toColumnId);
      
      const reorderedDestination = EntityFactory.insertAtPosition(destinationCards, movedCard, position);
      
      const updatedBoard = {
        ...board,
        cards: [...otherCards, ...reorderedDestination]
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to move card', { boardId, cardId, toColumnId, position, error });
      throw error;
    }
  }

  async addColumn(boardId: string, column: Column): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      // Check for duplicate column titles
      validateUniqueTitle(column.title, board.columns.map(col => col.title));

      const updatedColumns = EntityFactory.insertAtPosition(board.columns, column, column.position);
      
      const updatedBoard = {
        ...board,
        columns: updatedColumns
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to add column', { boardId, column: column.id, error });
      throw error;
    }
  }

  async updateColumn(boardId: string, columnId: string, updates: Partial<Column>): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const columnIndex = board.columns.findIndex(col => col.id === columnId);
      if (columnIndex === -1) {
        throw new NotFoundError('Column', columnId);
      }

      // Check for duplicate titles if title is being updated
      if (updates.title) {
        const otherTitles = board.columns
          .filter(col => col.id !== columnId)
          .map(col => col.title);
        validateUniqueTitle(updates.title, otherTitles);
      }

      const updatedColumn = { ...board.columns[columnIndex], ...updates };
      const updatedColumns = [...board.columns];
      updatedColumns[columnIndex] = updatedColumn;

      const updatedBoard = {
        ...board,
        columns: updatedColumns
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to update column', { boardId, columnId, error });
      throw error;
    }
  }

  async deleteColumn(boardId: string, columnId: string): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const columnExists = board.columns.some(col => col.id === columnId);
      if (!columnExists) {
        throw new NotFoundError('Column', columnId);
      }

      // Check if column has cards
      const cardsInColumn = board.cards.filter(card => card.columnId === columnId);
      if (cardsInColumn.length > 0) {
        throw new ConflictError(`Cannot delete column with ${cardsInColumn.length} cards`);
      }

      const updatedColumns = EntityFactory.removeAtPosition(
        board.columns,
        board.columns.findIndex(col => col.id === columnId)
      );

      const updatedBoard = {
        ...board,
        columns: updatedColumns
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to delete column', { boardId, columnId, error });
      throw error;
    }
  }

  async reorderColumns(boardId: string, columnOrder: string[]): Promise<Board> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      if (columnOrder.length !== board.columns.length) {
        throw new ValidationError('Column order must include all columns');
      }

      const reorderedColumns = columnOrder.map((columnId, index) => {
        const column = board.columns.find(col => col.id === columnId);
        if (!column) {
          throw new NotFoundError('Column', columnId);
        }
        return { ...column, position: index };
      });

      const updatedBoard = {
        ...board,
        columns: reorderedColumns
      };

      return await this.update(boardId, updatedBoard);
    } catch (error) {
      this.logger.error('Failed to reorder columns', { boardId, columnOrder, error });
      throw error;
    }
  }

  async findCards(boardId: string, filter?: CardFilter, pagination?: PaginationParams): Promise<Card[]> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      let cards = [...board.cards];

      // Apply filters
      if (filter) {
        if (filter.tags && filter.tags.length > 0) {
          cards = cards.filter(card => 
            filter.tags!.some(tag => card.tags.includes(tag))
          );
        }

        if (filter.priority && filter.priority.length > 0) {
          cards = cards.filter(card => filter.priority!.includes(card.priority));
        }

        if (filter.assignee) {
          cards = cards.filter(card => card.assignee === filter.assignee);
        }

        if (filter.dueDate) {
          cards = cards.filter(card => {
            if (!card.dueDate) return false;
            const cardDate = new Date(card.dueDate);
            
            if (filter.dueDate!.from) {
              const fromDate = new Date(filter.dueDate!.from);
              if (cardDate < fromDate) return false;
            }
            
            if (filter.dueDate!.to) {
              const toDate = new Date(filter.dueDate!.to);
              if (cardDate > toDate) return false;
            }
            
            return true;
          });
        }
      }

      // Apply pagination
      if (pagination) {
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        cards = cards.slice(startIndex, endIndex);
      }

      return cards;
    } catch (error) {
      this.logger.error('Failed to find cards with filters', { boardId, filter, pagination, error });
      throw error;
    }
  }

  async searchCards(boardId: string, query: string): Promise<Card[]> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      const searchTerm = query.toLowerCase();
      return board.cards.filter(card => 
        card.title.toLowerCase().includes(searchTerm) ||
        (card.description && card.description.toLowerCase().includes(searchTerm)) ||
        card.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
        (card.assignee && card.assignee.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      this.logger.error('Failed to search cards', { boardId, query, error });
      throw error;
    }
  }

  async getCardCount(boardId: string, columnId?: string): Promise<number> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }

      if (columnId) {
        return board.cards.filter(card => card.columnId === columnId).length;
      }

      return board.cards.length;
    } catch (error) {
      this.logger.error('Failed to get card count', { boardId, columnId, error });
      throw error;
    }
  }

  async queryBoards(query: BoardQuery): Promise<Board[]> {
    try {
      // Start with all boards
      let boards = await this.findAll();
      
      // Apply filters
      if (query.title) {
        boards = boards.filter(board => 
          board.title.toLowerCase().includes(query.title!.toLowerCase())
        );
      }
      
      if (query.tags && query.tags.length > 0) {
        boards = boards.filter(board => 
          query.tags!.some(tag => board.tags.includes(tag))
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
      
      return boards;
    } catch (error) {
      this.logger.error('Failed to query boards', { query, error });
      throw error;
    }
  }

  async queryCards(boardId: string, query: CardQuery): Promise<Card[]> {
    try {
      // Get the board first
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board', boardId);
      }
      
      // Start with all cards from the board
      let cards: Card[] = [...board.cards];
      
      // Apply filters
      if (query.title) {
        cards = cards.filter(card => 
          card.title.toLowerCase().includes(query.title!.toLowerCase())
        );
      }
      
      if (query.content) {
        cards = cards.filter(card => 
          card.description && card.description.toLowerCase().includes(query.content!.toLowerCase())
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
          query.tags!.some(tag => card.tags.includes(tag))
        );
      }
      
      if (query.createdAfter) {
        const date = new Date(query.createdAfter);
        cards = cards.filter(card => new Date(card.createdAt) >= date);
      }
      
      if (query.createdBefore) {
        const date = new Date(query.createdBefore);
        cards = cards.filter(card => new Date(card.createdAt) <= date);
      }
      
      if (query.updatedAfter) {
        const date = new Date(query.updatedAfter);
        cards = cards.filter(card => new Date(card.updatedAt) >= date);
      }
      
      if (query.updatedBefore) {
        const date = new Date(query.updatedBefore);
        cards = cards.filter(card => new Date(card.updatedAt) <= date);
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
            return sortOrder * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          } else if (query.sortBy === 'updatedAt') {
            return sortOrder * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
          } else if (query.sortBy === 'status') {
            return sortOrder * a.status.localeCompare(b.status);
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
      
      return cards;
    } catch (error) {
      this.logger.error('Failed to query cards', { boardId, query, error });
      throw error;
    }
  }
}