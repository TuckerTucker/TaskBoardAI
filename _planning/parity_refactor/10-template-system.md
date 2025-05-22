# 10 - Template System

This document outlines the implementation of a comprehensive template system for the TaskBoardAI application. The template system will allow users to create, save, and apply templates for boards, columns, and cards, enhancing productivity and consistency across the application.

## Overview

Templates are essential for standardizing workflows and reducing repetitive setup tasks. They enable users to quickly create new boards with predefined structures or add cards with consistent formats. This implementation will provide template capabilities across all interfaces:

- MCP (Model Context Protocol)
- REST API 
- CLI

## Implementation Steps

### 1. Template Schema Definitions

First, we'll define schemas for templates using Zod. These schemas will validate template structures and ensure consistency.

```typescript
// src/schemas/templateSchemas.ts
import { z } from 'zod';
import { CardSchema, ColumnSchema, BoardSchema } from './entitySchemas';

export const CardTemplateSchema = CardSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isDefault: z.boolean().default(false)
});

export const ColumnTemplateSchema = ColumnSchema.omit({ 
  id: true 
}).extend({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isDefault: z.boolean().default(false),
  cards: z.array(CardTemplateSchema.omit({ 
    name: true, 
    description: true, 
    category: true, 
    isDefault: true 
  })).optional()
});

export const BoardTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isDefault: z.boolean().default(false),
  title: z.string().min(1, "Board title is required"),
  description: z.string().optional(),
  columns: z.array(ColumnTemplateSchema.omit({ 
    name: true, 
    description: true, 
    category: true, 
    isDefault: true 
  })),
  tags: z.array(z.string()).default([]),
  settings: z.record(z.any()).optional()
});

export type CardTemplate = z.infer<typeof CardTemplateSchema>;
export type ColumnTemplate = z.infer<typeof ColumnTemplateSchema>;
export type BoardTemplate = z.infer<typeof BoardTemplateSchema>;
```

### 2. Template Storage and Repository

Implement the repository layer for managing templates. Templates will be stored in JSON files in a dedicated directory.

```typescript
// src/repositories/TemplateRepository.ts
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  CardTemplate, 
  ColumnTemplate, 
  BoardTemplate 
} from '../schemas/templateSchemas';
import { NotFoundError, FileSystemError } from '../utils/errors';
import { ensureDirectoryExists } from '../utils/fileSystem';

export class TemplateRepository {
  private basePath: string;
  private boardTemplatesPath: string;
  private columnTemplatesPath: string;
  private cardTemplatesPath: string;

  constructor(basePath: string = path.join(process.cwd(), 'templates')) {
    this.basePath = basePath;
    this.boardTemplatesPath = path.join(this.basePath, 'boards');
    this.columnTemplatesPath = path.join(this.basePath, 'columns');
    this.cardTemplatesPath = path.join(this.basePath, 'cards');
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await ensureDirectoryExists(this.basePath);
      await ensureDirectoryExists(this.boardTemplatesPath);
      await ensureDirectoryExists(this.columnTemplatesPath);
      await ensureDirectoryExists(this.cardTemplatesPath);
    } catch (error) {
      throw new FileSystemError('Failed to initialize template directories', error);
    }
  }

  // Card Template Methods
  async getAllCardTemplates(): Promise<CardTemplate[]> {
    try {
      const files = await fs.readdir(this.cardTemplatesPath);
      const templates = await Promise.all(
        files.filter(file => file.endsWith('.json'))
          .map(async file => {
            const content = await fs.readFile(path.join(this.cardTemplatesPath, file), 'utf-8');
            return JSON.parse(content) as CardTemplate;
          })
      );
      return templates;
    } catch (error) {
      throw new FileSystemError('Failed to read card templates', error);
    }
  }

  async getCardTemplateByName(name: string): Promise<CardTemplate | null> {
    try {
      const templates = await this.getAllCardTemplates();
      return templates.find(template => template.name === name) || null;
    } catch (error) {
      throw new FileSystemError('Failed to get card template', error);
    }
  }

  async saveCardTemplate(template: CardTemplate): Promise<CardTemplate> {
    try {
      // Check if a template with this name already exists
      const existing = await this.getCardTemplateByName(template.name);
      if (existing) {
        // Update existing template
        await fs.writeFile(
          path.join(this.cardTemplatesPath, `${template.name}.json`),
          JSON.stringify(template, null, 2)
        );
        return template;
      }

      // Create new template
      await fs.writeFile(
        path.join(this.cardTemplatesPath, `${template.name}.json`),
        JSON.stringify(template, null, 2)
      );
      return template;
    } catch (error) {
      throw new FileSystemError('Failed to save card template', error);
    }
  }

  async deleteCardTemplate(name: string): Promise<void> {
    try {
      const template = await this.getCardTemplateByName(name);
      if (!template) {
        throw new NotFoundError(`Card template with name '${name}' not found`);
      }

      await fs.unlink(path.join(this.cardTemplatesPath, `${name}.json`));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new FileSystemError('Failed to delete card template', error);
    }
  }

  // Column Template Methods
  async getAllColumnTemplates(): Promise<ColumnTemplate[]> {
    try {
      const files = await fs.readdir(this.columnTemplatesPath);
      const templates = await Promise.all(
        files.filter(file => file.endsWith('.json'))
          .map(async file => {
            const content = await fs.readFile(path.join(this.columnTemplatesPath, file), 'utf-8');
            return JSON.parse(content) as ColumnTemplate;
          })
      );
      return templates;
    } catch (error) {
      throw new FileSystemError('Failed to read column templates', error);
    }
  }

  async getColumnTemplateByName(name: string): Promise<ColumnTemplate | null> {
    try {
      const templates = await this.getAllColumnTemplates();
      return templates.find(template => template.name === name) || null;
    } catch (error) {
      throw new FileSystemError('Failed to get column template', error);
    }
  }

  async saveColumnTemplate(template: ColumnTemplate): Promise<ColumnTemplate> {
    try {
      // Check if a template with this name already exists
      const existing = await this.getColumnTemplateByName(template.name);
      if (existing) {
        // Update existing template
        await fs.writeFile(
          path.join(this.columnTemplatesPath, `${template.name}.json`),
          JSON.stringify(template, null, 2)
        );
        return template;
      }

      // Create new template
      await fs.writeFile(
        path.join(this.columnTemplatesPath, `${template.name}.json`),
        JSON.stringify(template, null, 2)
      );
      return template;
    } catch (error) {
      throw new FileSystemError('Failed to save column template', error);
    }
  }

  async deleteColumnTemplate(name: string): Promise<void> {
    try {
      const template = await this.getColumnTemplateByName(name);
      if (!template) {
        throw new NotFoundError(`Column template with name '${name}' not found`);
      }

      await fs.unlink(path.join(this.columnTemplatesPath, `${name}.json`));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new FileSystemError('Failed to delete column template', error);
    }
  }

  // Board Template Methods
  async getAllBoardTemplates(): Promise<BoardTemplate[]> {
    try {
      const files = await fs.readdir(this.boardTemplatesPath);
      const templates = await Promise.all(
        files.filter(file => file.endsWith('.json'))
          .map(async file => {
            const content = await fs.readFile(path.join(this.boardTemplatesPath, file), 'utf-8');
            return JSON.parse(content) as BoardTemplate;
          })
      );
      return templates;
    } catch (error) {
      throw new FileSystemError('Failed to read board templates', error);
    }
  }

  async getBoardTemplateByName(name: string): Promise<BoardTemplate | null> {
    try {
      const templates = await this.getAllBoardTemplates();
      return templates.find(template => template.name === name) || null;
    } catch (error) {
      throw new FileSystemError('Failed to get board template', error);
    }
  }

  async saveBoardTemplate(template: BoardTemplate): Promise<BoardTemplate> {
    try {
      // Check if a template with this name already exists
      const existing = await this.getBoardTemplateByName(template.name);
      if (existing) {
        // Update existing template
        await fs.writeFile(
          path.join(this.boardTemplatesPath, `${template.name}.json`),
          JSON.stringify(template, null, 2)
        );
        return template;
      }

      // Create new template
      await fs.writeFile(
        path.join(this.boardTemplatesPath, `${template.name}.json`),
        JSON.stringify(template, null, 2)
      );
      return template;
    } catch (error) {
      throw new FileSystemError('Failed to save board template', error);
    }
  }

  async deleteBoardTemplate(name: string): Promise<void> {
    try {
      const template = await this.getBoardTemplateByName(name);
      if (!template) {
        throw new NotFoundError(`Board template with name '${name}' not found`);
      }

      await fs.unlink(path.join(this.boardTemplatesPath, `${name}.json`));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new FileSystemError('Failed to delete board template', error);
    }
  }

  // Load default templates from a specified directory
  async loadDefaultTemplates(defaultsPath: string): Promise<void> {
    try {
      // Load board templates
      const boardsPath = path.join(defaultsPath, 'boards');
      if (await this.directoryExists(boardsPath)) {
        const files = await fs.readdir(boardsPath);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          const content = await fs.readFile(path.join(boardsPath, file), 'utf-8');
          const template = JSON.parse(content) as BoardTemplate;
          template.isDefault = true;
          await this.saveBoardTemplate(template);
        }
      }

      // Load column templates
      const columnsPath = path.join(defaultsPath, 'columns');
      if (await this.directoryExists(columnsPath)) {
        const files = await fs.readdir(columnsPath);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          const content = await fs.readFile(path.join(columnsPath, file), 'utf-8');
          const template = JSON.parse(content) as ColumnTemplate;
          template.isDefault = true;
          await this.saveColumnTemplate(template);
        }
      }

      // Load card templates
      const cardsPath = path.join(defaultsPath, 'cards');
      if (await this.directoryExists(cardsPath)) {
        const files = await fs.readdir(cardsPath);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          const content = await fs.readFile(path.join(cardsPath, file), 'utf-8');
          const template = JSON.parse(content) as CardTemplate;
          template.isDefault = true;
          await this.saveCardTemplate(template);
        }
      }
    } catch (error) {
      throw new FileSystemError('Failed to load default templates', error);
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
}
```

