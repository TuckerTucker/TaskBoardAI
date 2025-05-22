# 7. REST API Enhancements

## Objective
Refactor the REST API to use the unified service layer, ensuring feature parity with MCP and providing improved response formats, validation, error handling, and documentation.

## Implementation Tasks

### 7.1 Core API Configuration

**`server/api/config.ts`:**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AppConfig } from '@core/schemas';
import { logger, httpLoggerMiddleware } from '@core/utils/logger';
import { errorHandler, notFoundHandler } from '@core/errors/middleware';
import { apiRateLimiter } from './middleware/rateLimiter';

/**
 * Configure the Express API application
 */
export function configureApiApp(config: AppConfig): express.Application {
  // Create Express app
  const app = express();
  
  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors());
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  }));
  
  // Rate limiting
  if (config.rateLimits) {
    app.use(apiRateLimiter(config.rateLimits));
  }
  
  // Logging middleware
  app.use(httpLoggerMiddleware);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: process.env.npm_package_version });
  });
  
  // Routes will be registered from separate modules
  
  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
}
```

### 7.2 API Server Entry Point

**`server/api/server.ts`:**
```typescript
import http from 'http';
import { AppConfig } from '@core/schemas';
import { logger } from '@core/utils/logger';
import { ServiceFactory } from '@core/services';
import { configureApiApp } from './config';
import { registerBoardRoutes } from './routes/boardRoutes';
import { registerCardRoutes } from './routes/cardRoutes';
import { registerConfigRoutes } from './routes/configRoutes';
import { registerWebhookRoutes } from './routes/webhookRoutes';

/**
 * Create and start the API server
 */
export async function startApiServer(config: AppConfig, services: ServiceFactory) {
  try {
    // Configure Express app
    const app = configureApiApp(config);
    
    // Get API endpoint from config
    const apiEndpoint = config.server.apiEndpoint || '/api';
    
    // Register routes
    registerBoardRoutes(app, apiEndpoint, services);
    registerCardRoutes(app, apiEndpoint, services);
    registerConfigRoutes(app, apiEndpoint, services);
    registerWebhookRoutes(app, apiEndpoint, services);
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Start listening
    const port = config.server.port || 3001;
    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        logger.info(`API server listening on port ${port}`, {
          port,
          apiEndpoint,
          nodeEnv: process.env.NODE_ENV
        });
        resolve();
      });
    });
    
    // Return the server instance
    return server;
  } catch (error) {
    logger.error('Failed to start API server', error);
    throw error;
  }
}
```

### 7.3 Response Formatter Middleware

**`server/api/middleware/responseFormatter.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to format and standardize API responses
 */
export function responseFormatter(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  // Store original res.json method
  const originalJson = res.json;
  
  // Override res.json to format response
  res.json = function(data: any) {
    // Skip formatting if already in standard format
    if (data && (data.data !== undefined || data.error !== undefined)) {
      return originalJson.call(this, data);
    }
    
    // Format the response
    const formattedResponse = {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
      }
    };
    
    // Call the original json method with formatted data
    return originalJson.call(this, formattedResponse);
  };
  
  next();
}

/**
 * Wraps the controller function to handle async errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Formats paginated list responses
 */
export function formatPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data: items,
    meta: {
      pagination: {
        totalItems: total,
        totalPages,
        currentPage: page,
        perPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      timestamp: new Date().toISOString()
    }
  };
}
```

### 7.4 Rate Limiter Middleware

**`server/api/middleware/rateLimiter.ts`:**
```typescript
import rateLimit from 'express-rate-limit';
import { RateLimitConfig } from '@core/schemas';
import { RateLimitError } from '@core/errors';

/**
 * Configure API rate limiting middleware
 */
