# 4. Service Layer Foundation

## Objective
Implement a service layer that encapsulates business logic and provides a consistent API for all interfaces (MCP, REST API, CLI).

## Implementation Tasks

### 4.1 Service Layer Infrastructure

**`server/core/services/base.service.ts`:**
```typescript
import { RepositoryError } from '@core/repositories/base.repository';

/**
 * Base service error options
 */
export interface ServiceErrorOptions {
  cause?: Error;
  code?: string;
  details?: any;
}

/**
 * Base service error class
 */
export class ServiceError extends Error {
  cause?: Error;
  code: string;
  details?: any;

  constructor(message: string, options: ServiceErrorOptions = {}) {
    super(message);
    this.name = 'ServiceError';
    this.cause = options.cause;
    this.code = options.code || 'SERVICE_ERROR';
    this.details = options.details;
  }
}

/**
 * Error thrown when a required resource is not found
 */
export class NotFoundError extends ServiceError {
  constructor(message: string, options: ServiceErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'NOT_FOUND',
    });
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a request is invalid
 */
export class ValidationError extends ServiceError {
  constructor(message: string, options: ServiceErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'VALIDATION_ERROR',
    });
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when an operation cannot be performed due to business rules
 */
export class BusinessRuleError extends ServiceError {
  constructor(message: string, options: ServiceErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'BUSINESS_RULE_ERROR',
    });
    this.name = 'BusinessRuleError';
  }
}

/**
 * Helper to convert repository errors to service errors
 */
export function handleRepositoryError(error: unknown): never {
  if (error instanceof RepositoryError) {
    if (error.code === 'NOT_FOUND') {
      throw new NotFoundError(error.message, {
        cause: error,
        details: error.details,
      });
    } else if (error.code === 'VALIDATION_ERROR') {
      throw new ValidationError(error.message, {
        cause: error,
        details: error.details,
      });
    } else if (error.code === 'CONFLICT') {
      throw new BusinessRuleError(error.message, {
        cause: error,
        code: 'CONFLICT',
        details: error.details,
      });
    }
  }
  
  // If it's not a repository error, rethrow
  throw error;
}
```

### 4.2 Board Service

