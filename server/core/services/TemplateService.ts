import { 
  CardTemplate, 
  ColumnTemplate, 
  BoardTemplate,
  CreateCardTemplate,
  UpdateCardTemplate,
  CreateColumnTemplate,
  UpdateColumnTemplate,
  CreateBoardTemplate,
  UpdateBoardTemplate,
  CardTemplateSchema,
  ColumnTemplateSchema,
  BoardTemplateSchema,
  CreateCardTemplateSchema,
  UpdateCardTemplateSchema,
  CreateColumnTemplateSchema,
  UpdateColumnTemplateSchema,
  CreateBoardTemplateSchema,
  UpdateBoardTemplateSchema
} from '@core/schemas/templateSchemas';
import { ITemplateRepository } from '@core/repositories/TemplateRepository';
import { IBoardRepository } from '@core/repositories';
import { Board, Card, Column, CreateBoard, CreateCard, CreateColumn } from '@core/schemas';
import { ValidationError, NotFoundError } from '@core/errors';
import { Logger } from '@core/utils/logger';
import { EntityFactory } from '@core/schemas';
import { defaultBoardTemplates, defaultColumnTemplates, defaultCardTemplates } from '../templates/defaults.js';
import { z } from 'zod';

export interface ITemplateService {
  // Card Template Methods
  getAllCardTemplates(): Promise<CardTemplate[]>;
  getCardTemplateByName(name: string): Promise<CardTemplate>;
  createCardTemplate(templateData: CreateCardTemplate): Promise<CardTemplate>;
  updateCardTemplate(name: string, templateData: UpdateCardTemplate): Promise<CardTemplate>;
  deleteCardTemplate(name: string): Promise<void>;
  createCardFromTemplate(boardId: string, columnId: string, templateName: string): Promise<Card>;
  extractTemplateFromCard(boardId: string, cardId: string, templateName: string, description?: string): Promise<CardTemplate>;

  // Column Template Methods
  getAllColumnTemplates(): Promise<ColumnTemplate[]>;
  getColumnTemplateByName(name: string): Promise<ColumnTemplate>;
  createColumnTemplate(templateData: CreateColumnTemplate): Promise<ColumnTemplate>;
  updateColumnTemplate(name: string, templateData: UpdateColumnTemplate): Promise<ColumnTemplate>;
  deleteColumnTemplate(name: string): Promise<void>;
  createColumnFromTemplate(boardId: string, templateName: string): Promise<Column>;
  extractTemplateFromColumn(boardId: string, columnId: string, templateName: string, description?: string): Promise<ColumnTemplate>;

  // Board Template Methods
  getAllBoardTemplates(): Promise<BoardTemplate[]>;
  getBoardTemplateByName(name: string): Promise<BoardTemplate>;
  createBoardTemplate(templateData: CreateBoardTemplate): Promise<BoardTemplate>;
  updateBoardTemplate(name: string, templateData: UpdateBoardTemplate): Promise<BoardTemplate>;
  deleteBoardTemplate(name: string): Promise<void>;
  createBoardFromTemplate(templateName: string): Promise<Board>;
  extractTemplateFromBoard(boardId: string, templateName: string, description?: string): Promise<BoardTemplate>;

  // Utility Methods
  loadDefaultTemplates(defaultsPath: string): Promise<void>;
}

export class TemplateService implements ITemplateService {
  private templateRepository: ITemplateRepository;
  private boardRepository: IBoardRepository;
  private logger: Logger;

  constructor(
    templateRepository: ITemplateRepository,
    boardRepository: IBoardRepository
  ) {
    this.templateRepository = templateRepository;
    this.boardRepository = boardRepository;
    this.logger = new Logger('TemplateService');
  }

  // Card Template Methods
  async getAllCardTemplates(): Promise<CardTemplate[]> {
    try {
      return await this.templateRepository.getAllCardTemplates();
    } catch (error) {
      this.logger.error('Failed to get all card templates', { error });
      throw error;
    }
  }

  async getCardTemplateByName(name: string): Promise<CardTemplate> {
    try {
      const template = await this.templateRepository.getCardTemplateByName(name);
      if (!template) {
        throw new NotFoundError(`Card template with name '${name}' not found`);
      }
      return template;
    } catch (error) {
      this.logger.error('Failed to get card template by name', { name, error });
      throw error;
    }
  }

