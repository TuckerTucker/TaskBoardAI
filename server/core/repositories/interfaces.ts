import { Board, Card, Column, Config, PaginationParams, SortParams, CardFilter } from '@core/schemas';
import { BoardQuery, CardQuery } from '@core/schemas/querySchemas';

export interface IRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  findAll(pagination?: PaginationParams, sort?: SortParams): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(data: TCreate): Promise<T>;
  update(id: string, data: TUpdate): Promise<T>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface IBoardRepository extends IRepository<Board> {
  findByTitle(title: string): Promise<Board | null>;
  findCardsInColumn(boardId: string, columnId: string): Promise<Card[]>;
  addCard(boardId: string, card: Card): Promise<Board>;
  updateCard(boardId: string, cardId: string, updates: Partial<Card>): Promise<Board>;
  deleteCard(boardId: string, cardId: string): Promise<Board>;
  moveCard(boardId: string, cardId: string, toColumnId: string, position: number): Promise<Board>;
  addColumn(boardId: string, column: Column): Promise<Board>;
  updateColumn(boardId: string, columnId: string, updates: Partial<Column>): Promise<Board>;
  deleteColumn(boardId: string, columnId: string): Promise<Board>;
  reorderColumns(boardId: string, columnOrder: string[]): Promise<Board>;
  findCards(boardId: string, filter?: CardFilter, pagination?: PaginationParams): Promise<Card[]>;
  searchCards(boardId: string, query: string): Promise<Card[]>;
  getCardCount(boardId: string, columnId?: string): Promise<number>;
  queryBoards(query: BoardQuery): Promise<Board[]>;
  queryCards(boardId: string, query: CardQuery): Promise<Card[]>;
}

export interface IConfigRepository extends IRepository<Config> {
  getDefault(): Promise<Config>;
  updateServerConfig(updates: Partial<Config['server']>): Promise<Config>;
  updateDefaultsConfig(updates: Partial<Config['defaults']>): Promise<Config>;
  reset(): Promise<Config>;
}

export interface IFileSystemRepository {
  exists(path: string): Promise<boolean>;
  read<T>(path: string): Promise<T>;
  write<T>(path: string, data: T): Promise<void>;
  delete(path: string): Promise<boolean>;
  list(directory: string): Promise<string[]>;
  createDirectory(path: string): Promise<void>;
  backup(sourcePath: string, backupPath: string): Promise<void>;
}