**`server/core/services/board.service.ts`:**
```typescript
import { 
  BoardRepository, 
  CardRepository,
  NotFoundError as RepoNotFoundError
} from '@core/repositories';
import { 
  Board, 
  BoardCreation, 
  BoardUpdate,
  BoardFormat,
  BoardQuery
} from '@core/schemas/board.schema';
import { handleRepositoryError, NotFoundError } from './base.service';

/**
 * Service for board-related operations
 */
export class BoardService {
  constructor(
    private boardRepository: BoardRepository,
    private cardRepository: CardRepository
  ) {}

  /**
   * Get all boards
   */
  public async getBoards(): Promise<Array<{
    id: string;
    name: string;
    lastUpdated: string;
  }>> {
    try {
      const boards = await this.boardRepository.findAll();
      
      return boards.map(board => ({
        id: board.id,
        name: board.projectName,
        lastUpdated: board.last_updated || new Date().toISOString(),
      }));
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Get a board by ID with formatting options
   */
  public async getBoard(id: string, options?: BoardQuery): Promise<any> {
    try {
      const board = await this.boardRepository.findById(id);
      return this.formatBoard(board, options);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Format a board based on query options
   */
  private formatBoard(board: Board, options?: BoardQuery): any {
    const format = options?.format || 'full';
    const columnId = options?.columnId;
    
    switch (format) {
      case 'summary':
        return this.formatSummary(board);
      case 'compact':
        return this.formatCompact(board);
      case 'cards-only':
        return this.formatCardsOnly(board, columnId);
      case 'full':
      default:
        return this.formatFull(board);
    }
  }

  /**
   * Format a board as a summary (metadata and statistics)
   */
  private formatSummary(board: Board): any {
    // Count cards per column
    const cardsByColumn: Record<string, number> = {};
    let completedCount = 0;
    
    // Initialize counts
    board.columns.forEach(column => {
      cardsByColumn[column.id] = 0;
    });
    
    // Count cards
    if (board.cards) {
      board.cards.forEach(card => {
        if (cardsByColumn[card.columnId] !== undefined) {
          cardsByColumn[card.columnId]++;
        }
        
        if (card.completed_at) {
          completedCount++;
        }
      });
    }
    
    // Calculate stats
    const cardCount = board.cards?.length || 0;
    const progressPercentage = cardCount > 0 
      ? Math.round((completedCount / cardCount) * 100) 
      : 0;
    
    return {
      id: board.id,
      projectName: board.projectName,
      last_updated: board.last_updated,
      columns: board.columns.map(column => ({
        id: column.id,
        name: column.name,
        cardCount: cardsByColumn[column.id] || 0,
      })),
      stats: {
        totalCards: cardCount,
        completedCards: completedCount,
        progressPercentage,
      },
    };
  }

  /**
   * Format a board with compact property names
   */
  private formatCompact(board: Board): any {
    const cards = board.cards ? board.cards.map(card => ({
      id: card.id,
      t: card.title,
      col: card.columnId,
      p: card.position,
      ...(card.content ? { c: card.content } : {}),
      ...(card.collapsed ? { coll: card.collapsed } : {}),
      ...(card.subtasks?.length ? { sub: card.subtasks } : {}),
      ...(card.tags?.length ? { tag: card.tags } : {}),
      ...(card.dependencies?.length ? { dep: card.dependencies } : {}),
      ...(card.created_at ? { ca: card.created_at } : {}),
      ...(card.updated_at ? { ua: card.updated_at } : {}),
      ...(card.completed_at ? { comp: card.completed_at } : {}),
    })) : [];
    
    return {
      id: board.id,
      name: board.projectName,
      up: board.last_updated,
      cols: board.columns.map(col => ({
        id: col.id,
        n: col.name,
      })),
      cards,
    };
  }

  /**
   * Format a board to return only cards
   */
  private formatCardsOnly(board: Board, columnId?: string): any {
    if (!board.cards) {
      return { cards: [] };
    }
    
    let filteredCards = board.cards;
    
    // Filter by column if specified
    if (columnId) {
      filteredCards = board.cards.filter(card => card.columnId === columnId);
    }
    
    return { cards: filteredCards };
  }

  /**
   * Format a board with full details
   */
  private formatFull(board: Board): any {
    return {
      ...board,
      _tips: {
        usage: [
          "Use 'cardService.createCard()' to add new cards",
          "Use 'cardService.updateCard()' to modify cards",
          "Use 'cardService.moveCard()' to change card positions",
          "Use 'boardService.updateBoard()' to modify board properties",
        ],
        boardStructure: {
          id: "The board's unique identifier",
          projectName: "The board's display name",
          columns: "Array of column objects with id and name",
          cards: "Array of card objects with card data",
          last_updated: "ISO timestamp of last update",
        },
      },
    };
  }

  /**
   * Create a new board
   */
  public async createBoard(data: BoardCreation): Promise<Board> {
    try {
      return await this.boardRepository.create(data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Create a board from a template
   */
  public async createBoardFromTemplate(name: string, template = '_kanban_example'): Promise<Board> {
    try {
      return await this.boardRepository.createFromTemplate(name, template);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Update a board
   */
  public async updateBoard(id: string, data: BoardUpdate): Promise<Board> {
    try {
      return await this.boardRepository.update(id, data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Delete a board
   */
  public async deleteBoard(id: string): Promise<void> {
    try {
      await this.boardRepository.delete(id);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Import a board from external data
   */
  public async importBoard(data: Board): Promise<Board> {
    try {
      return await this.boardRepository.import(data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Archive a board
   */
  public async archiveBoard(id: string): Promise<Board & { archivedAt: string }> {
    try {
      return await this.boardRepository.archive(id);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Get all archived boards
   */
  public async getArchivedBoards(): Promise<Array<Board & { archivedAt: string }>> {
    try {
      return await this.boardRepository.listArchives();
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Restore a board from archive
   */
  public async restoreBoard(id: string): Promise<Board> {
    try {
      return await this.boardRepository.restore(id);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Verify board format and structure
   */
  public async verifyBoard(id: string): Promise<{
    boardId: string;
    architecture: 'card-first' | 'column-items';
    analysis: {
      totalColumns: number;
      totalCards: number;
      totalLegacyItems: number;
      columnsWithNoItems: number;
      columnsWithItems: number;
      orphanedCards: number;
      malformedEntities: number;
    };
    recommendations: string[];
    needsAction: boolean;
  }> {
    try {
      // Get board
      const board = await this.boardRepository.findById(id);
      
      // Analyze board structure
      const analysis = {
        totalColumns: board.columns?.length || 0,
        totalCards: board.cards?.length || 0,
        totalLegacyItems: 0,
        columnsWithNoItems: 0,
        columnsWithItems: 0,
        orphanedCards: 0,
        malformedEntities: 0,
      };
      
      // All boards use card-first architecture
      const architecture = 'card-first' as const;
      
      // Check columns
      if (board.columns && Array.isArray(board.columns)) {
        board.columns.forEach(column => {
          // Check for malformed columns
          if (!column.id || typeof column.id !== 'string') {
            analysis.malformedEntities++;
          }
        });
      }
      
      // Check cards
      if (board.cards && Array.isArray(board.cards)) {
        // Count orphaned cards
        board.cards.forEach(card => {
          if (!card.columnId || !board.columns.some(col => col.id === card.columnId)) {
            analysis.orphanedCards++;
          }
          
          // Check for malformed cards
          if (!card.id || typeof card.id !== 'string') {
            analysis.malformedEntities++;
          }
        });
      }
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      if (analysis.orphanedCards > 0) {
        recommendations.push(`${analysis.orphanedCards} orphaned cards should be assigned to valid columns`);
      }
      
      if (analysis.malformedEntities > 0) {
        recommendations.push(`${analysis.malformedEntities} malformed entities should be fixed`);
      }
      
      return {
        boardId: id,
        architecture,
        analysis,
        recommendations,
        needsAction: recommendations.length > 0,
      };
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

}
```