export function apiRateLimiter(config: RateLimitConfig) {
  const readLimiter = rateLimit({
    windowMs: config.read.windowMs,
    max: config.read.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: {
          windowMs: config.read.windowMs,
          maxRequests: config.read.maxRequests
        }
      }
    },
    handler: (req, res, next, options) => {
      throw new RateLimitError('Too many requests, please try again later', {
        windowMs: config.read.windowMs,
        maxRequests: config.read.maxRequests
      });
    },
    skip: (req) => {
      // Skip rate limiting for specific paths or in development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      if (req.path.includes('/health')) {
        return true;
      }
      return false;
    }
  });
  
  const writeLimiter = rateLimit({
    windowMs: config.write.windowMs,
    max: config.write.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many write requests, please try again later',
        details: {
          windowMs: config.write.windowMs,
          maxRequests: config.write.maxRequests
        }
      }
    },
    handler: (req, res, next, options) => {
      throw new RateLimitError('Too many write requests, please try again later', {
        windowMs: config.write.windowMs,
        maxRequests: config.write.maxRequests
      });
    },
    skip: (req) => {
      // Skip rate limiting for specific paths or in development
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      if (req.path.includes('/health')) {
        return true;
      }
      return false;
    }
  });
  
  // Return middleware that applies different rate limits based on HTTP method
  return (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    return readLimiter(req, res, next);
  };
}
```

### 7.5 Board Controller

**`server/api/controllers/boardController.ts`:**
```typescript
import { Request, Response } from 'express';
import { ServiceFactory } from '@core/services';
import { validate, boardSchemas } from '@core/schemas';
import { NotFoundError, ValidationError } from '@core/errors';

/**
 * Controller for board-related endpoints
 */
export class BoardController {
  constructor(private services: ServiceFactory) {}
  
  /**
   * Get all boards
   */
  async getBoards(req: Request, res: Response) {
    const boards = await this.services.getBoardService().getBoards();
    res.json(boards);
  }
  
  /**
   * Get a board by ID
   */
  async getBoard(req: Request, res: Response) {
    const boardId = req.params.id;
    const format = req.query.format as any || 'full';
    const columnId = req.query.columnId as string;
    
    // Validate format
    if (!['full', 'summary', 'compact', 'cards-only'].includes(format)) {
      throw new ValidationError('Invalid format', {
        allowedFormats: ['full', 'summary', 'compact', 'cards-only']
      });
    }
    
    const board = await this.services.getBoardService().getBoard(boardId, {
      format,
      columnId
    });
    
    res.json(board);
  }
  
  /**
   * Create a new board
   */
  async createBoard(req: Request, res: Response) {
    // Validate request body
    const { name, includeTemplate } = validate(
      boardSchemas.boardCreationSchema,
      req.body
    );
    
    const board = await this.services.getBoardService().createBoardFromTemplate(name);
    res.status(201).json(board);
  }
  
  /**
   * Import a board
   */
  async importBoard(req: Request, res: Response) {
    // Validate request body
    const boardData = validate(boardSchemas.boardSchemaV1, req.body);
    
    const board = await this.services.getBoardService().importBoard(boardData);
    res.status(201).json(board);
  }
  
  /**
   * Update a board
   */
  async updateBoard(req: Request, res: Response) {
    const boardId = req.params.id;
    
    // Validate request body
    const boardData = validate(boardSchemas.boardUpdateSchema, req.body);
    
    const board = await this.services.getBoardService().updateBoard(boardId, boardData);
    res.json(board);
  }
  
  /**
   * Delete a board
   */
  async deleteBoard(req: Request, res: Response) {
    const boardId = req.params.id;
    
    await this.services.getBoardService().deleteBoard(boardId);
    res.json({ success: true, message: `Board ${boardId} deleted successfully` });
  }
  
  /**
   * Archive a board
   */
  async archiveBoard(req: Request, res: Response) {
    const boardId = req.params.id;
    
    const archivedBoard = await this.services.getBoardService().archiveBoard(boardId);
    res.json(archivedBoard);
  }
  
  /**
   * Get all archived boards
   */
  async getArchivedBoards(req: Request, res: Response) {
    const archivedBoards = await this.services.getBoardService().getArchivedBoards();
    res.json(archivedBoards);
  }
  