### 3. Template Service Layer

Implement the service layer for managing templates. This layer will handle business logic and validation.

```typescript
// src/services/TemplateService.ts
import { 
  CardTemplate, 
  ColumnTemplate, 
  BoardTemplate,
  CardTemplateSchema,
  ColumnTemplateSchema,
  BoardTemplateSchema
} from '../schemas/templateSchemas';
import { TemplateRepository } from '../repositories/TemplateRepository';
import { BoardRepository } from '../repositories/BoardRepository';
import { Board, Card, Column } from '../types/entities';
import { 
  ValidationError, 
  NotFoundError 
} from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class TemplateService {
  private templateRepository: TemplateRepository;
  private boardRepository: BoardRepository;

  constructor(
    templateRepository: TemplateRepository,
    boardRepository: BoardRepository
  ) {
    this.templateRepository = templateRepository;
    this.boardRepository = boardRepository;
  }

  // Card Template Methods
  async getAllCardTemplates(): Promise<CardTemplate[]> {
    return await this.templateRepository.getAllCardTemplates();
  }

  async getCardTemplateByName(name: string): Promise<CardTemplate> {
    const template = await this.templateRepository.getCardTemplateByName(name);
    if (!template) {
      throw new NotFoundError(`Card template with name '${name}' not found`);
    }
    return template;
  }

  async createCardTemplate(templateData: CardTemplate): Promise<CardTemplate> {
    try {
      // Validate the template data
      const validTemplate = CardTemplateSchema.parse(templateData);
      
      // Save the template
      return await this.templateRepository.saveCardTemplate(validTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid card template data', error);
      }
      throw error;
    }
  }

  async updateCardTemplate(name: string, templateData: Partial<CardTemplate>): Promise<CardTemplate> {
    // Get the existing template
    const existingTemplate = await this.getCardTemplateByName(name);
    
    // Merge the existing template with the update data
    const updatedTemplate = {
      ...existingTemplate,
      ...templateData,
      name: existingTemplate.name // Prevent changing the name
    };
    
    try {
      // Validate the updated template
      const validTemplate = CardTemplateSchema.parse(updatedTemplate);
      
      // Save the updated template
      return await this.templateRepository.saveCardTemplate(validTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid card template data', error);
      }
      throw error;
    }
  }

  async deleteCardTemplate(name: string): Promise<void> {
    await this.templateRepository.deleteCardTemplate(name);
  }

  async createCardFromTemplate(boardId: string, columnId: string, templateName: string): Promise<Card> {
    // Get the template
    const template = await this.getCardTemplateByName(templateName);
    
    // Get the board
    const board = await this.boardRepository.getBoardById(boardId);
    if (!board) {
      throw new NotFoundError(`Board with ID ${boardId} not found`);
    }
    
    // Find the column
    const column = board.columns.find(col => col.id === columnId);
    if (!column) {
      throw new NotFoundError(`Column with ID ${columnId} not found in board ${boardId}`);
    }
    
    // Create a new card from the template
    const newCard: Card = {
      id: uuidv4(),
      title: template.title,
      content: template.content,
      priority: template.priority,
      status: template.status,
      assignee: template.assignee,
      tags: template.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add the card to the column
    column.cards.push(newCard);
    
    // Save the updated board
    await this.boardRepository.updateBoard(boardId, board);
    
    return newCard;
  }

  // Column Template Methods
  async getAllColumnTemplates(): Promise<ColumnTemplate[]> {
    return await this.templateRepository.getAllColumnTemplates();
  }

  async getColumnTemplateByName(name: string): Promise<ColumnTemplate> {
    const template = await this.templateRepository.getColumnTemplateByName(name);
    if (!template) {
      throw new NotFoundError(`Column template with name '${name}' not found`);
    }
    return template;
  }

  async createColumnTemplate(templateData: ColumnTemplate): Promise<ColumnTemplate> {
    try {
      // Validate the template data
      const validTemplate = ColumnTemplateSchema.parse(templateData);
      
      // Save the template
      return await this.templateRepository.saveColumnTemplate(validTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid column template data', error);
      }
      throw error;
    }
  }

  async updateColumnTemplate(name: string, templateData: Partial<ColumnTemplate>): Promise<ColumnTemplate> {
    // Get the existing template
    const existingTemplate = await this.getColumnTemplateByName(name);
    
    // Merge the existing template with the update data
    const updatedTemplate = {
      ...existingTemplate,
      ...templateData,
      name: existingTemplate.name // Prevent changing the name
    };
    
    try {
      // Validate the updated template
      const validTemplate = ColumnTemplateSchema.parse(updatedTemplate);
      
      // Save the updated template
      return await this.templateRepository.saveColumnTemplate(validTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid column template data', error);
      }
      throw error;
    }
  }

  async deleteColumnTemplate(name: string): Promise<void> {
    await this.templateRepository.deleteColumnTemplate(name);
  }

  async createColumnFromTemplate(boardId: string, templateName: string): Promise<Column> {
    // Get the template
    const template = await this.getColumnTemplateByName(templateName);
    
    // Get the board
    const board = await this.boardRepository.getBoardById(boardId);
    if (!board) {
      throw new NotFoundError(`Board with ID ${boardId} not found`);
    }
    
    // Create a new column from the template
    const newColumn: Column = {
      id: uuidv4(),
      title: template.title,
      cards: []
    };
    
    // Add cards from the template if they exist
    if (template.cards && template.cards.length > 0) {
      newColumn.cards = template.cards.map(cardTemplate => ({
        id: uuidv4(),
        title: cardTemplate.title,
        content: cardTemplate.content,
        priority: cardTemplate.priority,
        status: cardTemplate.status,
        assignee: cardTemplate.assignee,
        tags: cardTemplate.tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    }
    
    // Add the column to the board
    board.columns.push(newColumn);
    
    // Save the updated board
    await this.boardRepository.updateBoard(boardId, board);
    
    return newColumn;
  }

  // Board Template Methods
  async getAllBoardTemplates(): Promise<BoardTemplate[]> {
    return await this.templateRepository.getAllBoardTemplates();
  }

  async getBoardTemplateByName(name: string): Promise<BoardTemplate> {
    const template = await this.templateRepository.getBoardTemplateByName(name);
    if (!template) {
      throw new NotFoundError(`Board template with name '${name}' not found`);
    }
    return template;
  }

  async createBoardTemplate(templateData: BoardTemplate): Promise<BoardTemplate> {
    try {
      // Validate the template data
      const validTemplate = BoardTemplateSchema.parse(templateData);
      
      // Save the template
      return await this.templateRepository.saveBoardTemplate(validTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid board template data', error);
      }
      throw error;
    }
  }

  async updateBoardTemplate(name: string, templateData: Partial<BoardTemplate>): Promise<BoardTemplate> {
    // Get the existing template
    const existingTemplate = await this.getBoardTemplateByName(name);
    
    // Merge the existing template with the update data
    const updatedTemplate = {
      ...existingTemplate,
      ...templateData,
      name: existingTemplate.name // Prevent changing the name
    };
    
    try {
      // Validate the updated template
      const validTemplate = BoardTemplateSchema.parse(updatedTemplate);
      
      // Save the updated template
      return await this.templateRepository.saveBoardTemplate(validTemplate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid board template data', error);
      }
      throw error;
    }
  }

  async deleteBoardTemplate(name: string): Promise<void> {
    await this.templateRepository.deleteBoardTemplate(name);
  }

  async createBoardFromTemplate(templateName: string): Promise<Board> {
    // Get the template
    const template = await this.getBoardTemplateByName(templateName);
    
    // Create a new board from the template
    const newBoard: Board = {
      id: uuidv4(),
      title: template.title,
      description: template.description,
      columns: [],
      tags: template.tags || [],
      settings: template.settings || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add columns from the template
    if (template.columns && template.columns.length > 0) {
      newBoard.columns = template.columns.map(columnTemplate => {
        const column: Column = {
          id: uuidv4(),
          title: columnTemplate.title,
          cards: []
        };
        
        // Add cards to the column if they exist
        if (columnTemplate.cards && columnTemplate.cards.length > 0) {
          column.cards = columnTemplate.cards.map(cardTemplate => ({
            id: uuidv4(),
            title: cardTemplate.title,
            content: cardTemplate.content,
            priority: cardTemplate.priority,
            status: cardTemplate.status,
            assignee: cardTemplate.assignee,
            tags: cardTemplate.tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
        }
        
        return column;
      });
    }
    
    // Save the new board
    return await this.boardRepository.createBoard(newBoard);
  }

  // Template Management
  async extractTemplateFromBoard(boardId: string, templateName: string, description?: string): Promise<BoardTemplate> {
    // Get the board
    const board = await this.boardRepository.getBoardById(boardId);
    if (!board) {
      throw new NotFoundError(`Board with ID ${boardId} not found`);
    }
    
    // Create a board template from the board
    const template: BoardTemplate = {
      name: templateName,
      description: description || `Template based on board: ${board.title}`,
      category: 'custom',
      isDefault: false,
      title: board.title,
      description: board.description,
      columns: board.columns.map(column => ({
        title: column.title,
        cards: column.cards.map(card => ({
          title: card.title,
          content: card.content,
          priority: card.priority,
          status: card.status,
          assignee: card.assignee,
          tags: card.tags
        }))
      })),
      tags: board.tags,
      settings: board.settings
    };
    
    // Save the template
    return await this.createBoardTemplate(template);
  }

  async extractTemplateFromColumn(boardId: string, columnId: string, templateName: string, description?: string): Promise<ColumnTemplate> {
    // Get the board
    const board = await this.boardRepository.getBoardById(boardId);
    if (!board) {
      throw new NotFoundError(`Board with ID ${boardId} not found`);
    }
    
    // Find the column
    const column = board.columns.find(col => col.id === columnId);
    if (!column) {
      throw new NotFoundError(`Column with ID ${columnId} not found in board ${boardId}`);
    }
    
    // Create a column template from the column
    const template: ColumnTemplate = {
      name: templateName,
      description: description || `Template based on column: ${column.title}`,
      category: 'custom',
      isDefault: false,
      title: column.title,
      cards: column.cards.map(card => ({
        title: card.title,
        content: card.content,
        priority: card.priority,
        status: card.status,
        assignee: card.assignee,
        tags: card.tags
      }))
    };
    
    // Save the template
    return await this.createColumnTemplate(template);
  }

  async extractTemplateFromCard(boardId: string, columnId: string, cardId: string, templateName: string, description?: string): Promise<CardTemplate> {
    // Get the board
    const board = await this.boardRepository.getBoardById(boardId);
    if (!board) {
      throw new NotFoundError(`Board with ID ${boardId} not found`);
    }
    
    // Find the column
    const column = board.columns.find(col => col.id === columnId);
    if (!column) {
      throw new NotFoundError(`Column with ID ${columnId} not found in board ${boardId}`);
    }
    
    // Find the card
    const card = column.cards.find(c => c.id === cardId);
    if (!card) {
      throw new NotFoundError(`Card with ID ${cardId} not found in column ${columnId}`);
    }
    
    // Create a card template from the card
    const template: CardTemplate = {
      name: templateName,
      description: description || `Template based on card: ${card.title}`,
      category: 'custom',
      isDefault: false,
      title: card.title,
      content: card.content,
      priority: card.priority,
      status: card.status,
      assignee: card.assignee,
      tags: card.tags
    };
    
    // Save the template
    return await this.createCardTemplate(template);
  }

  // Load default templates from a directory
  async loadDefaultTemplates(defaultsPath: string): Promise<void> {
    await this.templateRepository.loadDefaultTemplates(defaultsPath);
  }
}

// Update the ServiceFactory to include the TemplateService
export class ServiceFactory {
  // ... other services

  createTemplateService(): TemplateService {
    const templateRepository = new TemplateRepository();
    const boardRepository = new BoardRepository();
    return new TemplateService(templateRepository, boardRepository);
  }
}
```

