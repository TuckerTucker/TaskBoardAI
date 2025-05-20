# 3. Repository Layer

## Objective
Create a data access layer that abstracts filesystem operations and provides a consistent interface for all data interactions.

## Implementation Tasks

### 3.1 Repository Base Interface

**`server/core/repositories/base.repository.ts`:**
```typescript
/**
 * Generic repository interface defining common CRUD operations
 */
export interface Repository<T, CreateDto, UpdateDto> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T>;
  create(data: CreateDto): Promise<T>;
  update(id: string, data: UpdateDto): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

/**
 * Generic repository error options
 */
export interface RepositoryErrorOptions {
  context?: string;
  id?: string;
  code?: string;
  details?: any;
}

/**
 * Base repository error class
 */
export class RepositoryError extends Error {
  context: string;
  id?: string;
  code: string;
  details?: any;

  constructor(message: string, options: RepositoryErrorOptions = {}) {
    super(message);
    this.name = 'RepositoryError';
    this.context = options.context || 'repository';
    this.id = options.id;
    this.code = options.code || 'REPOSITORY_ERROR';
    this.details = options.details;
  }
}

/**
 * Error thrown when an entity is not found
 */
export class NotFoundError extends RepositoryError {
  constructor(message: string, options: RepositoryErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'NOT_FOUND',
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a data conflict occurs
 */
export class ConflictError extends RepositoryError {
  constructor(message: string, options: RepositoryErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'CONFLICT',
    });
    this.name = 'ConflictError';
  }
}

/**
 * Error thrown when validation fails in the repository
 */
export class ValidationError extends RepositoryError {
  constructor(message: string, options: RepositoryErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'VALIDATION_ERROR',
    });
    this.name = 'ValidationError';
  }
}
```

### 3.2 File System Repository Base Class

**`server/core/repositories/filesystem.repository.ts`:**
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { Repository, NotFoundError, ValidationError } from './base.repository';

/**
 * Base class for repositories that store data in the filesystem
 */