  /**
   * Restore an archived board
   */
  async restoreBoard(req: Request, res: Response) {
    const boardId = req.params.id;
    
    const restoredBoard = await this.services.getBoardService().restoreBoard(boardId);
    res.json(restoredBoard);
  }
  
  /**
   * Get board configuration info
   */
  async getBoardInfo(req: Request, res: Response) {
    const config = await this.services.getConfigService().getConfig();
    
    res.json({
      boardsDir: config.boardsDir,
      templateBoardsDir: config.templateBoardsDir
    });
  }
}
```

### 7.6 Card Controller

**`server/api/controllers/cardController.ts`:**
```typescript
import { Request, Response } from 'express';
import { ServiceFactory } from '@core/services';
import { validate, cardSchemas, operationsSchema } from '@core/schemas';
import { NotFoundError, ValidationError } from '@core/errors';

/**
 * Controller for card-related endpoints
 */
export class CardController {
  constructor(private services: ServiceFactory) {}
  
  /**
   * Get all cards in a board
   */
  async getCards(req: Request, res: Response) {
    const boardId = req.params.boardId;
    const columnId = req.query.columnId as string;
    
    const cards = await this.services.getCardService().getCards(boardId, columnId);
    res.json(cards);
  }
  
  /**
   * Get a card by ID
   */
  async getCard(req: Request, res: Response) {
    const boardId = req.params.boardId;
    const cardId = req.params.cardId;
    
    const card = await this.services.getCardService().getCard(boardId, cardId);
    res.json(card);
  }
  
  /**
   * Create a new card
   */
  async createCard(req: Request, res: Response) {
    const boardId = req.params.boardId;
    
    // Validate request body
    const cardData = validate(cardSchemas.cardCreationSchema, req.body);
    const position = req.body.position || 'last';
    
    const card = await this.services.getCardService().createCard(boardId, cardData, position);
    res.status(201).json(card);
  }
  
  /**
   * Update a card
   */
  async updateCard(req: Request, res: Response) {
    const boardId = req.params.boardId;
    const cardId = req.params.cardId;
    
    // Validate request body
    const cardData = validate(cardSchemas.cardUpdateSchema, req.body);
    
    const card = await this.services.getCardService().updateCard(boardId, cardId, cardData);
    res.json(card);
  }
  
  /**
   * Delete a card
   */
  async deleteCard(req: Request, res: Response) {
    const boardId = req.params.boardId;
    const cardId = req.params.cardId;
    
    await this.services.getCardService().deleteCard(boardId, cardId);
    res.json({ success: true, message: `Card ${cardId} deleted successfully` });
  }
  
  /**
   * Move a card
   */
  async moveCard(req: Request, res: Response) {
    const boardId = req.params.boardId;
    const cardId = req.params.cardId;
    
    // Validate request body
    const { columnId, position } = req.body;
    
    if (!columnId) {
      throw new ValidationError('columnId is required');
    }
    
    if (position === undefined) {
      throw new ValidationError('position is required');
    }
    
    const card = await this.services.getCardService().moveCard(
      boardId,
      cardId,
      columnId,
      position
    );
    
    res.json(card);
  }
  
  /**
   * Batch card operations
   */
  async batchCards(req: Request, res: Response) {
    const boardId = req.params.boardId;
    
    // Validate request body
    const { operations } = validate(
      operationsSchema.batchCardOperationsSchema,
      { boardId, ...req.body }
    );
    
    const result = await this.services.getCardService().batchOperations(boardId, operations);
    res.json(result);
  }
}
```

### 7.7 Config Controller

**`server/api/controllers/configController.ts`:**
```typescript
import { Request, Response } from 'express';
import { ServiceFactory } from '@core/services';
import { validate, configSchemas } from '@core/schemas';

/**
 * Controller for configuration-related endpoints
 */