### 4. MCP Interface Implementation

Update the MCP interface to provide template capabilities to agents.

```typescript
// src/mcp/tools/templates.js
import { ServiceFactory } from '../../services/ServiceFactory';
import { formatMcpError } from '../utils/errors';

export const templateTools = {
  // Board Template Tools
  getAllBoardTemplates: {
    description: "Get all board templates",
    parameters: {
      type: "object",
      properties: {}
    },
    async handler() {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const templates = await templateService.getAllBoardTemplates();
        
        return {
          success: true,
          data: {
            templates,
            count: templates.length
          },
          help: `Found ${templates.length} board templates. You can use these templates to create new boards quickly.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  getBoardTemplateByName: {
    description: "Get a board template by its name",
    parameters: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          description: "The name of the board template to retrieve"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const template = await templateService.getBoardTemplateByName(params.name);
        
        return {
          success: true,
          data: {
            template
          },
          help: `Retrieved board template: ${template.name}. You can create a new board using this template with the createBoardFromTemplate tool.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  createBoardTemplate: {
    description: "Create a new board template",
    parameters: {
      type: "object",
      required: ["template"],
      properties: {
        template: {
          type: "object",
          description: "The board template data"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const template = await templateService.createBoardTemplate(params.template);
        
        return {
          success: true,
          data: {
            template
          },
          help: `Created new board template: ${template.name}. You can now use this template to create new boards.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  updateBoardTemplate: {
    description: "Update an existing board template",
    parameters: {
      type: "object",
      required: ["name", "updates"],
      properties: {
        name: {
          type: "string",
          description: "The name of the board template to update"
        },
        updates: {
          type: "object",
          description: "The updates to apply to the template"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const template = await templateService.updateBoardTemplate(params.name, params.updates);
        
        return {
          success: true,
          data: {
            template
          },
          help: `Updated board template: ${template.name}.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  deleteBoardTemplate: {
    description: "Delete a board template",
    parameters: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          description: "The name of the board template to delete"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        await templateService.deleteBoardTemplate(params.name);
        
        return {
          success: true,
          data: {
            name: params.name,
            deleted: true
          },
          help: `Deleted board template: ${params.name}.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  createBoardFromTemplate: {
    description: "Create a new board from a template",
    parameters: {
      type: "object",
      required: ["templateName"],
      properties: {
        templateName: {
          type: "string",
          description: "The name of the template to use"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const board = await templateService.createBoardFromTemplate(params.templateName);
        
        return {
          success: true,
          data: {
            board,
            templateName: params.templateName
          },
          help: `Created a new board from template: ${params.templateName}. The new board ID is ${board.id}.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  extractBoardTemplate: {
    description: "Create a new template from an existing board",
    parameters: {
      type: "object",
      required: ["boardId", "templateName"],
      properties: {
        boardId: {
          type: "string",
          description: "The ID of the board to use as a template"
        },
        templateName: {
          type: "string",
          description: "The name for the new template"
        },
        description: {
          type: "string",
          description: "Optional description for the template"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const template = await templateService.extractTemplateFromBoard(
          params.boardId, 
          params.templateName, 
          params.description
        );
        
        return {
          success: true,
          data: {
            template,
            boardId: params.boardId
          },
          help: `Created a new board template "${params.templateName}" from board ${params.boardId}.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  // Column Template Tools
  getAllColumnTemplates: {
    description: "Get all column templates",
    parameters: {
      type: "object",
      properties: {}
    },
    async handler() {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const templates = await templateService.getAllColumnTemplates();
        
        return {
          success: true,
          data: {
            templates,
            count: templates.length
          },
          help: `Found ${templates.length} column templates. You can use these templates to create new columns quickly.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  // Additional column and card template tools with similar patterns...
  // For brevity, not all methods are shown here but would follow the same pattern
  
  // Example of a column template creation tool
  createColumnFromTemplate: {
    description: "Create a new column from a template",
    parameters: {
      type: "object",
      required: ["boardId", "templateName"],
      properties: {
        boardId: {
          type: "string",
          description: "The ID of the board to add the column to"
        },
        templateName: {
          type: "string",
          description: "The name of the template to use"
        }
      }
    },
    async handler(params) {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const column = await templateService.createColumnFromTemplate(
          params.boardId, 
          params.templateName
        );
        
        return {
          success: true,
          data: {
            column,
            boardId: params.boardId,
            templateName: params.templateName
          },
          help: `Created a new column from template: ${params.templateName} in board ${params.boardId}. The new column ID is ${column.id}.`
        };
      } catch (error) {
        return formatMcpError(error);
      }
    }
  },
  
  // Card template tools would follow the same pattern
};

// Add the template tools to the MCP server
// In src/mcp/kanbanMcpServer.js
import { templateTools } from './tools/templates';

// In the registerTools function
function registerTools() {
  // ... existing tools
  
  // Register template tools
  Object.entries(templateTools).forEach(([name, tool]) => {
    this.registerTool(name, tool.description, tool.parameters, tool.handler);
  });
}
```

### 5. REST API Implementation

Update the REST API to provide template capabilities.

```typescript
// src/controllers/templateController.ts
import { Request, Response, NextFunction } from 'express';
import { ServiceFactory } from '../services/ServiceFactory';
import { ValidationError } from '../utils/errors';

export class TemplateController {
  // Board Template Endpoints
  async getAllBoardTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      const templates = await templateService.getAllBoardTemplates();
      
      return res.status(200).json({
        success: true,
        count: templates.length,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getBoardTemplateByName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      const template = await templateService.getBoardTemplateByName(name);
      
      return res.status(200).json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }
  
  async createBoardTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const templateData = req.body;
      
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      const template = await templateService.createBoardTemplate(templateData);
      
      return res.status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }
  
  async updateBoardTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      const updates = req.body;
      
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      const template = await templateService.updateBoardTemplate(name, updates);
      
      return res.status(200).json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteBoardTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      await templateService.deleteBoardTemplate(name);
      
      return res.status(200).json({
        success: true,
        data: {
          name,
          deleted: true
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async createBoardFromTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateName } = req.body;
      
      if (!templateName) {
        throw new ValidationError('Template name is required');
      }
      
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      const board = await templateService.createBoardFromTemplate(templateName);
      
      return res.status(201).json({
        success: true,
        data: {
          board,
          templateName
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async extractBoardTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { boardId } = req.params;
      const { templateName, description } = req.body;
      
      if (!templateName) {
        throw new ValidationError('Template name is required');
      }
      
      const serviceFactory = new ServiceFactory();
      const templateService = serviceFactory.createTemplateService();
      
      const template = await templateService.extractTemplateFromBoard(
        boardId, 
        templateName, 
        description
      );
      
      return res.status(201).json({
        success: true,
        data: {
          template,
          boardId
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  // Column Template Endpoints
  // Similar pattern to board template endpoints
  // ...
  
  // Card Template Endpoints
  // Similar pattern to board template endpoints
  // ...
}

// src/routes/templateRoutes.ts
import { Router } from 'express';
import { TemplateController } from '../controllers/templateController';

const router = Router();
const templateController = new TemplateController();

// Board Template Routes
router.get('/boards', templateController.getAllBoardTemplates);
router.get('/boards/:name', templateController.getBoardTemplateByName);
router.post('/boards', templateController.createBoardTemplate);
router.put('/boards/:name', templateController.updateBoardTemplate);
router.delete('/boards/:name', templateController.deleteBoardTemplate);
router.post('/boards/create-from-template', templateController.createBoardFromTemplate);
router.post('/boards/extract-template/:boardId', templateController.extractBoardTemplate);

// Column Template Routes
router.get('/columns', templateController.getAllColumnTemplates);
router.get('/columns/:name', templateController.getColumnTemplateByName);
router.post('/columns', templateController.createColumnTemplate);
router.put('/columns/:name', templateController.updateColumnTemplate);
router.delete('/columns/:name', templateController.deleteColumnTemplate);
router.post('/columns/create-from-template', templateController.createColumnFromTemplate);
router.post('/columns/extract-template/:boardId/:columnId', templateController.extractColumnTemplate);

// Card Template Routes
router.get('/cards', templateController.getAllCardTemplates);
router.get('/cards/:name', templateController.getCardTemplateByName);
router.post('/cards', templateController.createCardTemplate);
router.put('/cards/:name', templateController.updateCardTemplate);
router.delete('/cards/:name', templateController.deleteCardTemplate);
router.post('/cards/create-from-template', templateController.createCardFromTemplate);
router.post('/cards/extract-template/:boardId/:columnId/:cardId', templateController.extractCardTemplate);

export default router;

// Update app.js to include the template routes
app.use('/api/templates', templateRoutes);
```

### 6. CLI Implementation

Update the CLI to provide template capabilities.

```typescript
// src/cli/commands/templateCommands.ts
import { Command } from 'commander';
import { Table } from 'cli-table3';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ServiceFactory } from '../../services/ServiceFactory';
import { handleCliError } from '../utils/errorHandler';

export function setupTemplateCommands(program: Command): void {
  const templateCommand = program
    .command('templates')
    .description('Manage board, column, and card templates');
  
  // Board Template Commands
  templateCommand
    .command('board:list')
    .description('List all board templates')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const templates = await templateService.getAllBoardTemplates();
        
        if (options.output === 'json') {
          console.log(JSON.stringify(templates, null, 2));
        } else {
          // Create table output
          const table = new Table({
            head: ['Name', 'Title', 'Category', 'Default', 'Description'],
            style: { head: ['cyan'] }
          });
          
          templates.forEach(template => {
            table.push([
              template.name,
              template.title,
              template.category || '-',
              template.isDefault ? chalk.green('✓') : '-',
              template.description || '-'
            ]);
          });
          
          console.log(table.toString());
          console.log(chalk.green(`Found ${templates.length} board templates`));
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  templateCommand
    .command('board:show')
    .description('Show details of a specific board template')
    .argument('<name>', 'The name of the template to show')
    .option('--output <format>', 'Output format (pretty, json)', 'pretty')
    .action(async (name, options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const template = await templateService.getBoardTemplateByName(name);
        
        if (options.output === 'json') {
          console.log(JSON.stringify(template, null, 2));
        } else {
          console.log(chalk.cyan(`Template: ${template.name}`));
          console.log(chalk.white(`Title: ${template.title}`));
          console.log(chalk.white(`Description: ${template.description || '-'}`));
          console.log(chalk.white(`Category: ${template.category || '-'}`));
          console.log(chalk.white(`Default: ${template.isDefault ? 'Yes' : 'No'}`));
          console.log(chalk.white(`Tags: ${template.tags.join(', ') || '-'}`));
          
          console.log(chalk.cyan('\nColumns:'));
          template.columns.forEach((column, index) => {
            console.log(chalk.white(`  ${index + 1}. ${column.title} (${column.cards?.length || 0} cards)`));
          });
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  templateCommand
    .command('board:create-from')
    .description('Create a new board from a template')
    .argument('<name>', 'The name of the template to use')
    .action(async (name) => {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const board = await templateService.createBoardFromTemplate(name);
        
        console.log(chalk.green(`Created new board from template: ${name}`));
        console.log(chalk.white(`Board ID: ${board.id}`));
        console.log(chalk.white(`Title: ${board.title}`));
        console.log(chalk.white(`Columns: ${board.columns.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
  
  templateCommand
    .command('board:extract')
    .description('Create a new template from an existing board')
    .argument('<boardId>', 'The ID of the board to use as a template')
    .option('--name <name>', 'The name for the new template')
    .option('--description <description>', 'Optional description for the template')
    .action(async (boardId, options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        const boardService = serviceFactory.createBoardService();
        
        // Get the board to show relevant information
        const board = await boardService.getBoardById(boardId);
        
        // If name not provided, prompt for it
        let templateName = options.name;
        if (!templateName) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Enter a name for the template:',
              default: `template-${board.title.toLowerCase().replace(/\s+/g, '-')}`,
              validate: (input) => input.trim() !== '' || 'Template name is required'
            }
          ]);
          templateName = answers.name;
        }
        
        const template = await templateService.extractTemplateFromBoard(
          boardId,
          templateName,
          options.description
        );
        
        console.log(chalk.green(`Created new board template "${template.name}" from board ${boardId}`));
        console.log(chalk.white(`Title: ${template.title}`));
        console.log(chalk.white(`Columns: ${template.columns.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
  
  templateCommand
    .command('board:delete')
    .description('Delete a board template')
    .argument('<name>', 'The name of the template to delete')
    .option('--force', 'Skip confirmation prompt', false)
    .action(async (name, options) => {
      try {
        // Confirm deletion if not forced
        if (!options.force) {
          const answers = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete the board template "${name}"?`,
              default: false
            }
          ]);
          
          if (!answers.confirm) {
            console.log(chalk.yellow('Deletion cancelled'));
            return;
          }
        }
        
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        await templateService.deleteBoardTemplate(name);
        
        console.log(chalk.green(`Deleted board template: ${name}`));
      } catch (error) {
        handleCliError(error);
      }
    });
  
  // Similar commands for column and card templates
  // ...
  
  // Example of column template commands
  templateCommand
    .command('column:list')
    .description('List all column templates')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const templates = await templateService.getAllColumnTemplates();
        
        if (options.output === 'json') {
          console.log(JSON.stringify(templates, null, 2));
        } else {
          // Create table output
          const table = new Table({
            head: ['Name', 'Title', 'Category', 'Default', 'Description'],
            style: { head: ['cyan'] }
          });
          
          templates.forEach(template => {
            table.push([
              template.name,
              template.title,
              template.category || '-',
              template.isDefault ? chalk.green('✓') : '-',
              template.description || '-'
            ]);
          });
          
          console.log(table.toString());
          console.log(chalk.green(`Found ${templates.length} column templates`));
        }
      } catch (error) {
        handleCliError(error);
      }
    });
  
  templateCommand
    .command('column:create-from')
    .description('Create a new column from a template')
    .argument('<boardId>', 'The ID of the board to add the column to')
    .argument('<templateName>', 'The name of the template to use')
    .action(async (boardId, templateName) => {
      try {
        const serviceFactory = new ServiceFactory();
        const templateService = serviceFactory.createTemplateService();
        
        const column = await templateService.createColumnFromTemplate(boardId, templateName);
        
        console.log(chalk.green(`Created new column from template: ${templateName}`));
        console.log(chalk.white(`Board ID: ${boardId}`));
        console.log(chalk.white(`Column ID: ${column.id}`));
        console.log(chalk.white(`Title: ${column.title}`));
        console.log(chalk.white(`Cards: ${column.cards.length}`));
      } catch (error) {
        handleCliError(error);
      }
    });
  
  // Similar commands for card templates
  // ...
  
  return templateCommand;
}

// Register the template commands
// In src/cli/index.ts
import { setupTemplateCommands } from './commands/templateCommands';

// In the setupCli function
export function setupCli(): Command {
  // ... existing code
  
  // Register template commands
  setupTemplateCommands(program);
  
  return program;
}
```

### 7. Default Templates

Create a set of default templates that will be loaded when the application starts.

```typescript
// templates/defaults/boards/basic-kanban.json
{
  "name": "basic-kanban",
  "description": "A basic kanban board with To Do, In Progress, and Done columns",
  "category": "general",
  "isDefault": true,
  "title": "New Kanban Board",
  "description": "A simple kanban board to track your tasks",
  "columns": [
    {
      "title": "To Do",
      "cards": []
    },
    {
      "title": "In Progress",
      "cards": []
    },
    {
      "title": "Done",
      "cards": []
    }
  ],
  "tags": ["kanban", "productivity"],
  "settings": {}
}

// templates/defaults/boards/project-management.json
{
  "name": "project-management",
  "description": "A project management board with Backlog, To Do, In Progress, Review, and Done columns",
  "category": "project",
  "isDefault": true,
  "title": "Project Management Board",
  "description": "A comprehensive board for managing projects",
  "columns": [
    {
      "title": "Backlog",
      "cards": []
    },
    {
      "title": "To Do",
      "cards": []
    },
    {
      "title": "In Progress",
      "cards": []
    },
    {
      "title": "Review",
      "cards": []
    },
    {
      "title": "Done",
      "cards": []
    }
  ],
  "tags": ["project", "management"],
  "settings": {}
}

// templates/defaults/cards/task.json
{
  "name": "task",
  "description": "A basic task card",
  "category": "general",
  "isDefault": true,
  "title": "New Task",
  "content": "Task description goes here",
  "priority": "medium",
  "status": "pending",
  "assignee": "",
  "tags": []
}

// templates/defaults/cards/bug.json
{
  "name": "bug",
  "description": "A bug report card",
  "category": "development",
  "isDefault": true,
  "title": "Bug: ",
  "content": "## Description\n\n## Steps to Reproduce\n1. \n2. \n3. \n\n## Expected Behavior\n\n## Actual Behavior\n\n## Environment\n",
  "priority": "high",
  "status": "open",
  "assignee": "",
  "tags": ["bug"]
}

// templates/defaults/cards/user-story.json
{
  "name": "user-story",
  "description": "A user story card",
  "category": "agile",
  "isDefault": true,
  "title": "User Story: ",
  "content": "## As a\n\n## I want to\n\n## So that\n\n## Acceptance Criteria\n- [ ] \n- [ ] \n- [ ] \n",
  "priority": "medium",
  "status": "pending",
  "assignee": "",
  "tags": ["user-story"]
}

// Add more default templates as needed
```

### 8. Initialize Templates on Application Start

Update the application initialization to load default templates.

```typescript
// src/server.js - addition to server initialization
import path from 'path';
import { ServiceFactory } from './services/ServiceFactory';

// In the server initialization function
export async function initializeServer() {
  // ... existing initialization code
  
  // Load default templates
  try {
    const serviceFactory = new ServiceFactory();
    const templateService = serviceFactory.createTemplateService();
    
    // Load default templates from the templates/defaults directory
    const defaultsPath = path.join(__dirname, '../templates/defaults');
    await templateService.loadDefaultTemplates(defaultsPath);
    
    console.log('Default templates loaded successfully');
  } catch (error) {
    console.error('Failed to load default templates:', error);
  }
  
  // Continue with server initialization
  // ...
}
```

## Testing Strategy

### Unit Tests

Create comprehensive unit tests for template functionality:

```typescript
// src/tests/unit/services/TemplateService.test.ts
import { TemplateService } from '../../../services/TemplateService';
import { TemplateRepository } from '../../../repositories/TemplateRepository';
import { BoardRepository } from '../../../repositories/BoardRepository';
import { NotFoundError, ValidationError } from '../../../utils/errors';

describe('TemplateService', () => {
  let templateService: TemplateService;
  let mockTemplateRepository: jest.Mocked<TemplateRepository>;
  let mockBoardRepository: jest.Mocked<BoardRepository>;
  
  beforeEach(() => {
    mockTemplateRepository = {
      getAllBoardTemplates: jest.fn(),
      getBoardTemplateByName: jest.fn(),
      saveBoardTemplate: jest.fn(),
      deleteBoardTemplate: jest.fn(),
      // ... other methods
    } as any;
    
    mockBoardRepository = {
      getBoardById: jest.fn(),
      createBoard: jest.fn(),
      updateBoard: jest.fn(),
      // ... other methods
    } as any;
    
    templateService = new TemplateService(mockTemplateRepository, mockBoardRepository);
  });
  
  describe('Board Templates', () => {
    it('should get all board templates', async () => {
      const mockTemplates = [
        { name: 'test1', title: 'Test 1', columns: [] },
        { name: 'test2', title: 'Test 2', columns: [] }
      ];
      
      mockTemplateRepository.getAllBoardTemplates.mockResolvedValue(mockTemplates);
      
      const result = await templateService.getAllBoardTemplates();
      
      expect(result).toEqual(mockTemplates);
      expect(mockTemplateRepository.getAllBoardTemplates).toHaveBeenCalled();
    });
    
    it('should get a board template by name', async () => {
      const mockTemplate = { name: 'test', title: 'Test', columns: [] };
      
      mockTemplateRepository.getBoardTemplateByName.mockResolvedValue(mockTemplate);
      
      const result = await templateService.getBoardTemplateByName('test');
      
      expect(result).toEqual(mockTemplate);
      expect(mockTemplateRepository.getBoardTemplateByName).toHaveBeenCalledWith('test');
    });
    
    it('should throw NotFoundError when template not found', async () => {
      mockTemplateRepository.getBoardTemplateByName.mockResolvedValue(null);
      
      await expect(templateService.getBoardTemplateByName('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
    
    it('should create a board template', async () => {
      const mockTemplate = {
        name: 'test',
        title: 'Test',
        columns: []
      };
      
      mockTemplateRepository.saveBoardTemplate.mockResolvedValue(mockTemplate);
      
      const result = await templateService.createBoardTemplate(mockTemplate);
      
      expect(result).toEqual(mockTemplate);
      expect(mockTemplateRepository.saveBoardTemplate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'test',
        title: 'Test'
      }));
    });
    
    it('should create a board from a template', async () => {
      const mockTemplate = {
        name: 'test',
        title: 'Test Board',
        description: 'Test Description',
        columns: [
          {
            title: 'Column 1',
            cards: [
              {
                title: 'Card 1',
                content: 'Content 1',
                priority: 'medium',
                status: 'pending',
                tags: []
              }
            ]
          }
        ],
        tags: ['test'],
        settings: {}
      };
      
      const mockCreatedBoard = {
        id: 'board-123',
        title: 'Test Board',
        description: 'Test Description',
        columns: [
          {
            id: 'column-123',
            title: 'Column 1',
            cards: [
              {
                id: 'card-123',
                title: 'Card 1',
                content: 'Content 1',
                priority: 'medium',
                status: 'pending',
                tags: [],
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
              }
            ]
          }
        ],
        tags: ['test'],
        settings: {},
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      };
      
      mockTemplateRepository.getBoardTemplateByName.mockResolvedValue(mockTemplate);
      mockBoardRepository.createBoard.mockResolvedValue(mockCreatedBoard);
      
      const result = await templateService.createBoardFromTemplate('test');
      
      expect(result).toEqual(mockCreatedBoard);
      expect(mockTemplateRepository.getBoardTemplateByName).toHaveBeenCalledWith('test');
      expect(mockBoardRepository.createBoard).toHaveBeenCalled();
    });
    
    // Additional tests for updating and deleting templates, extracting templates, etc.
  });
  
  // Similar tests for column and card templates
});
```

### Integration Tests

Create integration tests for template endpoints:

```typescript
// src/tests/integration/routes/templateRoutes.test.ts
import request from 'supertest';
import app from '../../../app';
import { ServiceFactory } from '../../../services/ServiceFactory';
import fs from 'fs/promises';
import path from 'path';

describe('Template API', () => {
  beforeEach(async () => {
    // Set up test data - create test templates
    // ...
  });
  
  afterEach(async () => {
    // Clean up test data
    // ...
  });
  
  describe('Board Templates', () => {
    it('should list all board templates', async () => {
      const response = await request(app)
        .get('/api/templates/boards');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('should get a board template by name', async () => {
      const response = await request(app)
        .get('/api/templates/boards/basic-kanban');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('basic-kanban');
    });
    
    it('should create a new board template', async () => {
      const template = {
        name: 'test-template',
        title: 'Test Template',
        description: 'Test Description',
        columns: [
          {
            title: 'Column 1',
            cards: []
          }
        ],
        tags: ['test'],
        settings: {}
      };
      
      const response = await request(app)
        .post('/api/templates/boards')
        .send(template);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test-template');
    });
    
    it('should create a board from a template', async () => {
      const response = await request(app)
        .post('/api/templates/boards/create-from-template')
        .send({ templateName: 'basic-kanban' });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.board).toBeDefined();
      expect(response.body.data.templateName).toBe('basic-kanban');
    });
    
    // Additional tests for updating, deleting, and extracting templates
  });
  
  // Similar tests for column and card templates
});
```

### MCP Tests

Create tests for MCP template tools:

```typescript
// src/tests/unit/mcp/tools/templates.test.ts
import { templateTools } from '../../../../mcp/tools/templates';
import { ServiceFactory } from '../../../../services/ServiceFactory';
import { NotFoundError } from '../../../../utils/errors';

describe('MCP Template Tools', () => {
  let mockTemplateService;
  
  beforeEach(() => {
    mockTemplateService = {
      getAllBoardTemplates: jest.fn(),
      getBoardTemplateByName: jest.fn(),
      createBoardTemplate: jest.fn(),
      updateBoardTemplate: jest.fn(),
      deleteBoardTemplate: jest.fn(),
      createBoardFromTemplate: jest.fn(),
      extractTemplateFromBoard: jest.fn(),
      // ... other methods
    };
    
    // Mock the ServiceFactory to return our mock service
    jest.spyOn(ServiceFactory.prototype, 'createTemplateService').mockReturnValue(mockTemplateService);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Board Templates', () => {
    it('should get all board templates', async () => {
      const mockTemplates = [
        { name: 'test1', title: 'Test 1', columns: [] },
        { name: 'test2', title: 'Test 2', columns: [] }
      ];
      
      mockTemplateService.getAllBoardTemplates.mockResolvedValue(mockTemplates);
      
      const result = await templateTools.getAllBoardTemplates.handler();
      
      expect(result.success).toBe(true);
      expect(result.data.templates).toEqual(mockTemplates);
      expect(result.data.count).toBe(2);
    });
    
    it('should get a board template by name', async () => {
      const mockTemplate = { name: 'test', title: 'Test', columns: [] };
      
      mockTemplateService.getBoardTemplateByName.mockResolvedValue(mockTemplate);
      
      const result = await templateTools.getBoardTemplateByName.handler({ name: 'test' });
      
      expect(result.success).toBe(true);
      expect(result.data.template).toEqual(mockTemplate);
    });
    
    it('should handle errors properly', async () => {
      mockTemplateService.getBoardTemplateByName.mockRejectedValue(
        new NotFoundError('Template not found')
      );
      
      const result = await templateTools.getBoardTemplateByName.handler({ name: 'nonexistent' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Template not found');
    });
    
    // Additional tests for creating, updating, deleting, and using templates
  });
  
  // Similar tests for column and card template tools
});
```

## Benefits and Impact

Implementing a template system provides several benefits:

1. **Increased Productivity**: Users can quickly create new boards, columns, and cards with predefined structures.

2. **Standardization**: Templates promote consistency in how information is structured across boards.

3. **Reduced Repetitive Work**: Common patterns don't need to be recreated from scratch each time.

4. **Better Agent Capabilities**: MCP agents can use templates to create standardized structures based on user requirements.

5. **Knowledge Sharing**: Custom templates can be shared among team members.

## Conclusion

The template system is a significant enhancement to the TaskBoardAI application. By providing the ability to create, save, and apply templates for boards, columns, and cards, we enable users to work more efficiently and consistently. The system is accessible through all interfaces (MCP, REST API, and CLI), ensuring a consistent experience regardless of how users access the application.