export abstract class FileSystemRepository<T extends { id: string }, CreateDto, UpdateDto> 
  implements Repository<T, CreateDto, UpdateDto> {
  
  protected directory: string;
  protected fileExtension: string;
  protected validate: (data: any) => boolean;
  protected entityName: string;

  constructor(options: {
    directory: string;
    fileExtension?: string;
    validate?: (data: any) => boolean;
    entityName?: string;
  }) {
    this.directory = options.directory;
    this.fileExtension = options.fileExtension || '.json';
    this.validate = options.validate || (() => true);
    this.entityName = options.entityName || 'entity';
  }

  /**
   * Ensures the storage directory exists
   */
  protected async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory: ${this.directory}`);
    }
  }

  /**
   * Gets the file path for an entity
   */
  protected getFilePath(id: string): string {
    return path.join(this.directory, `${id}${this.fileExtension}`);
  }

  /**
   * Reads an entity from the filesystem
   */
  protected async readFile<DataType>(filePath: string): Promise<DataType> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        const id = path.basename(filePath, this.fileExtension);
        throw new NotFoundError(
          `${this.entityName} with ID ${id} not found`,
          { id, context: this.entityName }
        );
      }
      throw error;
    }
  }

  /**
   * Writes an entity to the filesystem
   */
  protected async writeFile(filePath: string, data: any): Promise<void> {
    await this.ensureDirectory();
    
    if (!this.validate(data)) {
      throw new ValidationError(
        `Invalid ${this.entityName} data`,
        { context: this.entityName, details: data }
      );
    }
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Lists all entity files in the directory
   */
  protected async listFiles(): Promise<string[]> {
    await this.ensureDirectory();
    
    const files = await fs.readdir(this.directory);
    return files
      .filter(file => file.endsWith(this.fileExtension))
      .map(file => path.join(this.directory, file));
  }

  /**
   * Implementation of finding all entities
   */
  public async findAll(): Promise<T[]> {
    const filePaths = await this.listFiles();
    const entities: T[] = [];
    
    for (const filePath of filePaths) {
      try {
        const entity = await this.readFile<T>(filePath);
        entities.push(entity);
      } catch (error) {
        // Log error but continue with other files
        console.error(`Error reading file ${filePath}:`, error);
      }
    }
    
    return entities;
  }

  /**
   * Implementation of finding an entity by ID
   */
  public async findById(id: string): Promise<T> {
    const filePath = this.getFilePath(id);
    return this.readFile<T>(filePath);
  }

  /**
   * Checks if an entity exists
   */
  public async exists(id: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(id);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Abstract methods to be implemented by concrete repositories
   */
  public abstract create(data: CreateDto): Promise<T>;
  public abstract update(id: string, data: UpdateDto): Promise<T>;
  public abstract delete(id: string): Promise<void>;
}
```

### 3.3 Board Repository

**`server/core/repositories/board.repository.ts`:**
```typescript
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { FileSystemRepository } from './filesystem.repository';
import { NotFoundError, ConflictError } from './base.repository';
import { Board, BoardCreation, BoardUpdate } from '@core/schemas/board.schema';
import { validate } from '@core/schemas/utils/validate';
import { boardSchemas } from '@core/schemas';
import { AppConfig } from '@core/schemas/config.schema';

export class BoardRepository extends FileSystemRepository<Board, BoardCreation, BoardUpdate> {
  private backupDir: string;
  private templateDir: string;
  private archiveDir: string;
  
  constructor(config: AppConfig) {
    super({
      directory: config.boardsDir,
      fileExtension: '.json',
      entityName: 'board',
      validate: (data) => validate(boardSchemas.v1, data),
    });
    
    this.backupDir = path.join(config.boardsDir, 'backups');
    this.templateDir = config.templateBoardsDir;
    this.archiveDir = path.join(config.boardsDir, 'archives');
  }

  /**
   * Create a new board
   */
  public async create(data: BoardCreation): Promise<Board> {
    // Generate ID if not provided
    const id = data.id || crypto.randomUUID();
    const filePath = this.getFilePath(id);
    
    // Check if board already exists
    if (await this.exists(id)) {
      throw new ConflictError(`Board with ID ${id} already exists`, {
        id,
        context: 'board',
      });
    }
    
    // Ensure all columns have IDs
    const columns = data.columns || [];
    const columnsWithIds = columns.map(column => ({
      ...column,
      id: column.id || crypto.randomUUID(),
    }));
    
    // Generate timestamp
    const now = new Date().toISOString();
    
    // Create board data
    const board: Board = {
      id,
      projectName: data.projectName,
      columns: columnsWithIds,
      cards: [],
      last_updated: now,
      ...(data.description ? { description: data.description } : {}),
    };
    
    // Validate and write
    await this.writeFile(filePath, board);
    
    return board;
  }

  /**
   * Update an existing board
   */
  public async update(id: string, data: BoardUpdate): Promise<Board> {
    // Get existing board
    const existingBoard = await this.findById(id);
    
    // Create backup before update
    await this.createBackup(id, existingBoard, 'pre_update');
    
    // Update fields
    const updatedBoard: Board = {
      ...existingBoard,
      ...data,
      id, // Ensure ID doesn't change
      last_updated: new Date().toISOString(),
    };
    
    // Ensure columns and cards arrays are preserved if not in update
    if (!data.columns) {
      updatedBoard.columns = existingBoard.columns;
    }
    
    if (!data.cards) {
      updatedBoard.cards = existingBoard.cards;
    }
    
    // Write updated board
    const filePath = this.getFilePath(id);
    await this.writeFile(filePath, updatedBoard);
    
    return updatedBoard;
  }

  /**
   * Delete a board
   */
  public async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    
    // Check if board exists
    if (!await this.exists(id)) {
      throw new NotFoundError(`Board with ID ${id} not found`, {
        id,
        context: 'board',
      });
    }
    
    // Create backup before deletion
    try {
      const board = await this.findById(id);
      await this.createBackup(id, board, 'pre_deletion');
    } catch (error) {
      // Continue with deletion even if backup fails
      console.error(`Failed to backup board ${id} before deletion:`, error);
    }
    
    // Delete the file
    await fs.unlink(filePath);
  }

  /**
   * Create a backup of a board
   */
  private async createBackup(id: string, data: Board, type: string): Promise<string> {
    await fs.mkdir(this.backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `${id}_${timestamp}_${type}.json`);
    
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2));
    await this.rotateBackups(id);
    
    return backupPath;
  }

  /**
   * Rotate backups to prevent excessive disk usage
   */
  private async rotateBackups(id: string, maxBackups = 10): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const boardBackups = files
        .filter(file => file.startsWith(`${id}_`) && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (boardBackups.length > maxBackups) {
        for (let i = maxBackups; i < boardBackups.length; i++) {
          try {
            await fs.unlink(path.join(this.backupDir, boardBackups[i]));
          } catch (error) {
            console.error(`Failed to delete old backup ${boardBackups[i]}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to rotate backups for board ${id}:`, error);
    }
  }

  /**
   * Archive a board
   */
  public async archive(id: string): Promise<Board> {
    // Get the board
    const board = await this.findById(id);
    
    // Create archives directory if it doesn't exist
    await fs.mkdir(this.archiveDir, { recursive: true });
    
    // Add archive timestamp
    const archivedBoard = {
      ...board,
      archivedAt: new Date().toISOString(),
    };
    
    // Write to archive
    const archivePath = path.join(this.archiveDir, `${id}.json`);
    await fs.writeFile(archivePath, JSON.stringify(archivedBoard, null, 2));
    
    // Delete original
    await this.delete(id);
    
    return archivedBoard;
  }

  /**
   * List archived boards
   */
  public async listArchives(): Promise<Array<Board & { archivedAt: string }>> {
    try {
      await fs.mkdir(this.archiveDir, { recursive: true });
      
      const files = await fs.readdir(this.archiveDir);
      const archiveFiles = files.filter(file => file.endsWith('.json'));
      
      const archives = [];
      
      for (const file of archiveFiles) {
        try {
          const filePath = path.join(this.archiveDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const board = JSON.parse(data);
          archives.push(board);
        } catch (error) {
          console.error(`Failed to read archive ${file}:`, error);
        }
      }
      
      return archives;
    } catch (error) {
      console.error('Failed to list archives:', error);
      return [];
    }
  }

  /**
   * Restore an archived board
   */
  public async restore(id: string): Promise<Board> {
    const archivePath = path.join(this.archiveDir, `${id}.json`);
    
    try {
      // Read archive
      const data = await fs.readFile(archivePath, 'utf8');
      const archivedBoard = JSON.parse(data);
      
      // Remove archive timestamp
      const { archivedAt, ...board } = archivedBoard;
      
      // Update timestamp
      const restoredBoard = {
        ...board,
        last_updated: new Date().toISOString(),
      };
      
      // Write to boards directory
      const filePath = this.getFilePath(id);
      await this.writeFile(filePath, restoredBoard);
      
      // Delete archive
      await fs.unlink(archivePath);
      
      return restoredBoard;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError(`Archive with ID ${id} not found`, {
          id,
          context: 'archive',
        });
      }
      throw error;
    }
  }

  /**
   * Import a board from provided data
   */
  public async import(data: Board): Promise<Board> {
    const id = data.id || crypto.randomUUID();
    const filePath = this.getFilePath(id);
    
    // Check if board already exists
    if (await this.exists(id)) {
      throw new ConflictError(`Board with ID ${id} already exists`, {
        id,
        context: 'board',
      });
    }
    
    // Set or update timestamp
    const importedBoard: Board = {
      ...data,
      id,
      last_updated: new Date().toISOString(),
    };
    
    // Write board
    await this.writeFile(filePath, importedBoard);
    
    return importedBoard;
  }

  /**
   * Create a board from a template
   */
  public async createFromTemplate(name: string, templateName = '_kanban_example'): Promise<Board> {
    const templatePath = path.join(this.templateDir, `${templateName}.json`);
    
    try {
      // Read template
      const templateData = await fs.readFile(templatePath, 'utf8');
      const template = JSON.parse(templateData);
      
      // Generate new ID
      const id = crypto.randomUUID();
      
      // Generate timestamps
      const now = new Date().toISOString();
      
      // Create ID mapping for references
      const idMap: Record<string, string> = {};
      
      // Generate new IDs for columns
      const columns = template.columns.map((col: any) => {
        const oldId = col.id;
        const newId = crypto.randomUUID();
        idMap[oldId] = newId;
        return { ...col, id: newId };
      });
      
      // Generate new IDs for cards and update references
      const cards = template.cards ? template.cards.map((card: any) => {
        const oldId = card.id;
        const newId = crypto.randomUUID();
        idMap[oldId] = newId;
        
        // Update columnId reference
        const columnId = card.columnId && idMap[card.columnId] 
          ? idMap[card.columnId] 
          : columns[0].id;
        
        // Update dependency references
        const dependencies = Array.isArray(card.dependencies)
          ? card.dependencies.map((depId: string) => idMap[depId]).filter(Boolean)
          : [];
        
        return {
          ...card,
          id: newId,
          columnId,
          dependencies,
          created_at: now,
          updated_at: now,
          // Remove status timestamps
          completed_at: null,
          blocked_at: null,
        };
      }) : [];
      
      // Create new board
      const board: Board = {
        id,
        projectName: name.trim(),
        columns,
        cards,
        last_updated: now,
      };
      
      // Write board file
      const filePath = this.getFilePath(id);
      await this.writeFile(filePath, board);
      
      return board;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError(`Template ${templateName} not found`, {
          context: 'template',
        });
      }
      throw error;
    }
  }
}
```

### 3.4 Card Repository

**`server/core/repositories/card.repository.ts`:**
```typescript
import { NotFoundError } from './base.repository';
import { Card, CardCreation, CardUpdate } from '@core/schemas/card.schema';
import { Board } from '@core/schemas/board.schema';
import { PositionSpec } from '@core/schemas/operations.schema';
import { BoardRepository } from './board.repository';

export class CardRepository {
  constructor(private boardRepository: BoardRepository) {}

  /**
   * Find all cards on a board
   */
  public async findAll(boardId: string): Promise<Card[]> {
    const board = await this.boardRepository.findById(boardId);
    return board.cards || [];
  }

  /**
   * Find cards in a specific column
   */
  public async findByColumn(boardId: string, columnId: string): Promise<Card[]> {
    const cards = await this.findAll(boardId);
    return cards.filter(card => card.columnId === columnId);
  }

  /**
   * Find a specific card by ID
   */
  public async findById(boardId: string, cardId: string): Promise<Card> {
    const cards = await this.findAll(boardId);
    const card = cards.find(c => c.id === cardId);
    
    if (!card) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    return card;
  }

  /**
   * Create a new card
   */
  public async create(boardId: string, data: CardCreation): Promise<Card> {
    // Get board
    const board = await this.boardRepository.findById(boardId);
    
    // Ensure board has a cards array
    if (!board.cards) {
      board.cards = [];
    }
    
    // Check if column exists
    const columnExists = board.columns.some(col => col.id === data.columnId);
    if (!columnExists) {
      throw new NotFoundError(`Column with ID ${data.columnId} not found`, {
        id: data.columnId,
        context: 'column',
      });
    }
    
    // Get cards in the same column
    const cardsInColumn = board.cards.filter(c => c.columnId === data.columnId);
    
    // Determine position (default to end)
    const position = cardsInColumn.length;
    
    // Generate timestamp
    const now = new Date().toISOString();
    
    // Create card
    const card: Card = {
      id: crypto.randomUUID(),
      title: data.title,
      columnId: data.columnId,
      position,
      created_at: now,
      updated_at: now,
      ...data,
    };
    
    // Add to board
    board.cards.push(card);
    board.last_updated = now;
    
    // Save board
    await this.boardRepository.update(boardId, board);
    
    return card;
  }

  /**
   * Update an existing card
   */
  public async update(boardId: string, cardId: string, data: CardUpdate): Promise<Card> {
    // Get board
    const board = await this.boardRepository.findById(boardId);
    
    // Ensure board has a cards array
    if (!board.cards) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    // Find card index
    const cardIndex = board.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    // Check if moving to a different column
    if (data.columnId && data.columnId !== board.cards[cardIndex].columnId) {
      // Verify column exists
      const columnExists = board.columns.some(col => col.id === data.columnId);
      if (!columnExists) {
        throw new NotFoundError(`Column with ID ${data.columnId} not found`, {
          id: data.columnId,
          context: 'column',
        });
      }
    }
    
    // Update card
    const updatedCard: Card = {
      ...board.cards[cardIndex],
      ...data,
      id: cardId, // Ensure ID doesn't change
      updated_at: new Date().toISOString(),
    };
    
    // Replace card in board
    board.cards[cardIndex] = updatedCard;
    board.last_updated = updatedCard.updated_at;
    
    // Save board
    await this.boardRepository.update(boardId, board);
    
    return updatedCard;
  }

  /**
   * Delete a card
   */
  public async delete(boardId: string, cardId: string): Promise<void> {
    // Get board
    const board = await this.boardRepository.findById(boardId);
    
    // Ensure board has a cards array
    if (!board.cards) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    // Find card
    const cardIndex = board.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    // Get card data for adjusting positions
    const card = board.cards[cardIndex];
    
    // Remove card
    board.cards.splice(cardIndex, 1);
    
    // Update positions of cards in the same column
    board.cards.forEach(c => {
      if (c.columnId === card.columnId && c.position > card.position) {
        c.position--;
      }
    });
    
    // Update timestamp
    board.last_updated = new Date().toISOString();
    
    // Save board
    await this.boardRepository.update(boardId, board);
  }

  /**
   * Move a card to a different position or column
   */
  public async move(
    boardId: string, 
    cardId: string, 
    columnId: string, 
    position: PositionSpec
  ): Promise<Card> {
    // Get board
    const board = await this.boardRepository.findById(boardId);
    
    // Ensure board has a cards array
    if (!board.cards) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    // Find card
    const cardIndex = board.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      throw new NotFoundError(`Card with ID ${cardId} not found`, {
        id: cardId,
        context: 'card',
      });
    }
    
    // Verify column exists
    const columnExists = board.columns.some(col => col.id === columnId);
    if (!columnExists) {
      throw new NotFoundError(`Column with ID ${columnId} not found`, {
        id: columnId,
        context: 'column',
      });
    }
    
    // Get card
    const card = board.cards[cardIndex];
    
    // Get cards in target column (excluding the card being moved)
    const cardsInTarget = board.cards
      .filter(c => c.columnId === columnId && c.id !== cardId)
      .sort((a, b) => a.position - b.position);
    
    // Calculate new position
    let newPosition: number;
    
    if (typeof position === 'number') {
      // Use specified position, clamped to valid range
      newPosition = Math.min(Math.max(0, position), cardsInTarget.length);
    } else {
      switch (position) {
        case 'first':
          newPosition = 0;
          break;
        case 'last':
          newPosition = cardsInTarget.length;
          break;
        case 'up':
          if (card.columnId !== columnId) {
            throw new Error("Cannot use 'up' when moving to a different column");
          }
          newPosition = Math.max(0, card.position - 1);
          break;
        case 'down':
          if (card.columnId !== columnId) {
            throw new Error("Cannot use 'down' when moving to a different column");
          }
          newPosition = card.position + 1;
          break;
        default:
          newPosition = cardsInTarget.length;
      }
    }
    
    // Adjust positions
    if (columnId === card.columnId) {
      // Moving within the same column
      board.cards.forEach(c => {
        if (c.id !== cardId && c.columnId === columnId) {
          if (card.position < newPosition && c.position > card.position && c.position <= newPosition) {
            c.position--;
          } else if (card.position > newPosition && c.position >= newPosition && c.position < card.position) {
            c.position++;
          }
        }
      });
    } else {
      // Moving to a different column
      // Decrement positions in source column
      board.cards.forEach(c => {
        if (c.columnId === card.columnId && c.position > card.position) {
          c.position--;
        }
      });
      
      // Increment positions in target column
      board.cards.forEach(c => {
        if (c.columnId === columnId && c.position >= newPosition) {
          c.position++;
        }
      });
    }
    
    // Update card
    card.columnId = columnId;
    card.position = newPosition;
    card.updated_at = new Date().toISOString();
    
    // Update board timestamp
    board.last_updated = card.updated_at;
    
    // Save board
    await this.boardRepository.update(boardId, board);
    
    return card;
  }

  /**
   * Perform multiple card operations in one transaction
   */
  public async batchOperations(
    boardId: string, 
    operations: Array<{
      type: 'create' | 'update' | 'delete' | 'move';
      cardId?: string;
      data?: CardCreation | CardUpdate;
      columnId?: string;
      position?: PositionSpec;
    }>
  ): Promise<{
    success: boolean;
    results: Array<{
      type: string;
      cardId?: string;
      success: boolean;
      error?: string;
    }>;
    newCards: Card[];
  }> {
    // Get board
    const board = await this.boardRepository.findById(boardId);
    
    // Ensure board has a cards array
    if (!board.cards) {
      board.cards = [];
    }
    
    // Create a working copy of the board
    const workingBoard: Board = JSON.parse(JSON.stringify(board));
    
    // Track operation results
    const results: Array<{
      type: string;
      cardId?: string;
      success: boolean;
      error?: string;
    }> = [];
    
    // Track newly created cards
    const newCards: Card[] = [];
    
    // ID mapping for referencing new cards
    const idMap: Record<string, string> = {};
    
    try {
      // Process operations
      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'create': {
              if (!operation.data) {
                throw new Error('Card data is required for create operations');
              }
              
              // Generate ID
              const id = crypto.randomUUID();
              
              // Get column ID
              const columnId = operation.data.columnId;
              
              // Check if column exists
              const columnExists = workingBoard.columns.some(col => col.id === columnId);
              if (!columnExists) {
                throw new Error(`Column with ID ${columnId} not found`);
              }
              
              // Get cards in the same column
              const cardsInColumn = workingBoard.cards.filter(c => c.columnId === columnId);
              
              // Set position
              const position = typeof operation.position === 'number'
                ? Math.min(Math.max(0, operation.position), cardsInColumn.length)
                : cardsInColumn.length;
              
              // Increment positions of cards after the insertion point
              workingBoard.cards.forEach(c => {
                if (c.columnId === columnId && c.position >= position) {
                  c.position++;
                }
              });
              
              // Generate timestamp
              const now = new Date().toISOString();
              
              // Create card
              const card: Card = {
                id,
                title: operation.data.title,
                columnId,
                position,
                created_at: now,
                updated_at: now,
                ...operation.data,
              };
              
              // Add to working board and new cards list
              workingBoard.cards.push(card);
              newCards.push(card);
              
              // Add to result
              results.push({
                type: 'create',
                cardId: id,
                success: true,
              });
              
              break;
            }
            
            case 'update': {
              if (!operation.cardId) {
                throw new Error('Card ID is required for update operations');
              }
              
              if (!operation.data) {
                throw new Error('Card data is required for update operations');
              }
              
              // Find card
              const cardIndex = workingBoard.cards.findIndex(c => c.id === operation.cardId);
              if (cardIndex === -1) {
                throw new Error(`Card with ID ${operation.cardId} not found`);
              }
              
              // Check if moving to a different column
              if (operation.data.columnId && operation.data.columnId !== workingBoard.cards[cardIndex].columnId) {
                // Verify column exists
                const columnExists = workingBoard.columns.some(col => col.id === operation.data.columnId);
                if (!columnExists) {
                  throw new Error(`Column with ID ${operation.data.columnId} not found`);
                }
              }
              
              // Update card
              workingBoard.cards[cardIndex] = {
                ...workingBoard.cards[cardIndex],
                ...operation.data,
                id: operation.cardId, // Ensure ID doesn't change
                updated_at: new Date().toISOString(),
              };
              
              // Add to result
              results.push({
                type: 'update',
                cardId: operation.cardId,
                success: true,
              });
              
              break;
            }
            
            case 'delete': {
              if (!operation.cardId) {
                throw new Error('Card ID is required for delete operations');
              }
              
              // Find card
              const cardIndex = workingBoard.cards.findIndex(c => c.id === operation.cardId);
              if (cardIndex === -1) {
                throw new Error(`Card with ID ${operation.cardId} not found`);
              }
              
              // Get card data for adjusting positions
              const card = workingBoard.cards[cardIndex];
              
              // Remove card
              workingBoard.cards.splice(cardIndex, 1);
              
              // Update positions of cards in the same column
              workingBoard.cards.forEach(c => {
                if (c.columnId === card.columnId && c.position > card.position) {
                  c.position--;
                }
              });
              
              // Add to result
              results.push({
                type: 'delete',
                cardId: operation.cardId,
                success: true,
              });
              
              break;
            }
            
            case 'move': {
              if (!operation.cardId) {
                throw new Error('Card ID is required for move operations');
              }
              
              if (!operation.columnId) {
                throw new Error('Column ID is required for move operations');
              }
              
              if (operation.position === undefined) {
                throw new Error('Position is required for move operations');
              }
              
              // Find card
              const cardIndex = workingBoard.cards.findIndex(c => c.id === operation.cardId);
              if (cardIndex === -1) {
                throw new Error(`Card with ID ${operation.cardId} not found`);
              }
              
              // Verify column exists
              const columnExists = workingBoard.columns.some(col => col.id === operation.columnId);
              if (!columnExists) {
                throw new Error(`Column with ID ${operation.columnId} not found`);
              }
              
              // Get card
              const card = workingBoard.cards[cardIndex];
              
              // Get cards in target column (excluding the card being moved)
              const cardsInTarget = workingBoard.cards
                .filter(c => c.columnId === operation.columnId && c.id !== operation.cardId)
                .sort((a, b) => a.position - b.position);
              
              // Calculate new position
              let newPosition: number;
              
              if (typeof operation.position === 'number') {
                // Use specified position, clamped to valid range
                newPosition = Math.min(Math.max(0, operation.position), cardsInTarget.length);
              } else {
                switch (operation.position) {
                  case 'first':
                    newPosition = 0;
                    break;
                  case 'last':
                    newPosition = cardsInTarget.length;
                    break;
                  case 'up':
                    if (card.columnId !== operation.columnId) {
                      throw new Error("Cannot use 'up' when moving to a different column");
                    }
                    newPosition = Math.max(0, card.position - 1);
                    break;
                  case 'down':
                    if (card.columnId !== operation.columnId) {
                      throw new Error("Cannot use 'down' when moving to a different column");
                    }
                    newPosition = card.position + 1;
                    break;
                  default:
                    newPosition = cardsInTarget.length;
                }
              }
              
              // Adjust positions
              if (operation.columnId === card.columnId) {
                // Moving within the same column
                workingBoard.cards.forEach(c => {
                  if (c.id !== operation.cardId && c.columnId === operation.columnId) {
                    if (card.position < newPosition && c.position > card.position && c.position <= newPosition) {
                      c.position--;
                    } else if (card.position > newPosition && c.position >= newPosition && c.position < card.position) {
                      c.position++;
                    }
                  }
                });
              } else {
                // Moving to a different column
                // Decrement positions in source column
                workingBoard.cards.forEach(c => {
                  if (c.columnId === card.columnId && c.position > card.position) {
                    c.position--;
                  }
                });
                
                // Increment positions in target column
                workingBoard.cards.forEach(c => {
                  if (c.columnId === operation.columnId && c.position >= newPosition) {
                    c.position++;
                  }
                });
              }
              
              // Update card
              card.columnId = operation.columnId;
              card.position = newPosition;
              card.updated_at = new Date().toISOString();
              
              // Add to result
              results.push({
                type: 'move',
                cardId: operation.cardId,
                success: true,
              });
              
              break;
            }
            
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }
        } catch (error: any) {
          // Add failure to results
          results.push({
            type: operation.type,
            cardId: operation.cardId,
            success: false,
            error: error.message,
          });
          
          // Continue with next operation
        }
      }
      
      // Update board timestamp
      workingBoard.last_updated = new Date().toISOString();
      
      // Save working board back to repository
      await this.boardRepository.update(boardId, workingBoard);
      
      return {
        success: results.every(r => r.success),
        results,
        newCards,
      };
    } catch (error: any) {
      // Handle overall failure
      return {
        success: false,
        results: [
          ...results,
          {
            type: 'batch',
            success: false,
            error: error.message,
          },
        ],
        newCards,
      };
    }
  }
}
```

### 3.5 Config Repository

**`server/core/repositories/config.repository.ts`:**
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileSystemRepository } from './filesystem.repository';
import { AppConfig, ConfigUpdate } from '@core/schemas/config.schema';
import { validate } from '@core/schemas/utils/validate';
import { configSchemas } from '@core/schemas';