export class ConfigController {
  constructor(private services: ServiceFactory) {}
  
  /**
   * Get application configuration
   */
  async getConfig(req: Request, res: Response) {
    const config = await this.services.getConfigService().getConfig();
    
    // Remove sensitive information
    const safeConfig = {
      ...config,
      // Remove any sensitive fields here
    };
    
    res.json(safeConfig);
  }
  
  /**
   * Update application configuration
   */
  async updateConfig(req: Request, res: Response) {
    // Validate request body
    const configData = validate(configSchemas.configUpdateSchema, req.body);
    
    const updatedConfig = await this.services.getConfigService().updateConfig(configData);
    
    // Remove sensitive information
    const safeConfig = {
      ...updatedConfig,
      // Remove any sensitive fields here
    };
    
    res.json(safeConfig);
  }
  
  /**
   * Reset configuration to defaults
   */
  async resetConfig(req: Request, res: Response) {
    const defaultConfig = await this.services.getConfigService().resetConfig();
    
    // Remove sensitive information
    const safeConfig = {
      ...defaultConfig,
      // Remove any sensitive fields here
    };
    
    res.json(safeConfig);
  }
}
```

### 7.8 Webhook Controller

**`server/api/controllers/webhookController.ts`:**
```typescript
import { Request, Response } from 'express';
import { ServiceFactory } from '@core/services';
import { validate, webhookSchemas } from '@core/schemas';

/**
 * Controller for webhook-related endpoints
 */
export class WebhookController {
  constructor(private services: ServiceFactory) {}
  
  /**
   * Get all webhooks
   */
  async getWebhooks(req: Request, res: Response) {
    const webhooks = await this.services.getWebhookService().getWebhooks();
    
    // Remove sensitive information
    const safeWebhooks = webhooks.map(webhook => ({
      ...webhook,
      secret: webhook.secret ? '••••••••' : undefined
    }));
    
    res.json(safeWebhooks);
  }
  
  /**
   * Get a webhook by ID
   */
  async getWebhook(req: Request, res: Response) {
    const webhookId = req.params.id;
    
    const webhook = await this.services.getWebhookService().getWebhook(webhookId);
    
    // Remove sensitive information
    const safeWebhook = {
      ...webhook,
      secret: webhook.secret ? '••••••••' : undefined
    };
    
    res.json(safeWebhook);
  }
  
  /**
   * Create a new webhook
   */
  async createWebhook(req: Request, res: Response) {
    // Validate request body
    const webhookData = validate(webhookSchemas.webhookCreationSchema, req.body);
    
    const webhook = await this.services.getWebhookService().createWebhook(webhookData);
    
    // Remove sensitive information
    const safeWebhook = {
      ...webhook,
      secret: webhook.secret ? '••••••••' : undefined
    };
    
    res.status(201).json(safeWebhook);
  }
  
  /**
   * Update a webhook
   */
  async updateWebhook(req: Request, res: Response) {
    const webhookId = req.params.id;
    
    // Validate request body
    const webhookData = validate(webhookSchemas.webhookUpdateSchema, req.body);
    
    const webhook = await this.services.getWebhookService().updateWebhook(webhookId, webhookData);
    
    // Remove sensitive information
    const safeWebhook = {
      ...webhook,
      secret: webhook.secret ? '••••••••' : undefined
    };
    
    res.json(safeWebhook);
  }
  
  /**
   * Delete a webhook
   */
  async deleteWebhook(req: Request, res: Response) {
    const webhookId = req.params.id;
    
    await this.services.getWebhookService().deleteWebhook(webhookId);
    res.json({ success: true, message: `Webhook ${webhookId} deleted successfully` });
  }
  
