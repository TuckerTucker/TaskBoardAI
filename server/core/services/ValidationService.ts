import { IValidationService } from './interfaces';
import { 
  Board, Card, Column, Config, CreateBoard, UpdateBoard, CreateCard, UpdateCard, 
  CreateColumn, UpdateColumn, PaginationParams, SortParams, CardFilter,
  BoardSchema, CardSchema, ColumnSchema, ConfigSchema, CreateBoardSchema, 
  UpdateBoardSchema, CreateCardSchema, UpdateCardSchema, CreateColumnSchema, 
  UpdateColumnSchema, PaginationSchema, SortSchema, CardFilterSchema,
  createSafeParser
} from '@core/schemas';
import { logger } from '@core/utils';

export class ValidationService implements IValidationService {
  private logger = logger.child({ service: 'ValidationService' });

  validateBoard(data: unknown): Board {
    this.logger.debug('Validating board data');
    const parseBoard = createSafeParser(BoardSchema);
    return parseBoard(data);
  }

  validateCard(data: unknown): Card {
    this.logger.debug('Validating card data');
    const parseCard = createSafeParser(CardSchema);
    return parseCard(data);
  }

  validateColumn(data: unknown): Column {
    this.logger.debug('Validating column data');
    const parseColumn = createSafeParser(ColumnSchema);
    return parseColumn(data);
  }

  validateConfig(data: unknown): Config {
    this.logger.debug('Validating config data');
    const parseConfig = createSafeParser(ConfigSchema);
    return parseConfig(data);
  }

  validateCreateBoard(data: unknown): CreateBoard {
    this.logger.debug('Validating create board data');
    const parseCreateBoard = createSafeParser(CreateBoardSchema);
    return parseCreateBoard(data);
  }

  validateUpdateBoard(data: unknown): UpdateBoard {
    this.logger.debug('Validating update board data');
    const parseUpdateBoard = createSafeParser(UpdateBoardSchema);
    return parseUpdateBoard(data);
  }

  validateCreateCard(data: unknown): CreateCard {
    this.logger.debug('Validating create card data');
    const parseCreateCard = createSafeParser(CreateCardSchema);
    return parseCreateCard(data);
  }

  validateUpdateCard(data: unknown): UpdateCard {
    this.logger.debug('Validating update card data');
    const parseUpdateCard = createSafeParser(UpdateCardSchema);
    return parseUpdateCard(data);
  }

  validateCreateColumn(data: unknown): CreateColumn {
    this.logger.debug('Validating create column data');
    const parseCreateColumn = createSafeParser(CreateColumnSchema);
    return parseCreateColumn(data);
  }

  validateUpdateColumn(data: unknown): UpdateColumn {
    this.logger.debug('Validating update column data');
    const parseUpdateColumn = createSafeParser(UpdateColumnSchema);
    return parseUpdateColumn(data);
  }

  validatePagination(data: unknown): PaginationParams {
    this.logger.debug('Validating pagination params');
    const parsePagination = createSafeParser(PaginationSchema);
    return parsePagination(data);
  }

  validateSort(data: unknown): SortParams {
    this.logger.debug('Validating sort params');
    const parseSort = createSafeParser(SortSchema);
    return parseSort(data);
  }

  validateCardFilter(data: unknown): CardFilter {
    this.logger.debug('Validating card filter params');
    const parseCardFilter = createSafeParser(CardFilterSchema);
    return parseCardFilter(data);
  }

  // Utility methods for batch validation
  validateArray<T>(data: unknown[], validator: (item: unknown) => T): T[] {
    if (!Array.isArray(data)) {
      throw new Error('Expected array');
    }
    
    return data.map((item, index) => {
      try {
        return validator(item);
      } catch (error) {
        this.logger.error(`Validation failed for array item at index ${index}`, { error });
        throw new Error(`Validation failed for item at index ${index}: ${error}`);
      }
    });
  }

  validateOptional<T>(data: unknown, validator: (item: unknown) => T): T | undefined {
    if (data === undefined || data === null) {
      return undefined;
    }
    return validator(data);
  }

  // Entity-specific validation with business rules
  validateBoardWithRules(data: unknown): Board {
    const board = this.validateBoard(data);
    
    // Business rule validations
    if (board.columns.length === 0) {
      throw new Error('Board must have at least one column');
    }

    // Validate column positions are sequential
    const positions = board.columns.map(col => col.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length; i++) {
      if (positions[i] !== i) {
        throw new Error('Column positions must be sequential starting from 0');
      }
    }

    // Validate card references
    const columnIds = new Set(board.columns.map(col => col.id));
    for (const card of board.cards) {
      if (!columnIds.has(card.columnId)) {
        throw new Error(`Card ${card.id} references non-existent column ${card.columnId}`);
      }
    }

    // Validate WIP limits
    for (const column of board.columns) {
      if (column.wipLimit) {
        const cardsInColumn = board.cards.filter(card => card.columnId === column.id);
        if (cardsInColumn.length > column.wipLimit && !board.settings.allowWipLimitExceeding) {
          throw new Error(`Column ${column.title} exceeds WIP limit: ${cardsInColumn.length} > ${column.wipLimit}`);
        }
      }
    }

    return board;
  }

  validateCardWithRules(data: unknown, board?: Board): Card {
    const card = this.validateCard(data);
    
    if (board) {
      // Validate column exists in board
      const column = board.columns.find(col => col.id === card.columnId);
      if (!column) {
        throw new Error(`Card references non-existent column ${card.columnId}`);
      }

      // Validate position within column
      const cardsInColumn = board.cards.filter(c => c.columnId === card.columnId && c.id !== card.id);
      if (card.position < 0 || card.position > cardsInColumn.length) {
        throw new Error(`Invalid card position ${card.position} for column with ${cardsInColumn.length} cards`);
      }
    }

    // Validate due date is not in the past (optional warning)
    if (card.dueDate) {
      const dueDate = new Date(card.dueDate);
      const now = new Date();
      if (dueDate < now) {
        this.logger.warn('Card due date is in the past', { cardId: card.id, dueDate: card.dueDate });
      }
    }

    return card;
  }

  validateColumnWithRules(data: unknown, board?: Board): Column {
    const column = this.validateColumn(data);
    
    if (board) {
      // Validate position within board
      if (column.position < 0 || column.position > board.columns.length) {
        throw new Error(`Invalid column position ${column.position} for board with ${board.columns.length} columns`);
      }

      // Validate unique title
      const existingColumn = board.columns.find(col => col.title === column.title && col.id !== column.id);
      if (existingColumn) {
        throw new Error(`Column title '${column.title}' already exists`);
      }
    }

    return column;
  }
}