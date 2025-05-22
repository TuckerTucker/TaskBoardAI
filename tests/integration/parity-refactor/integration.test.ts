import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ServiceFactory } from '../../../server/cli/ServiceFactory';
import { Board, Card, Column } from '../../../server/core/schemas/types';
import { CreateBoardSchema, CreateCardSchema } from '../../../server/core/schemas';
import { ObservableLogger } from '../../../server/core/utils/observability';
import fs from 'fs/promises';
import path from 'path';

describe('Parity Refactor Integration Tests', () => {
  let serviceFactory: ServiceFactory;
  let testBoardsDir: string;
  let originalBoardsDir: string;

  beforeAll(async () => {
    // Setup test environment
    testBoardsDir = path.join(process.cwd(), 'test-boards');
    originalBoardsDir = process.env.BOARDS_DIR || path.join(process.cwd(), 'boards');
    
    // Set test boards directory
    process.env.BOARDS_DIR = testBoardsDir;
    
    // Ensure test directory exists and is clean
    await fs.rm(testBoardsDir, { recursive: true, force: true });
    await fs.mkdir(testBoardsDir, { recursive: true });
    
    // Initialize service factory
    serviceFactory = ServiceFactory.getInstance();
  });

  afterAll(async () => {
    // Restore original environment
    process.env.BOARDS_DIR = originalBoardsDir;
    
    // Clean up test directory
    await fs.rm(testBoardsDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clear test boards before each test
    const files = await fs.readdir(testBoardsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(testBoardsDir, file));
      }
    }
  });

  describe('Service Layer Integration', () => {
    it('should create and retrieve a board through BoardService', async () => {
      const boardService = serviceFactory.getBoardService();
      
      const boardData = CreateBoardSchema.parse({
        title: 'Test Integration Board',
        description: 'Board for testing service integration',
        columns: [
          { title: 'To Do', description: 'Tasks to be done' },
          { title: 'In Progress', description: 'Tasks being worked on' },
          { title: 'Done', description: 'Completed tasks' }
        ]
      });

      // Create board
      const createdBoard = await boardService.create(boardData);
      
      expect(createdBoard).toBeDefined();
      expect(createdBoard.id).toBeDefined();
      expect(createdBoard.title).toBe('Test Integration Board');
      expect(createdBoard.columns).toHaveLength(3);

      // Retrieve board
      const retrievedBoard = await boardService.findById(createdBoard.id);
      
      expect(retrievedBoard).toBeDefined();
      expect(retrievedBoard?.id).toBe(createdBoard.id);
      expect(retrievedBoard?.title).toBe('Test Integration Board');
    });

    it('should handle full CRUD operations for cards', async () => {
      const boardService = serviceFactory.getBoardService();
      
      // Create a board first
      const board = await boardService.create(CreateBoardSchema.parse({
        title: 'Card Test Board',
        columns: [{ title: 'To Do' }]
      }));

      const cardData = CreateCardSchema.parse({
        title: 'Test Card',
        description: 'A test card for integration testing',
        columnId: board.columns[0].id,
        priority: 'medium',
        tags: ['test', 'integration']
      });

      // Create card
      const createdCard = await boardService.createCard(board.id, cardData);
      
      expect(createdCard).toBeDefined();
      expect(createdCard.title).toBe('Test Card');
      expect(createdCard.columnId).toBe(board.columns[0].id);

      // Update card
      const updatedCard = await boardService.updateCard(board.id, createdCard.id, {
        title: 'Updated Test Card',
        priority: 'high'
      });
      
      expect(updatedCard.title).toBe('Updated Test Card');
      expect(updatedCard.priority).toBe('high');

      // Move card (if we had multiple columns)
      // Delete card
      await boardService.deleteCard(board.id, createdCard.id);
      
      // Verify deletion
      const boardAfterDeletion = await boardService.findById(board.id);
      expect(boardAfterDeletion?.columns[0].cards).toHaveLength(0);
    });

    it('should validate data through ValidationService', async () => {
      const validationService = serviceFactory.getValidationService();
      
      // Valid board data
      const validBoard = {
        title: 'Valid Board',
        columns: [{ title: 'Test Column' }]
      };
      
      expect(() => validationService.validateBoard(validBoard)).not.toThrow();

      // Invalid board data
      const invalidBoard = {
        title: '', // Empty title should be invalid
        columns: []
      };
      
      expect(() => validationService.validateBoard(invalidBoard)).toThrow();
    });

    it('should work with templates', async () => {
      const templateService = serviceFactory.getTemplateService();
      const boardService = serviceFactory.getBoardService();
      
      // Get available templates
      const templates = await templateService.getAllTemplates();
      expect(templates.boards).toBeDefined();
      expect(templates.boards.length).toBeGreaterThan(0);

      // Use a template to create a board
      const projectTemplate = templates.boards.find(t => t.name === 'Project Management');
      expect(projectTemplate).toBeDefined();

      if (projectTemplate) {
        const boardFromTemplate = await templateService.createBoardFromTemplate(
          projectTemplate.id,
          'My Project Board'
        );
        
        expect(boardFromTemplate).toBeDefined();
        expect(boardFromTemplate.title).toBe('My Project Board');
        expect(boardFromTemplate.columns.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle repository errors gracefully', async () => {
      const boardService = serviceFactory.getBoardService();
      
      // Try to get a non-existent board
      const nonExistentBoard = await boardService.findById('non-existent-id');
      expect(nonExistentBoard).toBeNull();
      
      // Try to update a non-existent board
      await expect(
        boardService.update('non-existent-id', { title: 'Updated' })
      ).rejects.toThrow();
    });

    it('should validate input data and throw appropriate errors', async () => {
      const boardService = serviceFactory.getBoardService();
      
      // Invalid board creation
      await expect(
        boardService.create({ title: '', columns: [] } as any)
      ).rejects.toThrow();
      
      // Invalid card creation
      const board = await boardService.create(CreateBoardSchema.parse({
        title: 'Test Board',
        columns: [{ title: 'Column 1' }]
      }));
      
      await expect(
        boardService.createCard(board.id, { title: '', columnId: 'invalid' } as any)
      ).rejects.toThrow();
    });
  });

  describe('Observability Integration', () => {
    it('should track operations through observability services', async () => {
      const logger = serviceFactory.getObservableLogger();
      const metricsCollector = serviceFactory.getMetricsCollector();
      const performanceTracker = serviceFactory.getPerformanceTracker();
      
      // Set context for tracking
      logger.setContext({
        requestId: 'test-request-123',
        source: 'api',
        userId: 'test-user'
      });

      // Perform some operations
      const boardService = serviceFactory.getBoardService();
      
      const operationId = performanceTracker.startOperation('board_creation', 'Create test board');
      
      const board = await boardService.create(CreateBoardSchema.parse({
        title: 'Observed Board',
        columns: [{ title: 'Test Column' }]
      }));
      
      performanceTracker.endOperation(operationId);
      
      // Check that metrics were collected
      const metrics = metricsCollector.getAllMetrics();
      expect(metrics).toBeDefined();
      
      // Check performance stats
      const perfStats = performanceTracker.getPerformanceStats();
      expect(perfStats.board_creation).toBeDefined();
    });

    it('should track errors through error tracking system', async () => {
      const errorTracker = serviceFactory.getErrorTracker();
      const boardService = serviceFactory.getBoardService();
      
      // Generate an error
      try {
        await boardService.findById(''); // Invalid ID should cause an error
      } catch (error) {
        // Error should be automatically tracked by the service layer
      }
      
      // Check recent errors
      const recentErrors = errorTracker.getRecentErrors(10);
      // Note: The actual error tracking depends on how errors are handled in the service layer
    });
  });

  describe('Authentication Integration', () => {
    it('should handle user authentication flow', async () => {
      const authService = serviceFactory.getAuthService();
      
      // Register a new user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'securepassword123',
        role: 'user' as const
      };
      
      const user = await authService.register(userData);
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.role).toBe('user');
      
      // Login with the user
      const loginResult = await authService.login('testuser', 'securepassword123');
      expect(loginResult).toBeDefined();
      expect(loginResult.token).toBeDefined();
      expect(loginResult.user.username).toBe('testuser');
      
      // Validate the token
      const tokenValidation = await authService.validateToken(loginResult.token);
      expect(tokenValidation).toBeDefined();
      expect(tokenValidation.user.username).toBe('testuser');
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete a full board management workflow', async () => {
      const boardService = serviceFactory.getBoardService();
      
      // 1. Create a board
      const board = await boardService.create(CreateBoardSchema.parse({
        title: 'E2E Test Board',
        description: 'End-to-end testing board',
        columns: [
          { title: 'Backlog', description: 'Tasks to be planned' },
          { title: 'To Do', description: 'Ready to start' },
          { title: 'In Progress', description: 'Currently working' },
          { title: 'Done', description: 'Completed tasks' }
        ]
      }));
      
      // 2. Add cards to different columns
      const card1 = await boardService.createCard(board.id, CreateCardSchema.parse({
        title: 'Plan project',
        description: 'Initial project planning',
        columnId: board.columns[0].id,
        priority: 'high',
        tags: ['planning']
      }));
      
      const card2 = await boardService.createCard(board.id, CreateCardSchema.parse({
        title: 'Setup development environment',
        columnId: board.columns[1].id,
        priority: 'medium',
        tags: ['setup', 'dev']
      }));
      
      // 3. Move a card from one column to another
      const movedCard = await boardService.updateCard(board.id, card1.id, {
        columnId: board.columns[1].id // Move from Backlog to To Do
      });
      
      expect(movedCard.columnId).toBe(board.columns[1].id);
      
      // 4. Update card details
      const updatedCard = await boardService.updateCard(board.id, card2.id, {
        title: 'Setup development environment - Updated',
        priority: 'high',
        tags: ['setup', 'dev', 'urgent']
      });
      
      expect(updatedCard.title).toContain('Updated');
      expect(updatedCard.priority).toBe('high');
      
      // 5. Get board and verify state
      const finalBoard = await boardService.findById(board.id);
      expect(finalBoard).toBeDefined();
      expect(finalBoard!.columns[1].cards).toHaveLength(2); // Both cards in "To Do"
      
      // 6. List all boards to ensure it appears
      const allBoards = await boardService.findAll();
      expect(allBoards.some(b => b.id === board.id)).toBe(true);
      
      // 7. Archive the board
      const archivedBoard = await boardService.update(board.id, { isArchived: true });
      expect(archivedBoard.isArchived).toBe(true);
    });

    it('should handle batch operations efficiently', async () => {
      const boardService = serviceFactory.getBoardService();
      
      // Create a board
      const board = await boardService.create(CreateBoardSchema.parse({
        title: 'Batch Operations Test',
        columns: [{ title: 'Column 1' }]
      }));
      
      // Create multiple cards
      const cardPromises = Array.from({ length: 5 }, (_, i) =>
        boardService.createCard(board.id, CreateCardSchema.parse({
          title: `Batch Card ${i + 1}`,
          columnId: board.columns[0].id,
          priority: i % 2 === 0 ? 'high' : 'low'
        }))
      );
      
      const cards = await Promise.all(cardPromises);
      expect(cards).toHaveLength(5);
      
      // Verify all cards were created
      const updatedBoard = await boardService.findById(board.id);
      expect(updatedBoard!.columns[0].cards).toHaveLength(5);
    });
  });

  describe('Configuration Integration', () => {
    it('should manage configuration through ConfigService', async () => {
      const configService = serviceFactory.getConfigService();
      
      // Get default config
      const defaultConfig = await configService.getConfig();
      expect(defaultConfig).toBeDefined();
      
      // Update config
      const updatedConfig = await configService.updateConfig({
        server: {
          port: 3001,
          host: 'localhost'
        }
      });
      
      expect(updatedConfig.server.port).toBe(3001);
      
      // Verify persistence
      const retrievedConfig = await configService.getConfig();
      expect(retrievedConfig.server.port).toBe(3001);
    });
  });
});