  /**
   * Test a webhook
   */
  async testWebhook(req: Request, res: Response) {
    const webhookId = req.params.id;
    
    // Create test payload
    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from TaskBoardAI',
        source: 'API'
      }
    };
    
    const result = await this.services.getWebhookService().triggerWebhook(webhookId, payload);
    res.json(result);
  }
  
  /**
   * Test a webhook connection without creating a webhook
   */
  async testConnection(req: Request, res: Response) {
    // Validate request body
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'URL is required'
        }
      });
    }
    
    const result = await this.services.getWebhookService().testConnection(url);
    res.json(result);
  }
}
```


### 7.10 Route Registration

**`server/api/routes/boardRoutes.ts`:**
```typescript
import express from 'express';
import { ServiceFactory } from '@core/services';
import { BoardController } from '../controllers/boardController';
import { asyncHandler, responseFormatter } from '../middleware/responseFormatter';
import { validateParams, validateQuery, validateBody } from '@core/errors/middleware';
import { z } from 'zod';

/**
 * Register board-related routes
 */
export function registerBoardRoutes(
  app: express.Application,
  apiEndpoint: string,
  services: ServiceFactory
) {
  const router = express.Router();
  const controller = new BoardController(services);
  
  // Middleware
  router.use(responseFormatter);
  
  // Board routes
  router.get('/boards', asyncHandler(controller.getBoards.bind(controller)));
  
  router.post('/boards',
    validateBody(z.object({
      name: z.string().min(1, 'Board name is required'),
      includeTemplate: z.boolean().optional()
    })),
    asyncHandler(controller.createBoard.bind(controller))
  );
  
  router.get('/boards/:id',
    validateParams(z.object({
      id: z.string().min(1, 'Board ID is required')
    })),
    validateQuery(z.object({
      format: z.enum(['full', 'summary', 'compact', 'cards-only']).optional(),
      columnId: z.string().optional()
    }).optional()),
    asyncHandler(controller.getBoard.bind(controller))
  );
  
  router.put('/boards/:id',
    validateParams(z.object({
      id: z.string().min(1, 'Board ID is required')
    })),
    asyncHandler(controller.updateBoard.bind(controller))
  );
  
  router.delete('/boards/:id',
    validateParams(z.object({
      id: z.string().min(1, 'Board ID is required')
    })),
    asyncHandler(controller.deleteBoard.bind(controller))
  );
  
  router.post('/boards/import',
    asyncHandler(controller.importBoard.bind(controller))
  );
  
  router.post('/boards/:id/archive',
    validateParams(z.object({
      id: z.string().min(1, 'Board ID is required')
    })),
    asyncHandler(controller.archiveBoard.bind(controller))
  );
  
  router.get('/archives',
    asyncHandler(controller.getArchivedBoards.bind(controller))
  );
  
  router.post('/archives/:id/restore',
    validateParams(z.object({
      id: z.string().min(1, 'Board ID is required')
    })),
    asyncHandler(controller.restoreBoard.bind(controller))
  );
  
  router.get('/boardinfo',
    asyncHandler(controller.getBoardInfo.bind(controller))
  );
  
  // Legacy routes
  router.get('/kanban',
    asyncHandler(controller.getBoard.bind(controller))
  );
  
  router.post('/kanban',
    asyncHandler(controller.updateBoard.bind(controller))
  );
  
  // Register the router with the app
  app.use(apiEndpoint, router);
}
```

**`server/api/routes/cardRoutes.ts`:**
```typescript
import express from 'express';
import { ServiceFactory } from '@core/services';
import { CardController } from '../controllers/cardController';
import { asyncHandler, responseFormatter } from '../middleware/responseFormatter';
import { validateParams, validateQuery, validateBody } from '@core/errors/middleware';
import { z } from 'zod';

/**
 * Register card-related routes
 */