### 4.3 Card Service

**`server/core/services/card.service.ts`:**
```typescript
import { 
  CardRepository,
  BoardRepository,
  NotFoundError as RepoNotFoundError
} from '@core/repositories';
import { 
  Card, 
  CardCreation, 
  CardUpdate 
} from '@core/schemas/card.schema';
import { 
  BatchCardOperations,
  CardOperation,
  PositionSpec
} from '@core/schemas/operations.schema';
import { 
  handleRepositoryError, 
  NotFoundError, 
  ValidationError,
  BusinessRuleError
} from './base.service';

/**
 * Service for card-related operations
 */
export class CardService {
  constructor(
    private cardRepository: CardRepository,
    private boardRepository: BoardRepository
  ) {}

  /**
   * Get all cards for a board
   */
  public async getCards(boardId: string, columnId?: string): Promise<Card[]> {
    try {
      if (columnId) {
        return await this.cardRepository.findByColumn(boardId, columnId);
      }
      return await this.cardRepository.findAll(boardId);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Get a card by ID
   */
  public async getCard(boardId: string, cardId: string): Promise<Card> {
    try {
      return await this.cardRepository.findById(boardId, cardId);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Create a new card
   */
  public async createCard(
    boardId: string, 
    data: CardCreation, 
    position?: PositionSpec
  ): Promise<Card> {
    try {
      // Check if board exists
      await this.ensureBoardExists(boardId);
      
      // Validate column exists
      await this.ensureColumnExists(boardId, data.columnId);
      
      // Create card
      return await this.cardRepository.create(boardId, {
        ...data,
        position: typeof position === 'number' ? position : undefined,
      });
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Update a card
   */
  public async updateCard(
    boardId: string, 
    cardId: string, 
    data: CardUpdate
  ): Promise<Card> {
    try {
      // Check if board exists
      await this.ensureBoardExists(boardId);
      
      // If changing column, validate it exists
      if (data.columnId) {
        await this.ensureColumnExists(boardId, data.columnId);
      }
      
      // Update card
      return await this.cardRepository.update(boardId, cardId, data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Delete a card
   */
  public async deleteCard(boardId: string, cardId: string): Promise<void> {
    try {
      // Check if board exists
      await this.ensureBoardExists(boardId);
      
      // Delete card
      await this.cardRepository.delete(boardId, cardId);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Move a card to a different position or column
   */
  public async moveCard(
    boardId: string, 
    cardId: string, 
    columnId: string, 
    position: PositionSpec
  ): Promise<Card> {
    try {
      // Check if board exists
      await this.ensureBoardExists(boardId);
      
      // Validate column exists
      await this.ensureColumnExists(boardId, columnId);
      
      // Move card
      return await this.cardRepository.move(boardId, cardId, columnId, position);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Perform multiple card operations in one transaction
   */
  public async batchOperations(
    boardId: string,
    operations: CardOperation[]
  ): Promise<{
    success: boolean;
    results: Array<{
      type: string;
      cardId?: string;
      success: boolean;
      error?: string;
    }>;
    newCards: Card[];
    referenceMap?: Record<string, string>;
  }> {
    try {
      // Check if board exists
      await this.ensureBoardExists(boardId);
      
      // Map operations to repository format
      const repoOperations = operations.map(op => {
        switch (op.type) {
          case 'create':
            return {
              type: 'create',
              data: typeof op.cardData === 'string' 
                ? JSON.parse(op.cardData) 
                : op.cardData,
              columnId: op.columnId,
              position: op.position,
            };
          case 'update':
            return {
              type: 'update',
              cardId: op.cardId,
              data: typeof op.cardData === 'string' 
                ? JSON.parse(op.cardData) 
                : op.cardData,
            };
          case 'move':
            return {
              type: 'move',
              cardId: op.cardId,
              columnId: op.columnId,
              position: op.position,
            };
          default:
            throw new ValidationError(`Unknown operation type: ${(op as any).type}`);
        }
      });
      
      // Perform batch operations
      const result = await this.cardRepository.batchOperations(boardId, repoOperations);
      
      // Extract reference map from result for operation references
      const referenceMap: Record<string, string> = {};
      
      // Process operations to build reference map
      operations.forEach((op, index) => {
        if (op.reference && op.type === 'create' && result.results[index].success) {
          const cardId = result.results[index].cardId;
          if (cardId) {
            referenceMap[op.reference] = cardId;
          }
        }
      });
      
      return {
        ...result,
        referenceMap: Object.keys(referenceMap).length > 0 ? referenceMap : undefined,
      };
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Check if a board exists
   */
  private async ensureBoardExists(boardId: string): Promise<void> {
    try {
      const exists = await this.boardRepository.exists(boardId);
      if (!exists) {
        throw new NotFoundError(`Board with ID ${boardId} not found`);
      }
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Check if a column exists on a board
   */
  private async ensureColumnExists(boardId: string, columnId: string): Promise<void> {
    try {
      const board = await this.boardRepository.findById(boardId);
      const columnExists = board.columns.some(col => col.id === columnId);
      
      if (!columnExists) {
        throw new NotFoundError(`Column with ID ${columnId} not found on board ${boardId}`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      handleRepositoryError(error);
      throw error;
    }
  }
}
```