describe('Interface Consistency Tests', () => {
  let serviceFactory: ServiceFactory;
  
  beforeAll(() => {
    serviceFactory = ServiceFactory.getInstance();
  });

  it('should provide consistent data shapes across all services', async () => {
    const boardService = serviceFactory.getBoardService();
    const templateService = serviceFactory.getTemplateService();
    
    // Create board through BoardService
    const directBoard = await boardService.create(CreateBoardSchema.parse({
      title: 'Direct Board',
      columns: [{ title: 'Column 1' }]
    }));
    
    // Create board through TemplateService
    const templates = await templateService.getAllTemplates();
    const template = templates.boards[0];
    const templateBoard = await templateService.createBoardFromTemplate(
      template.id,
      'Template Board'
    );
    
    // Both boards should have the same structure
    expect(typeof directBoard.id).toBe('string');
    expect(typeof templateBoard.id).toBe('string');
    expect(Array.isArray(directBoard.columns)).toBe(true);
    expect(Array.isArray(templateBoard.columns)).toBe(true);
    expect(directBoard.createdAt).toBeDefined();
    expect(templateBoard.createdAt).toBeDefined();
  });

  it('should handle validation consistently across services', async () => {
    const boardService = serviceFactory.getBoardService();
    const validationService = serviceFactory.getValidationService();
    
    const invalidBoardData = { title: '', columns: [] };
    
    // ValidationService should reject invalid data
    expect(() => validationService.validateBoard(invalidBoardData)).toThrow();
    
    // BoardService should also reject the same invalid data
    await expect(boardService.create(invalidBoardData as any)).rejects.toThrow();
  });
});