export class ConfigRepository extends FileSystemRepository<AppConfig, AppConfig, ConfigUpdate> {
  private configPath: string;
  private defaultConfig: AppConfig;
  
  constructor(options: {
    configDir: string;
    configFile?: string;
    defaultConfig: AppConfig;
  }) {
    super({
      directory: options.configDir,
      fileExtension: '.json',
      entityName: 'config',
      validate: (data) => validate(configSchemas.app, data),
    });
    
    this.configPath = path.join(options.configDir, options.configFile || 'config.json');
    this.defaultConfig = options.defaultConfig;
  }

  /**
   * Get the application configuration
   */
  public async getConfig(): Promise<AppConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Create default config if it doesn't exist
        await this.ensureDirectory();
        await fs.writeFile(this.configPath, JSON.stringify(this.defaultConfig, null, 2));
        return this.defaultConfig;
      }
      throw error;
    }
  }

  /**
   * Update the application configuration
   */
  public async updateConfig(data: ConfigUpdate): Promise<AppConfig> {
    try {
      // Get existing config
      const existingConfig = await this.getConfig();
      
      // Merge with updates
      const updatedConfig: AppConfig = {
        ...existingConfig,
        ...data,
      };
      
      // Validate
      validate(configSchemas.app, updatedConfig);
      
      // Save
      await this.ensureDirectory();
      await fs.writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2));
      
      return updatedConfig;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create implementation (uses default config)
   */
  public async create(data: AppConfig): Promise<AppConfig> {
    return this.updateConfig(data);
  }

  /**
   * Update implementation
   */
  public async update(id: string, data: ConfigUpdate): Promise<AppConfig> {
    return this.updateConfig(data);
  }

  /**
   * Delete implementation (resets to default)
   */
  public async delete(id: string): Promise<void> {
    await this.ensureDirectory();
    await fs.writeFile(this.configPath, JSON.stringify(this.defaultConfig, null, 2));
  }

  /**
   * Find by ID (not applicable for config)
   */
  public async findById(id: string): Promise<AppConfig> {
    return this.getConfig();
  }

  /**
   * Find all (returns just the single config)
   */
  public async findAll(): Promise<AppConfig[]> {
    const config = await this.getConfig();
    return [config];
  }
}
```

### 3.6 Webhook Repository

**`server/core/repositories/webhook.repository.ts`:**
```typescript
import crypto from 'node:crypto';
import { FileSystemRepository } from './filesystem.repository';
import { NotFoundError } from './base.repository';
import { Webhook, WebhookCreation, WebhookUpdate } from '@core/schemas/webhook.schema';
import { validate } from '@core/schemas/utils/validate';
import { webhookSchemas } from '@core/schemas';
import { AppConfig } from '@core/schemas/config.schema';
import fetch from 'node-fetch';