### 4.4 Config Service

**`server/core/services/config.service.ts`:**
```typescript
import { ConfigRepository } from '@core/repositories';
import { AppConfig, ConfigUpdate } from '@core/schemas/config.schema';
import { handleRepositoryError } from './base.service';

/**
 * Service for application configuration
 */
export class ConfigService {
  constructor(private configRepository: ConfigRepository) {}

  /**
   * Get current configuration
   */
  public async getConfig(): Promise<AppConfig> {
    try {
      return await this.configRepository.getConfig();
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  public async updateConfig(data: ConfigUpdate): Promise<AppConfig> {
    try {
      return await this.configRepository.updateConfig(data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  public async resetConfig(): Promise<AppConfig> {
    try {
      await this.configRepository.delete('config');
      return await this.configRepository.getConfig();
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }
}
```

### 4.5 Webhook Service

**`server/core/services/webhook.service.ts`:**
```typescript
import { WebhookRepository } from '@core/repositories';
import { 
  Webhook, 
  WebhookCreation, 
  WebhookUpdate,
  WebhookEventType
} from '@core/schemas/webhook.schema';
import { handleRepositoryError } from './base.service';

/**
 * Service for webhook management
 */
export class WebhookService {
  constructor(private webhookRepository: WebhookRepository) {}

  /**
   * Get all webhooks
   */
  public async getWebhooks(): Promise<Webhook[]> {
    try {
      return await this.webhookRepository.findAll();
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Get a webhook by ID
   */
  public async getWebhook(id: string): Promise<Webhook> {
    try {
      return await this.webhookRepository.findById(id);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Create a new webhook
   */
  public async createWebhook(data: WebhookCreation): Promise<Webhook> {
    try {
      return await this.webhookRepository.create(data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Update a webhook
   */
  public async updateWebhook(id: string, data: WebhookUpdate): Promise<Webhook> {
    try {
      return await this.webhookRepository.update(id, data);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Delete a webhook
   */
  public async deleteWebhook(id: string): Promise<void> {
    try {
      await this.webhookRepository.delete(id);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Trigger a webhook
   */
  public async triggerWebhook(
    id: string, 
    payload: any
  ): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    try {
      return await this.webhookRepository.trigger(id, payload);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Test a webhook connection
   */
  public async testConnection(
    url: string
  ): Promise<{ success: boolean; statusCode?: number; message?: string }> {
    try {
      return await this.webhookRepository.testConnection(url);
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }

  /**
   * Dispatch an event to all relevant webhooks
   */
  public async dispatchEvent(
    eventType: WebhookEventType, 
    payload: any
  ): Promise<{
    success: boolean;
    triggeredCount: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      webhookId: string;
      webhookName: string;
      success: boolean;
      statusCode?: number;
      message?: string;
    }>;
  }> {
    try {
      // Get all active webhooks for this event type
      const webhooks = (await this.webhookRepository.findAll())
        .filter(webhook => webhook.event === eventType && webhook.active !== false);
      
      if (webhooks.length === 0) {
        return {
          success: true,
          triggeredCount: 0,
          successCount: 0,
          failureCount: 0,
          results: [],
        };
      }
      
      // Prepare the event payload
      const eventPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      };
      
      // Trigger each webhook
      const results = await Promise.all(
        webhooks.map(async webhook => {
          try {
            const result = await this.webhookRepository.trigger(webhook.id, eventPayload);
            return {
              webhookId: webhook.id,
              webhookName: webhook.name,
              success: result.success,
              statusCode: result.statusCode,
              message: result.message,
            };
          } catch (error: any) {
            return {
              webhookId: webhook.id,
              webhookName: webhook.name,
              success: false,
              message: error.message,
            };
          }
        })
      );
      
      // Count successes and failures
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      return {
        success: failureCount === 0,
        triggeredCount: results.length,
        successCount,
        failureCount,
        results,
      };
    } catch (error) {
      handleRepositoryError(error);
      throw error;
    }
  }
}
```

