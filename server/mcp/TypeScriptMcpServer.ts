import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { BoardService, ConfigService, ValidationService } from '@core/services';
import { BoardRepository, ConfigRepository, FileSystemRepository } from '@core/repositories';
import { ErrorHandler } from '@core/errors';
import { logger } from '@core/utils';

import { BoardTools, CardTools, ColumnTools } from './tools/typescript';

export class TypeScriptMcpServer {
  private server: Server;
  private logger = logger.child({ component: 'TypeScriptMcpServer' });
  private errorHandler = ErrorHandler.getInstance();
  
  // Services
  private boardService: BoardService;
  private configService: ConfigService;
  private validationService: ValidationService;
  
  // Tool handlers
  private boardTools: BoardTools;
  private cardTools: CardTools;
  private columnTools: ColumnTools;

  constructor() {
    this.initializeServices();
    this.initializeToolHandlers();
    this.initializeServer();
    this.setupErrorHandlers();
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

  private initializeToolHandlers(): void {
    this.boardTools = new BoardTools(this.boardService, this.validationService);
    this.cardTools = new CardTools(this.boardService, this.validationService);
    this.columnTools = new ColumnTools(this.boardService, this.validationService);
    
    this.logger.info('Tool handlers initialized');
  }

  private initializeServer(): void {
    this.server = new Server(
      {
        name: 'taskboard-ai-typescript',
        version: '2.0.0',
        description: 'TypeScript-based TaskBoard AI MCP server with unified architecture'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
    this.logger.info('MCP server initialized');
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        ...this.boardTools.getTools(),
        ...this.cardTools.getTools(),
        ...this.columnTools.getTools()
      ];

      this.logger.debug('Tools listed', { count: tools.length });
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      this.logger.info('Tool call received', { name, args });

      try {
        // Route to appropriate tool handler
        if (this.isBoardTool(name)) {
          return await this.boardTools.handleTool(name, args);
        }
        
        if (this.isCardTool(name)) {
          return await this.cardTools.handleTool(name, args);
        }
        
        if (this.isColumnTool(name)) {
          return await this.columnTools.handleTool(name, args);
        }

        throw new Error(`Unknown tool: ${name}`);
      } catch (error) {
        this.logger.error('Tool execution failed', { name, args, error });
        
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    });
  }

  private isBoardTool(name: string): boolean {
    const boardTools = [
      'create_board',
      'get_board', 
      'list_boards',
      'update_board',
      'delete_board',
      'duplicate_board',
      'get_board_stats'
    ];
    return boardTools.includes(name);
  }

  private isCardTool(name: string): boolean {
    const cardTools = [
      'create_card',
      'get_card',
      'update_card',
      'move_card',
      'delete_card',
      'search_cards',
      'filter_cards'
    ];
    return cardTools.includes(name);
  }

  private isColumnTool(name: string): boolean {
    const columnTools = [
      'create_column',
      'update_column',
      'delete_column',
      'reorder_columns',
      'get_column_cards'
    ];
    return columnTools.includes(name);
  }

  private setupErrorHandlers(): void {
    this.errorHandler.setupGlobalHandlers();
    
    // Handle server errors
    this.server.onerror = (error) => {
      this.logger.error('MCP server error', { error });
    };

    this.logger.info('Error handlers configured');
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    
    this.logger.info('Starting TypeScript MCP server...');
    
    try {
      await this.server.connect(transport);
      this.logger.info('TypeScript MCP server started successfully');
    } catch (error) {
      this.logger.error('Failed to start MCP server', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
      this.errorHandler.removeGlobalHandlers();
      this.logger.info('TypeScript MCP server stopped');
    } catch (error) {
      this.logger.error('Error stopping MCP server', { error });
      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: Record<string, boolean>;
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
}