export function registerCardRoutes(
  app: express.Application,
  apiEndpoint: string,
  services: ServiceFactory
) {
  const router = express.Router();
  const controller = new CardController(services);
  
  // Middleware
  router.use(responseFormatter);
  
  // Card routes
  router.get('/boards/:boardId/cards',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required')
    })),
    validateQuery(z.object({
      columnId: z.string().optional()
    }).optional()),
    asyncHandler(controller.getCards.bind(controller))
  );
  
  router.post('/boards/:boardId/cards',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required')
    })),
    asyncHandler(controller.createCard.bind(controller))
  );
  
  router.get('/boards/:boardId/cards/:cardId',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required')
    })),
    asyncHandler(controller.getCard.bind(controller))
  );
  
  router.put('/boards/:boardId/cards/:cardId',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required')
    })),
    asyncHandler(controller.updateCard.bind(controller))
  );
  
  router.delete('/boards/:boardId/cards/:cardId',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required')
    })),
    asyncHandler(controller.deleteCard.bind(controller))
  );
  
  router.post('/boards/:boardId/cards/:cardId/move',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required'),
      cardId: z.string().min(1, 'Card ID is required')
    })),
    validateBody(z.object({
      columnId: z.string().min(1, 'Column ID is required'),
      position: z.union([
        z.number().int().min(0),
        z.enum(['first', 'last', 'up', 'down'])
      ])
    })),
    asyncHandler(controller.moveCard.bind(controller))
  );
  
  router.post('/boards/:boardId/batch-cards',
    validateParams(z.object({
      boardId: z.string().min(1, 'Board ID is required')
    })),
    asyncHandler(controller.batchCards.bind(controller))
  );
  
  // Register the router with the app
  app.use(apiEndpoint, router);
}
```

**`server/api/routes/configRoutes.ts`:**
```typescript
import express from 'express';
import { ServiceFactory } from '@core/services';
import { ConfigController } from '../controllers/configController';
import { asyncHandler, responseFormatter } from '../middleware/responseFormatter';

/**
 * Register configuration-related routes
 */
export function registerConfigRoutes(
  app: express.Application,
  apiEndpoint: string,
  services: ServiceFactory
) {
  const router = express.Router();
  const controller = new ConfigController(services);
  
  // Middleware
  router.use(responseFormatter);
  
  // Config routes
  router.get('/config',
    asyncHandler(controller.getConfig.bind(controller))
  );
  
  router.put('/config',
    asyncHandler(controller.updateConfig.bind(controller))
  );
  
  router.post('/config/reset',
    asyncHandler(controller.resetConfig.bind(controller))
  );
  
  // Register the router with the app
  app.use(apiEndpoint, router);
}
```

**`server/api/routes/webhookRoutes.ts`:**
```typescript
import express from 'express';
import { ServiceFactory } from '@core/services';
import { WebhookController } from '../controllers/webhookController';
import { asyncHandler, responseFormatter } from '../middleware/responseFormatter';
import { validateParams, validateBody } from '@core/errors/middleware';
import { z } from 'zod';

/**
 * Register webhook-related routes
 */