  async createCardTemplate(templateData: CreateCardTemplate): Promise<CardTemplate> {
    try {
      // Validate the template data
      const validTemplate = CreateCardTemplateSchema.parse(templateData);
      
      // Save the template
      const savedTemplate = await this.templateRepository.saveCardTemplate(validTemplate);
      this.logger.info('Card template created', { name: savedTemplate.name });
      
      return savedTemplate;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid card template data', { templateData, errors: error.errors });
        throw new ValidationError('Invalid card template data', error);
      }
      this.logger.error('Failed to create card template', { templateData, error });
      throw error;
    }
  }

  async updateCardTemplate(name: string, templateData: UpdateCardTemplate): Promise<CardTemplate> {
    try {
      // Get the existing template to ensure it exists
      await this.getCardTemplateByName(name);
      
      // Merge with name to ensure it's preserved
      const updateData = { ...templateData, name };
      
      // Validate the updated template
      const validTemplate = UpdateCardTemplateSchema.parse(updateData);
      
      // Save the updated template
      const savedTemplate = await this.templateRepository.saveCardTemplate(validTemplate);
      this.logger.info('Card template updated', { name });
      
      return savedTemplate;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid card template update data', { name, templateData, errors: error.errors });
        throw new ValidationError('Invalid card template data', error);
      }
      this.logger.error('Failed to update card template', { name, templateData, error });
      throw error;
    }
  }

  async deleteCardTemplate(name: string): Promise<void> {
    try {
      await this.templateRepository.deleteCardTemplate(name);
      this.logger.info('Card template deleted', { name });
    } catch (error) {
      this.logger.error('Failed to delete card template', { name, error });
      throw error;
    }
  }

  async createCardFromTemplate(boardId: string, columnId: string, templateName: string): Promise<Card> {
    try {
      // Get the template
      const template = await this.getCardTemplateByName(templateName);
      
      // Get the board to ensure it exists
      const board = await this.boardRepository.findById(boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${boardId} not found`);
      }
      
      // Find the column to ensure it exists
      const column = board.columns.find(col => col.id === columnId);
      if (!column) {
        throw new NotFoundError(`Column with ID ${columnId} not found in board ${boardId}`);
      }
      
      // Create card data from template
      const cardData: CreateCard = {
        title: template.title,
        description: template.description,
        columnId,
        priority: template.priority,
        status: template.status,
        assignee: template.assignee,
        tags: template.tags,
        dueDate: template.dueDate
      };
      
      // Create the card using the board service
      const card = EntityFactory.createCard(cardData);
      
      // Add the card to the board
      await this.boardRepository.addCard(boardId, card);
      
      this.logger.info('Card created from template', { 
        boardId, 
        columnId, 
        templateName, 
        cardId: card.id 
      });
      
      return card;
    } catch (error) {
      this.logger.error('Failed to create card from template', { 
        boardId, 
        columnId, 
        templateName, 
        error 
      });
      throw error;
    }
  }

  async extractTemplateFromCard(
    boardId: string, 
    cardId: string, 
    templateName: string, 
    description?: string
  ): Promise<CardTemplate> {
    try {
      // Get the board
      const board = await this.boardRepository.findById(boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${boardId} not found`);
      }
      
      // Find the card
      const card = board.cards.find(c => c.id === cardId);
      if (!card) {
        throw new NotFoundError(`Card with ID ${cardId} not found in board ${boardId}`);
      }
      
      // Create a card template from the card
      const template: CreateCardTemplate = {
        name: templateName,
        description: description || `Template based on card: ${card.title}`,
        category: 'custom',
        isDefault: false,
        title: card.title,
        description: card.description,
        priority: card.priority,
        status: card.status,
        assignee: card.assignee,
        tags: card.tags,
        dueDate: card.dueDate
      };
      
      // Save the template
      const savedTemplate = await this.createCardTemplate(template);
      this.logger.info('Card template extracted', { boardId, cardId, templateName });
      
      return savedTemplate;
    } catch (error) {
      this.logger.error('Failed to extract card template', { 
        boardId, 
        cardId, 
        templateName, 
        error 
      });
      throw error;
    }
  }

  // Column Template Methods
  async getAllColumnTemplates(): Promise<ColumnTemplate[]> {
    try {
      return await this.templateRepository.getAllColumnTemplates();
    } catch (error) {
      this.logger.error('Failed to get all column templates', { error });
      throw error;
    }
  }

  async getColumnTemplateByName(name: string): Promise<ColumnTemplate> {
    try {
      const template = await this.templateRepository.getColumnTemplateByName(name);
      if (!template) {
        throw new NotFoundError(`Column template with name '${name}' not found`);
      }
      return template;
    } catch (error) {
      this.logger.error('Failed to get column template by name', { name, error });
      throw error;
    }
  }

  async createColumnTemplate(templateData: CreateColumnTemplate): Promise<ColumnTemplate> {
    try {
      // Validate the template data
      const validTemplate = CreateColumnTemplateSchema.parse(templateData);
      
      // Save the template
      const savedTemplate = await this.templateRepository.saveColumnTemplate(validTemplate);
      this.logger.info('Column template created', { name: savedTemplate.name });
      
      return savedTemplate;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid column template data', { templateData, errors: error.errors });
        throw new ValidationError('Invalid column template data', error);
      }
      this.logger.error('Failed to create column template', { templateData, error });
      throw error;
    }
  }

  async updateColumnTemplate(name: string, templateData: UpdateColumnTemplate): Promise<ColumnTemplate> {
    try {
      // Get the existing template to ensure it exists
      await this.getColumnTemplateByName(name);
      
      // Merge with name to ensure it's preserved
      const updateData = { ...templateData, name };
      
      // Validate the updated template
      const validTemplate = UpdateColumnTemplateSchema.parse(updateData);
      
      // Save the updated template
      const savedTemplate = await this.templateRepository.saveColumnTemplate(validTemplate);
      this.logger.info('Column template updated', { name });
      
      return savedTemplate;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid column template update data', { name, templateData, errors: error.errors });
        throw new ValidationError('Invalid column template data', error);
      }
      this.logger.error('Failed to update column template', { name, templateData, error });
      throw error;
    }
  }

  async deleteColumnTemplate(name: string): Promise<void> {
    try {
      await this.templateRepository.deleteColumnTemplate(name);
      this.logger.info('Column template deleted', { name });
    } catch (error) {
      this.logger.error('Failed to delete column template', { name, error });
      throw error;
    }
  }

  async createColumnFromTemplate(boardId: string, templateName: string): Promise<Column> {
    try {
      // Get the template
      const template = await this.getColumnTemplateByName(templateName);
      
      // Get the board to ensure it exists
      const board = await this.boardRepository.findById(boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${boardId} not found`);
      }
      
      // Create column data from template
      const columnData: CreateColumn = {
        title: template.title,
        wipLimit: template.wipLimit
      };
      
      // Create the column
      const column = EntityFactory.createColumn(columnData, board.columns.length);
      
      // Add the column to the board
      await this.boardRepository.addColumn(boardId, column);
      
      this.logger.info('Column created from template', { 
        boardId, 
        templateName, 
        columnId: column.id 
      });
      
      return column;
    } catch (error) {
      this.logger.error('Failed to create column from template', { 
        boardId, 
        templateName, 
        error 
      });
      throw error;
    }
  }

  async extractTemplateFromColumn(
    boardId: string, 
    columnId: string, 
    templateName: string, 
    description?: string
  ): Promise<ColumnTemplate> {
    try {
      // Get the board
      const board = await this.boardRepository.findById(boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${boardId} not found`);
      }
      
      // Find the column
      const column = board.columns.find(col => col.id === columnId);
      if (!column) {
        throw new NotFoundError(`Column with ID ${columnId} not found in board ${boardId}`);
      }
      
      // Get cards in this column
      const cardsInColumn = board.cards.filter(card => card.columnId === columnId);
      
      // Create a column template from the column
      const template: CreateColumnTemplate = {
        name: templateName,
        description: description || `Template based on column: ${column.title}`,
        category: 'custom',
        isDefault: false,
        title: column.title,
        wipLimit: column.wipLimit,
        cards: cardsInColumn.map(card => ({
          title: card.title,
          description: card.description,
          priority: card.priority,
          status: card.status,
          assignee: card.assignee,
          tags: card.tags,
          dueDate: card.dueDate
        }))
      };
      
      // Save the template
      const savedTemplate = await this.createColumnTemplate(template);
      this.logger.info('Column template extracted', { boardId, columnId, templateName });
      
      return savedTemplate;
    } catch (error) {
      this.logger.error('Failed to extract column template', { 
        boardId, 
        columnId, 
        templateName, 
        error 
      });
      throw error;
    }
  }

  // Board Template Methods
  async getAllBoardTemplates(): Promise<BoardTemplate[]> {
    try {
      return await this.templateRepository.getAllBoardTemplates();
    } catch (error) {
      this.logger.error('Failed to get all board templates', { error });
      throw error;
    }
  }

  async getBoardTemplateByName(name: string): Promise<BoardTemplate> {
    try {
      const template = await this.templateRepository.getBoardTemplateByName(name);
      if (!template) {
        throw new NotFoundError(`Board template with name '${name}' not found`);
      }
      return template;
    } catch (error) {
      this.logger.error('Failed to get board template by name', { name, error });
      throw error;
    }
  }

  async createBoardTemplate(templateData: CreateBoardTemplate): Promise<BoardTemplate> {
    try {
      // Validate the template data
      const validTemplate = CreateBoardTemplateSchema.parse(templateData);
      
      // Save the template
      const savedTemplate = await this.templateRepository.saveBoardTemplate(validTemplate);
      this.logger.info('Board template created', { name: savedTemplate.name });
      
      return savedTemplate;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid board template data', { templateData, errors: error.errors });
        throw new ValidationError('Invalid board template data', error);
      }
      this.logger.error('Failed to create board template', { templateData, error });
      throw error;
    }
  }

  async updateBoardTemplate(name: string, templateData: UpdateBoardTemplate): Promise<BoardTemplate> {
    try {
      // Get the existing template to ensure it exists
      await this.getBoardTemplateByName(name);
      
      // Merge with name to ensure it's preserved
      const updateData = { ...templateData, name };
      
      // Validate the updated template
      const validTemplate = UpdateBoardTemplateSchema.parse(updateData);
      
      // Save the updated template
      const savedTemplate = await this.templateRepository.saveBoardTemplate(validTemplate);
      this.logger.info('Board template updated', { name });
      
      return savedTemplate;
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.logger.error('Invalid board template update data', { name, templateData, errors: error.errors });
        throw new ValidationError('Invalid board template data', error);
      }
      this.logger.error('Failed to update board template', { name, templateData, error });
      throw error;
    }
  }

  async deleteBoardTemplate(name: string): Promise<void> {
    try {
      await this.templateRepository.deleteBoardTemplate(name);
      this.logger.info('Board template deleted', { name });
    } catch (error) {
      this.logger.error('Failed to delete board template', { name, error });
      throw error;
    }
  }

  async createBoardFromTemplate(templateName: string): Promise<Board> {
    try {
      // Get the template
      const template = await this.getBoardTemplateByName(templateName);
      
      // Create board data from template
      const boardData: CreateBoard = {
        title: template.title,
        description: template.boardDescription,
        columns: template.columns.map(col => col.title),
        tags: template.tags,
        settings: template.settings
      };
      
      // Create the board
      const board = await this.boardRepository.create(boardData);
      
      this.logger.info('Board created from template', { 
        templateName, 
        boardId: board.id 
      });
      
      return board;
    } catch (error) {
      this.logger.error('Failed to create board from template', { 
        templateName, 
        error 
      });
      throw error;
    }
  }

  async extractTemplateFromBoard(
    boardId: string, 
    templateName: string, 
    description?: string
  ): Promise<BoardTemplate> {
    try {
      // Get the board
      const board = await this.boardRepository.findById(boardId);
      if (!board) {
        throw new NotFoundError(`Board with ID ${boardId} not found`);
      }
      
      // Create a board template from the board
      const template: CreateBoardTemplate = {
        name: templateName,
        description: description || `Template based on board: ${board.title}`,
        category: 'custom',
        isDefault: false,
        title: board.title,
        boardDescription: board.description,
        columns: board.columns.map(column => {
          const cardsInColumn = board.cards.filter(card => card.columnId === column.id);
          return {
            title: column.title,
            wipLimit: column.wipLimit,
            cards: cardsInColumn.map(card => ({
              title: card.title,
              description: card.description,
              priority: card.priority,
              status: card.status,
              assignee: card.assignee,
              tags: card.tags,
              dueDate: card.dueDate
            }))
          };
        }),
        tags: board.tags,
        settings: board.settings
      };
      
      // Save the template
      const savedTemplate = await this.createBoardTemplate(template);
      this.logger.info('Board template extracted', { boardId, templateName });
      
      return savedTemplate;
    } catch (error) {
      this.logger.error('Failed to extract board template', { 
        boardId, 
        templateName, 
        error 
      });
      throw error;
    }
  }

  // Initialize default templates
  async initializeDefaultTemplates(): Promise<void> {
    try {
      this.logger.info('Initializing default templates...');
      
      // Check if any templates already exist
      const existingBoards = await this.getAllBoardTemplates();
      const existingColumns = await this.getAllColumnTemplates();
      const existingCards = await this.getAllCardTemplates();
      
      // Only initialize if no templates exist yet
      if (existingBoards.length === 0) {
        this.logger.info('Creating default board templates...');
        for (const template of defaultBoardTemplates) {
          await this.createBoardTemplate(template);
        }
      }
      
      if (existingColumns.length === 0) {
        this.logger.info('Creating default column templates...');
        for (const template of defaultColumnTemplates) {
          await this.createColumnTemplate(template);
        }
      }
      
      if (existingCards.length === 0) {
        this.logger.info('Creating default card templates...');
        for (const template of defaultCardTemplates) {
          await this.createCardTemplate(template);
        }
      }
      
      this.logger.info('Default templates initialization completed');
    } catch (error) {
      this.logger.error('Failed to initialize default templates', { error });
      throw error;
    }
  }

  // Load default templates from a directory
  async loadDefaultTemplates(defaultsPath: string): Promise<void> {
    try {
      await this.templateRepository.loadDefaultTemplates(defaultsPath);
      this.logger.info('Default templates loaded', { defaultsPath });
    } catch (error) {
      this.logger.error('Failed to load default templates', { defaultsPath, error });
      throw error;
    }
  }
}