export class WebhookRepository extends FileSystemRepository<Webhook, WebhookCreation, WebhookUpdate> {
  constructor(config: AppConfig) {
    super({
      directory: path.join(config.boardsDir, 'webhooks'),
      fileExtension: '.json',
      entityName: 'webhook',
      validate: (data) => validate(webhookSchemas.v1, data),
    });
  }

  /**
   * Create a new webhook
   */
  public async create(data: WebhookCreation): Promise<Webhook> {
    // Generate ID and timestamps
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Create webhook
    const webhook: Webhook = {
      id,
      name: data.name,
      url: data.url,
      event: data.event,
      created_at: now,
      updated_at: now,
      active: data.active !== false, // Default to active if not specified
      ...(data.secret ? { secret: data.secret } : {}),
    };
    
    // Save webhook
    const filePath = this.getFilePath(id);
    await this.writeFile(filePath, webhook);
    
    return webhook;
  }

  /**
   * Update an existing webhook
   */
  public async update(id: string, data: WebhookUpdate): Promise<Webhook> {
    // Get existing webhook
    const webhook = await this.findById(id);
    
    // Update webhook
    const updatedWebhook: Webhook = {
      ...webhook,
      ...data,
      id, // Ensure ID doesn't change
      updated_at: new Date().toISOString(),
    };
    
    // Save webhook
    const filePath = this.getFilePath(id);
    await this.writeFile(filePath, updatedWebhook);
    
    return updatedWebhook;
  }

