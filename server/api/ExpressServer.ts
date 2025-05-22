import express, { Application, Request, Response } from 'express';
import { Server } from 'http';
import { BoardService, ConfigService, ValidationService } from '@core/services';
import { BoardRepository, ConfigRepository, FileSystemRepository } from '@core/repositories';
import { ErrorHandler } from '@core/errors';
import { logger } from '@core/utils';

import { createApiRoutes } from './routes';
import { 
  createRateLimiter, 
  createCorsMiddleware, 
  securityHeaders, 
  requestId, 
  requestLogger, 
  sanitizeInput,
  healthCheck
} from './middleware/security';
import { validateBodySize, validateContentType } from './middleware/validation';

export class ExpressServer {
  private app: Application;
  private server: Server | null = null;
  private logger = logger.child({ component: 'ExpressServer' });
  private errorHandler = ErrorHandler.getInstance();
  
  // Services
  private boardService: BoardService;
  private configService: ConfigService;
  private validationService: ValidationService;

  constructor() {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private initializeServices(): void {
    // Initialize file system and repositories
    const fileSystem = new FileSystemRepository();
    const boardRepository = new BoardRepository(fileSystem);
    const configRepository = new ConfigRepository(fileSystem);
    
    // Initialize services
    this.validationService = new ValidationService();
    this.boardService = new BoardService(boardRepository, this.validationService);
    this.configService = new ConfigService(configRepository, this.validationService);
    
    this.logger.info('Services initialized');
  }

  private async setupMiddleware(): Promise<void> {
    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Basic security and parsing middleware
    this.app.use(requestId);
    this.app.use(requestLogger);
    this.app.use(securityHeaders);
    this.app.use(sanitizeInput);
    this.app.use(healthCheck);

    // Body parsing with size limits
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Content validation
    this.app.use(validateBodySize(10 * 1024 * 1024)); // 10MB limit
    this.app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));

    // Dynamic security middleware based on config
    this.app.use(createCorsMiddleware(this.configService));
    this.app.use(createRateLimiter(this.configService));

    this.logger.info('Middleware configured');
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', createApiRoutes(
      this.boardService,
      this.configService, 
      this.validationService
    ));

    // Root health check
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          name: 'TaskBoard AI REST API',
          version: '2.0.0',
          description: 'TypeScript-based TaskBoard AI REST API with unified architecture',
          endpoints: {
            boards: '/api/boards',
            config: '/api/config',
            health: '/health'
          }
        },
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler for unknown routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
      });
    });

    this.logger.info('Routes configured');
  }

  private setupErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(this.errorHandler.middleware());
    
    // Setup global error handlers
    this.errorHandler.setupGlobalHandlers();

    this.logger.info('Error handling configured');
  }

  async start(port?: number): Promise<void> {
    try {
      // Get port from config or use provided/default
      const config = await this.configService.getDefault();
      const serverPort = port || config.server.port;
      const serverHost = config.server.host;

      this.server = this.app.listen(serverPort, serverHost, () => {
        this.logger.info('Express server started', { 
          port: serverPort, 
          host: serverHost,
          env: process.env.NODE_ENV || 'development'
        });
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        this.logger.error('Server error', { error });
      });

      // Handle graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start Express server', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.server) {
      this.logger.warn('Server is not running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          this.logger.error('Error stopping server', { error });
          reject(error);
        } else {
          this.logger.info('Express server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.stop();
        this.errorHandler.removeGlobalHandlers();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
    server: Record<string, any>;
    uptime: number;
  }> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Test each service
      const boardsHealthy = await this.testBoardService();
      const configHealthy = await this.testConfigService();
      
      const services = {
        boardService: boardsHealthy,
        configService: configHealthy,
        validationService: true // Validation service is always healthy if no errors
      };

      const allHealthy = Object.values(services).every(Boolean);
      
      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        services,
        server: {
          running: this.server !== null,
          port: this.server ? (this.server.address() as any)?.port : null,
          memory: process.memoryUsage(),
          version: '2.0.0'
        },
        uptime: Number(process.hrtime.bigint() - startTime) / 1000000 // Convert to milliseconds
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        status: 'unhealthy',
        services: {
          boardService: false,
          configService: false,
          validationService: false
        },
        server: {
          running: false,
          error: error instanceof Error ? error.message : String(error)
        },
        uptime: Number(process.hrtime.bigint() - startTime) / 1000000
      };
    }
  }

  private async testBoardService(): Promise<boolean> {
    try {
      await this.boardService.count();
      return true;
    } catch (error) {
      this.logger.warn('Board service health check failed', { error });
      return false;
    }
  }

  private async testConfigService(): Promise<boolean> {
    try {
      await this.configService.getDefault();
      return true;
    } catch (error) {
      this.logger.warn('Config service health check failed', { error });
      return false;
    }
  }

  // Get service instances for external access
  getBoardService(): BoardService {
    return this.boardService;
  }

  getConfigService(): ConfigService {
    return this.configService;
  }

  getValidationService(): ValidationService {
    return this.validationService;
  }

  getApp(): Application {
    return this.app;
  }
}