### 4.6 Server Control Service

**`server/core/services/server.service.ts`:**
```typescript
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { BusinessRuleError } from './base.service';

/**
 * Service for controlling the server
 */
export class ServerService {
  private serverPath: string;
  private allowedEnvVars: string[] = [
    'PORT', 
    'NODE_ENV', 
    'LOG_LEVEL',
    'USE_LOCAL_BOARDS',
    'BOARD_FILE'
  ];

  constructor(options: {
    serverPath: string;
  }) {
    this.serverPath = options.serverPath;
  }

  /**
   * Check if a port is in use
   */
  public async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(true))
        .once('listening', () => {
          tester.once('close', () => resolve(false));
          tester.close();
        })
        .listen(port);
    });
  }

  /**
   * Check if the server file exists and is executable
   */
  public async verifyServerFile(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.serverPath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Start the web server
   */
  public async startWebServer(
    options: { port?: number; timeout?: number } = {}
  ): Promise<{ success: boolean; message: string; port: number }> {
    const port = options.port || 3001;
    const timeout = options.timeout || 2000;
    
    // Check if port is already in use
    const portInUse = await this.isPortInUse(port);
    if (portInUse) {
      throw new BusinessRuleError(`Port ${port} is already in use`);
    }
    
    // Verify server file
    const serverExists = await this.verifyServerFile();
    if (!serverExists) {
      throw new BusinessRuleError(`Server file not found or not executable: ${this.serverPath}`);
    }
    
    // Create sanitized environment
    const env = this.sanitizeEnv(process.env, {
      PORT: port.toString()
    });
    
    // Start server process
    const serverProcess = spawn('node', [this.serverPath], {
      env,
      detached: true,
      stdio: 'ignore'
    });
    
    // Detach process
    serverProcess.unref();
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, timeout));
    
    // Check if process exited prematurely
    if (serverProcess.exitCode !== null) {
      throw new BusinessRuleError(`Server failed to start (exit code: ${serverProcess.exitCode})`);
    }
    
    // Verify the port is now in use
    const portInUseAfterStart = await this.isPortInUse(port);
    if (!portInUseAfterStart) {
      return {
        success: false,
        message: `Server started but port ${port} is not in use. The server may have started on a different port.`,
        port
      };
    }
    
    return {
      success: true,
      message: `Server started successfully on port ${port}`,
      port
    };
  }

  /**
   * Check web server status
   */
  public async checkWebServer(
    options: { port?: number } = {}
  ): Promise<{ running: boolean; port: number }> {
    const port = options.port || 3001;
    
    // Check if port is in use
    const portInUse = await this.isPortInUse(port);
    
    return {
      running: portInUse,
      port
    };
  }

  /**
   * Start the MCP server
   */
  public async startMcpServer(
    options: { port?: number; timeout?: number } = {}
  ): Promise<{ success: boolean; message: string; port?: number }> {
    const port = options.port;
    const timeout = options.timeout || 2000;
    
    // If port is specified, check if it's in use
    if (port !== undefined) {
      const portInUse = await this.isPortInUse(port);
      if (portInUse) {
        throw new BusinessRuleError(`Port ${port} is already in use`);
      }
    }
    
    // Verify server file
    const mcpServerPath = path.join(
      path.dirname(this.serverPath),
      'mcp',
      'kanbanMcpServer.js'
    );
    const serverExists = await fs.stat(mcpServerPath).then(
      stats => stats.isFile(),
      () => false
    );
    
    if (!serverExists) {
      throw new BusinessRuleError(`MCP server file not found: ${mcpServerPath}`);
    }
    
    // Create sanitized environment
    const env = this.sanitizeEnv(process.env, {
      ...(port !== undefined ? { MCP_PORT: port.toString() } : {})
    });
    
    // Start server process
    const serverProcess = spawn('node', [mcpServerPath], {
      env,
      detached: true,
      stdio: 'ignore'
    });
    
    // Detach process
    serverProcess.unref();
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, timeout));
    
    // Check if process exited prematurely
    if (serverProcess.exitCode !== null) {
      throw new BusinessRuleError(`MCP server failed to start (exit code: ${serverProcess.exitCode})`);
    }
    
    // For MCP we can't easily check if it started correctly since it may not use a port
    return {
      success: true,
      message: `MCP server started successfully`,
      port
    };
  }

  /**
   * Sanitize environment variables
   */
  private sanitizeEnv(
    env: NodeJS.ProcessEnv, 
    additionalVars: Record<string, string> = {}
  ): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // Only copy explicitly allowed environment variables
    for (const key of this.allowedEnvVars) {
      if (env[key] !== undefined) {
        sanitized[key] = env[key] as string;
      }
    }
    
    // Add additional variables (after validating them)
    for (const [key, value] of Object.entries(additionalVars)) {
      if (this.allowedEnvVars.includes(key) && typeof value === 'string') {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}
```

