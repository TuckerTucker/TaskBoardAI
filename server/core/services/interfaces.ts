import { Board, Card, Column, Config, CreateBoard, UpdateBoard, CreateCard, UpdateCard, CreateColumn, UpdateColumn, PaginationParams, SortParams, CardFilter } from '@core/schemas';
import { BoardQuery, CardQuery } from '@core/schemas/querySchemas';

export interface IService<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  findAll(pagination?: PaginationParams, sort?: SortParams): Promise<T[]>;
  findById(id: string): Promise<T>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface IBoardService extends IService<Board, CreateBoard, UpdateBoard> {
  // Board operations
  findByTitle(title: string): Promise<Board | null>;
  verifyBoard(boardData: unknown): Board;
  
  // Card operations
  addCard(boardId: string, cardData: CreateCard): Promise<Card>;
  updateCard(boardId: string, cardId: string, updates: UpdateCard): Promise<Card>;
  deleteCard(boardId: string, cardId: string): Promise<void>;
  moveCard(boardId: string, cardId: string, toColumnId: string, position: number): Promise<Card>;
  findCard(boardId: string, cardId: string): Promise<Card>;
  findCards(boardId: string, filter?: CardFilter, pagination?: PaginationParams): Promise<Card[]>;
  searchCards(boardId: string, query: string): Promise<Card[]>;
  
  // Column operations
  addColumn(boardId: string, columnData: CreateColumn): Promise<Column>;
  updateColumn(boardId: string, columnId: string, updates: UpdateColumn): Promise<Column>;
  deleteColumn(boardId: string, columnId: string): Promise<void>;
  reorderColumns(boardId: string, columnOrder: string[]): Promise<Column[]>;
  findColumn(boardId: string, columnId: string): Promise<Column>;
  
  // Analytics and utilities
  getBoardStats(boardId: string): Promise<{
    totalCards: number;
    cardsByColumn: Record<string, number>;
    cardsByPriority: Record<string, number>;
    overdueTasks: number;
    completionRate: number;
  }>;
  
  duplicateBoard(boardId: string, newTitle?: string): Promise<Board>;
  exportBoard(boardId: string, format: 'json' | 'csv'): Promise<string>;
  validateBoardIntegrity(boardId: string): Promise<{ isValid: boolean; issues: string[] }>;
  
  // Query operations
  queryBoards(query: BoardQuery): Promise<Board[]>;
  queryCards(boardId: string, query: CardQuery): Promise<Card[]>;
}

export interface IConfigService extends IService<Config, Partial<Config>, Partial<Config>> {
  getDefault(): Promise<Config>;
  updateServerConfig(updates: Partial<Config['server']>): Promise<Config>;
  updateDefaultsConfig(updates: Partial<Config['defaults']>): Promise<Config>;
  reset(): Promise<Config>;
  validateConfig(config: unknown): Config;
}

export interface IValidationService {
  validateBoard(data: unknown): Board;
  validateCard(data: unknown): Card;
  validateColumn(data: unknown): Column;
  validateConfig(data: unknown): Config;
  validateCreateBoard(data: unknown): CreateBoard;
  validateUpdateBoard(data: unknown): UpdateBoard;
  validateCreateCard(data: unknown): CreateCard;
  validateUpdateCard(data: unknown): UpdateCard;
  validateCreateColumn(data: unknown): CreateColumn;
  validateUpdateColumn(data: unknown): UpdateColumn;
  validatePagination(data: unknown): PaginationParams;
  validateSort(data: unknown): SortParams;
  validateCardFilter(data: unknown): CardFilter;
}