  /**
   * Delete a webhook
   */
  public async delete(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    
    // Check if webhook exists
    if (!await this.exists(id)) {
      throw new NotFoundError(`Webhook with ID ${id} not found`, {
        id,
        context: 'webhook',
      });
    }
    
    // Delete the file
    await fs.unlink(filePath);
  }

  /**
   * Trigger a webhook
   */
  public async trigger(id: string, payload: any): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    try {
      // Get webhook
      const webhook = await this.findById(id);
      
      // Check if webhook is active
      if (webhook.active === false) {
        return {
          success: false,
          message: 'Webhook is not active',
        };
      }
      
      // Generate signature if secret is provided
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'TaskBoardAI-Webhook',
      };
      
      if (webhook.secret) {
        const signature = this.generateSignature(payload, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }
      
      // Send webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      return {
        success: response.ok,
        statusCode: response.status,
        message: response.ok ? 'Webhook triggered successfully' : `Error: ${response.status} ${response.statusText}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error triggering webhook: ${error.message}`,
      };
    }
  }

  /**
   * Test a webhook connection
   */
  public async testConnection(url: string): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    try {
      // Send test request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TaskBoardAI-Webhook-Test',
        },
        body: JSON.stringify({
          event: 'webhook.test',
          timestamp: new Date().toISOString(),
          data: {
            message: 'This is a test webhook from TaskBoardAI',
          },
        }),
      });
      
      return {
        success: response.ok,
        statusCode: response.status,
        message: response.ok ? 'Connection test successful' : `Error: ${response.status} ${response.statusText}`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection error: ${error.message}`,
      };
    }
  }

  /**
   * Generate a signature for a webhook payload
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(typeof payload === 'string' ? payload : JSON.stringify(payload));
    return hmac.digest('hex');
  }
}
```

### 3.7 Repository Index File

**`server/core/repositories/index.ts`:**
```typescript
// Export all repositories through barrel file
export * from './base.repository';
export * from './filesystem.repository';
export * from './board.repository';
export * from './card.repository';
export * from './config.repository';
export * from './webhook.repository';
```

## Expected Outcome
- Complete data access layer with consistent interfaces
- Clear separation of persistence logic from business logic
- Type safety for all data operations
- Error handling specific to data access operations
- Support for optimistic locking and concurrency
- Foundation for the service layer implementations