### 4.7 Service Factory and Module

**`server/core/services/index.ts`:**
```typescript
import path from 'node:path';
import { 
  BoardRepository, 
  CardRepository,
  ConfigRepository,
  WebhookRepository
} from '@core/repositories';
import { AppConfig } from '@core/schemas/config.schema';
import { BoardService } from './board.service';
import { CardService } from './card.service';
import { ConfigService } from './config.service';
import { WebhookService } from './webhook.service';
import { ServerService } from './server.service';

// Export all service classes
export * from './base.service';
export * from './board.service';
export * from './card.service';
export * from './config.service';
export * from './webhook.service';
export * from './server.service';

/**
 * Factory to create service instances with proper dependencies
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private config: AppConfig;
  private repositories: {
    board: BoardRepository;
    card: CardRepository;
    config: ConfigRepository;
    webhook: WebhookRepository;
  };
  private services: {
    board: BoardService;
    card: CardService;
    config: ConfigService;
    webhook: WebhookService;
    server: ServerService;
  };

  private constructor(config: AppConfig) {
    this.config = config;
    
    // Initialize repositories
    this.repositories = {
      board: new BoardRepository(config),
      config: new ConfigRepository({
        configDir: path.join(config.boardsDir, 'config'),
        defaultConfig: config
      }),
      webhook: new WebhookRepository(config),
      card: null as any // Will be initialized after board repository
    };
    
    // Initialize card repository with board repository
    this.repositories.card = new CardRepository(this.repositories.board);
    
    // Initialize services
    this.services = {
      board: new BoardService(this.repositories.board, this.repositories.card),
      card: new CardService(this.repositories.card, this.repositories.board),
      config: new ConfigService(this.repositories.config),
      webhook: new WebhookService(this.repositories.webhook),
      server: new ServerService({
        serverPath: path.join(path.dirname(config.boardsDir), 'server', 'server.js')
      })
    };
  }

  /**
   * Get the service factory instance
   */
  public static getInstance(config: AppConfig): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(config);
    }
    return ServiceFactory.instance;
  }

  /**
   * Get the board service
   */
  public getBoardService(): BoardService {
    return this.services.board;
  }

  /**
   * Get the card service
   */
  public getCardService(): CardService {
    return this.services.card;
  }

  /**
   * Get the config service
   */
  public getConfigService(): ConfigService {
    return this.services.config;
  }

  /**
   * Get the webhook service
   */
  public getWebhookService(): WebhookService {
    return this.services.webhook;
  }

  /**
   * Get the server service
   */
  public getServerService(): ServerService {
    return this.services.server;
  }

  /**
   * Get all services
   */
  public getServices(): {
    board: BoardService;
    card: CardService;
    config: ConfigService;
    webhook: WebhookService;
    server: ServerService;
  } {
    return this.services;
  }
}
```

## Expected Outcome
- Complete service layer encapsulating all business logic
- Separation of business rules from data access
- Consistent error handling across all services
- Type safety for all operations
- Foundation for implementing the various interfaces (MCP, REST API, CLI)
- Singleton service factory providing dependency injection