export function registerWebhookRoutes(
  app: express.Application,
  apiEndpoint: string,
  services: ServiceFactory
) {
  const router = express.Router();
  const controller = new WebhookController(services);
  
  // Middleware
  router.use(responseFormatter);
  
  // Webhook routes
  router.get('/webhooks',
    asyncHandler(controller.getWebhooks.bind(controller))
  );
  
  router.post('/webhooks',
    validateBody(z.object({
      name: z.string().min(1, 'Webhook name is required'),
      url: z.string().url('Invalid URL format'),
      event: z.string().min(1, 'Event type is required'),
      secret: z.string().optional()
    })),
    asyncHandler(controller.createWebhook.bind(controller))
  );
  
  router.get('/webhooks/:id',
    validateParams(z.object({
      id: z.string().min(1, 'Webhook ID is required')
    })),
    asyncHandler(controller.getWebhook.bind(controller))
  );
  
  router.put('/webhooks/:id',
    validateParams(z.object({
      id: z.string().min(1, 'Webhook ID is required')
    })),
    asyncHandler(controller.updateWebhook.bind(controller))
  );
  
  router.delete('/webhooks/:id',
    validateParams(z.object({
      id: z.string().min(1, 'Webhook ID is required')
    })),
    asyncHandler(controller.deleteWebhook.bind(controller))
  );
  
  router.post('/webhooks/:id/test',
    validateParams(z.object({
      id: z.string().min(1, 'Webhook ID is required')
    })),
    asyncHandler(controller.testWebhook.bind(controller))
  );
  
  router.post('/webhooks/test-connection',
    validateBody(z.object({
      url: z.string().url('Invalid URL format')
    })),
    asyncHandler(controller.testConnection.bind(controller))
  );
  
  // Register the router with the app
  app.use(apiEndpoint, router);
}
```


### 7.11 OpenAPI Documentation

**`server/api/openapi.ts`:**
```typescript
import { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * Generate and serve OpenAPI documentation
 */
export function setupApiDocs(app: Express, apiEndpoint: string) {
  // OpenAPI specification options
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'TaskBoardAI API',
        version: '1.0.0',
        description: 'REST API for TaskBoardAI kanban board system',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
        contact: {
          name: 'API Support',
          url: 'https://github.com/your-repo/taskboardai',
        },
      },
      servers: [
        {
          url: `http://localhost:3001${apiEndpoint}`,
          description: 'Local development server',
        },
      ],
      components: {
        schemas: {
          Board: {
            type: 'object',
            required: ['id', 'projectName', 'columns'],
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique identifier for the board',
              },
              projectName: {
                type: 'string',
                description: 'Display name of the board',
              },
              columns: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Column',
                },
              },
              cards: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/Card',
                },
              },
              last_updated: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp of the last update',
              },
            },
          },
          Column: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique identifier for the column',
              },
              name: {
                type: 'string',
                description: 'Display name of the column',
              },
              position: {
                type: 'integer',
                minimum: 0,
                description: 'Position of the column in the board',
              },
            },
          },
          Card: {
            type: 'object',
            required: ['id', 'title', 'columnId', 'position'],
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique identifier for the card',
              },
              title: {
                type: 'string',
                description: 'Title of the card',
              },
              content: {
                type: 'string',
                description: 'Markdown content for card description',
              },
              columnId: {
                type: 'string',
                format: 'uuid',
                description: 'ID of the column this card belongs to',
              },
              position: {
                type: 'integer',
                minimum: 0,
                description: 'Position within the column (0-indexed)',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'List of tags',
              },
              subtasks: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'List of subtasks',
              },
              dependencies: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'uuid',
                },
                description: 'List of dependent card IDs',
              },
              created_at: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp when card was created',
              },
              updated_at: {
                type: 'string',
                format: 'date-time',
                description: 'Timestamp of last card update',
              },
            },
          },
          // Additional schema definitions for Error, Webhook, etc.
        },
        responses: {
          NotFound: {
            description: 'The specified resource was not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: {
                          type: 'string',
                          example: 'NOT_FOUND',
                        },
                        message: {
                          type: 'string',
                          example: 'Resource not found',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          ValidationError: {
            description: 'Invalid input parameter or format',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: {
                          type: 'string',
                          example: 'VALIDATION_ERROR',
                        },
                        message: {
                          type: 'string',
                          example: 'Invalid input parameter',
                        },
                        details: {
                          type: 'object',
                          description: 'Validation error details',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    apis: ['./server/api/routes/*.ts', './server/api/controllers/*.ts'],
  };
  
  // Initialize swagger-jsdoc
  const specs = swaggerJsdoc(options);
  
  // Serve swagger docs
  app.use(`${apiEndpoint}/docs`, swaggerUi.serve, swaggerUi.setup(specs));
  
  // Serve OpenAPI spec as JSON
  app.get(`${apiEndpoint}/docs.json`, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}
```

## Expected Outcome
- Complete REST API using the unified service layer
- Consistent error handling and response formatting
- Input validation using Zod schemas
- Improved documentation with OpenAPI/Swagger
- Feature parity with MCP interface
- Clean separation of concerns with controller/router pattern