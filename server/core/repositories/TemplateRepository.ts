import { promises as fs } from 'fs';
import { join } from 'path';
import { 
  CardTemplate, 
  ColumnTemplate, 
  BoardTemplate,
  CreateCardTemplate,
  UpdateCardTemplate,
  CreateColumnTemplate,
  UpdateColumnTemplate,
  CreateBoardTemplate,
  UpdateBoardTemplate
} from '@core/schemas/templateSchemas';
import { NotFoundError, FileSystemError } from '@core/errors';
import { FileSystemRepository } from './FileSystemRepository';
import { Logger } from '@core/utils/logger';

export interface ITemplateRepository {
  // Card Template Methods
  getAllCardTemplates(): Promise<CardTemplate[]>;
  getCardTemplateByName(name: string): Promise<CardTemplate | null>;
  saveCardTemplate(template: CreateCardTemplate | UpdateCardTemplate): Promise<CardTemplate>;
  deleteCardTemplate(name: string): Promise<void>;

  // Column Template Methods
  getAllColumnTemplates(): Promise<ColumnTemplate[]>;
  getColumnTemplateByName(name: string): Promise<ColumnTemplate | null>;
  saveColumnTemplate(template: CreateColumnTemplate | UpdateColumnTemplate): Promise<ColumnTemplate>;
  deleteColumnTemplate(name: string): Promise<void>;

  // Board Template Methods
  getAllBoardTemplates(): Promise<BoardTemplate[]>;
  getBoardTemplateByName(name: string): Promise<BoardTemplate | null>;
  saveBoardTemplate(template: CreateBoardTemplate | UpdateBoardTemplate): Promise<BoardTemplate>;
  deleteBoardTemplate(name: string): Promise<void>;

  // Utility Methods
  loadDefaultTemplates(defaultsPath: string): Promise<void>;
}

export class TemplateRepository implements ITemplateRepository {
  private basePath: string;
  private boardTemplatesPath: string;
  private columnTemplatesPath: string;
  private cardTemplatesPath: string;
  private fileSystem: FileSystemRepository;
  private logger: Logger;

  constructor(basePath: string = join(process.cwd(), 'templates')) {
    this.basePath = basePath;
    this.boardTemplatesPath = join(this.basePath, 'boards');
    this.columnTemplatesPath = join(this.basePath, 'columns');
    this.cardTemplatesPath = join(this.basePath, 'cards');
    this.fileSystem = new FileSystemRepository();
    this.logger = new Logger('TemplateRepository');
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await this.fileSystem.createDirectory(this.basePath);
      await this.fileSystem.createDirectory(this.boardTemplatesPath);
      await this.fileSystem.createDirectory(this.columnTemplatesPath);
      await this.fileSystem.createDirectory(this.cardTemplatesPath);
    } catch (error) {
      this.logger.error('Failed to initialize template directories', { error });
      throw new FileSystemError('Failed to initialize template directories', error);
    }
  }

  // Card Template Methods
  async getAllCardTemplates(): Promise<CardTemplate[]> {
    try {
      const files = await this.fileSystem.list(this.cardTemplatesPath);
      const templates: CardTemplate[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const template = await this.fileSystem.read<CardTemplate>(
            join(this.cardTemplatesPath, file)
          );
          templates.push(template);
        } catch (error) {
          this.logger.warn(`Failed to read card template file: ${file}`, { error });
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error('Failed to read card templates', { error });
      throw new FileSystemError('Failed to read card templates', error);
    }
  }

  async getCardTemplateByName(name: string): Promise<CardTemplate | null> {
    try {
      const filePath = join(this.cardTemplatesPath, `${name}.json`);
      
      if (!(await this.fileSystem.exists(filePath))) {
        return null;
      }

      return await this.fileSystem.read<CardTemplate>(filePath);
    } catch (error) {
      this.logger.error('Failed to get card template', { name, error });
      throw new FileSystemError('Failed to get card template', error);
    }
  }

  async saveCardTemplate(template: CreateCardTemplate | UpdateCardTemplate): Promise<CardTemplate> {
    try {
      const filePath = join(this.cardTemplatesPath, `${template.name}.json`);
      
      // Ensure the template has required fields
      const savedTemplate: CardTemplate = {
        ...template,
        isDefault: template.isDefault ?? false,
        priority: template.priority ?? 'medium',
        status: template.status ?? 'pending',
        tags: template.tags ?? []
      };

      await this.fileSystem.write(filePath, savedTemplate);
      this.logger.info('Card template saved', { name: template.name });
      
      return savedTemplate;
    } catch (error) {
      this.logger.error('Failed to save card template', { name: template.name, error });
      throw new FileSystemError('Failed to save card template', error);
    }
  }

  async deleteCardTemplate(name: string): Promise<void> {
    try {
      const filePath = join(this.cardTemplatesPath, `${name}.json`);
      
      if (!(await this.fileSystem.exists(filePath))) {
        throw new NotFoundError(`Card template with name '${name}' not found`);
      }

      await this.fileSystem.delete(filePath);
      this.logger.info('Card template deleted', { name });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to delete card template', { name, error });
      throw new FileSystemError('Failed to delete card template', error);
    }
  }

  // Column Template Methods
  async getAllColumnTemplates(): Promise<ColumnTemplate[]> {
    try {
      const files = await this.fileSystem.list(this.columnTemplatesPath);
      const templates: ColumnTemplate[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const template = await this.fileSystem.read<ColumnTemplate>(
            join(this.columnTemplatesPath, file)
          );
          templates.push(template);
        } catch (error) {
          this.logger.warn(`Failed to read column template file: ${file}`, { error });
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error('Failed to read column templates', { error });
      throw new FileSystemError('Failed to read column templates', error);
    }
  }

  async getColumnTemplateByName(name: string): Promise<ColumnTemplate | null> {
    try {
      const filePath = join(this.columnTemplatesPath, `${name}.json`);
      
      if (!(await this.fileSystem.exists(filePath))) {
        return null;
      }

      return await this.fileSystem.read<ColumnTemplate>(filePath);
    } catch (error) {
      this.logger.error('Failed to get column template', { name, error });
      throw new FileSystemError('Failed to get column template', error);
    }
  }

  async saveColumnTemplate(template: CreateColumnTemplate | UpdateColumnTemplate): Promise<ColumnTemplate> {
    try {
      const filePath = join(this.columnTemplatesPath, `${template.name}.json`);
      
      // Ensure the template has required fields
      const savedTemplate: ColumnTemplate = {
        ...template,
        isDefault: template.isDefault ?? false,
        cards: template.cards ?? []
      };

      await this.fileSystem.write(filePath, savedTemplate);
      this.logger.info('Column template saved', { name: template.name });
      
      return savedTemplate;
    } catch (error) {
      this.logger.error('Failed to save column template', { name: template.name, error });
      throw new FileSystemError('Failed to save column template', error);
    }
  }

  async deleteColumnTemplate(name: string): Promise<void> {
    try {
      const filePath = join(this.columnTemplatesPath, `${name}.json`);
      
      if (!(await this.fileSystem.exists(filePath))) {
        throw new NotFoundError(`Column template with name '${name}' not found`);
      }

      await this.fileSystem.delete(filePath);
      this.logger.info('Column template deleted', { name });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to delete column template', { name, error });
      throw new FileSystemError('Failed to delete column template', error);
    }
  }

  // Board Template Methods
  async getAllBoardTemplates(): Promise<BoardTemplate[]> {
    try {
      const files = await this.fileSystem.list(this.boardTemplatesPath);
      const templates: BoardTemplate[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const template = await this.fileSystem.read<BoardTemplate>(
            join(this.boardTemplatesPath, file)
          );
          templates.push(template);
        } catch (error) {
          this.logger.warn(`Failed to read board template file: ${file}`, { error });
        }
      }

      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error('Failed to read board templates', { error });
      throw new FileSystemError('Failed to read board templates', error);
    }
  }

  async getBoardTemplateByName(name: string): Promise<BoardTemplate | null> {
    try {
      const filePath = join(this.boardTemplatesPath, `${name}.json`);
      
      if (!(await this.fileSystem.exists(filePath))) {
        return null;
      }

      return await this.fileSystem.read<BoardTemplate>(filePath);
    } catch (error) {
      this.logger.error('Failed to get board template', { name, error });
      throw new FileSystemError('Failed to get board template', error);
    }
  }

  async saveBoardTemplate(template: CreateBoardTemplate | UpdateBoardTemplate): Promise<BoardTemplate> {
    try {
      const filePath = join(this.boardTemplatesPath, `${template.name}.json`);
      
      // Ensure the template has required fields
      const savedTemplate: BoardTemplate = {
        ...template,
        isDefault: template.isDefault ?? false,
        tags: template.tags ?? [],
        settings: template.settings ?? {}
      };

      await this.fileSystem.write(filePath, savedTemplate);
      this.logger.info('Board template saved', { name: template.name });
      
      return savedTemplate;
    } catch (error) {
      this.logger.error('Failed to save board template', { name: template.name, error });
      throw new FileSystemError('Failed to save board template', error);
    }
  }

  async deleteBoardTemplate(name: string): Promise<void> {
    try {
      const filePath = join(this.boardTemplatesPath, `${name}.json`);
      
      if (!(await this.fileSystem.exists(filePath))) {
        throw new NotFoundError(`Board template with name '${name}' not found`);
      }

      await this.fileSystem.delete(filePath);
      this.logger.info('Board template deleted', { name });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.logger.error('Failed to delete board template', { name, error });
      throw new FileSystemError('Failed to delete board template', error);
    }
  }

  // Load default templates from a specified directory
  async loadDefaultTemplates(defaultsPath: string): Promise<void> {
    try {
      // Load board templates
      const boardsPath = join(defaultsPath, 'boards');
      if (await this.directoryExists(boardsPath)) {
        const files = await fs.readdir(boardsPath);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          try {
            const content = await fs.readFile(join(boardsPath, file), 'utf-8');
            const template = JSON.parse(content) as BoardTemplate;
            template.isDefault = true;
            await this.saveBoardTemplate(template);
            this.logger.info('Default board template loaded', { name: template.name });
          } catch (error) {
            this.logger.warn(`Failed to load default board template: ${file}`, { error });
          }
        }
      }

      // Load column templates
      const columnsPath = join(defaultsPath, 'columns');
      if (await this.directoryExists(columnsPath)) {
        const files = await fs.readdir(columnsPath);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          try {
            const content = await fs.readFile(join(columnsPath, file), 'utf-8');
            const template = JSON.parse(content) as ColumnTemplate;
            template.isDefault = true;
            await this.saveColumnTemplate(template);
            this.logger.info('Default column template loaded', { name: template.name });
          } catch (error) {
            this.logger.warn(`Failed to load default column template: ${file}`, { error });
          }
        }
      }

      // Load card templates
      const cardsPath = join(defaultsPath, 'cards');
      if (await this.directoryExists(cardsPath)) {
        const files = await fs.readdir(cardsPath);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          try {
            const content = await fs.readFile(join(cardsPath, file), 'utf-8');
            const template = JSON.parse(content) as CardTemplate;
            template.isDefault = true;
            await this.saveCardTemplate(template);
            this.logger.info('Default card template loaded', { name: template.name });
          } catch (error) {
            this.logger.warn(`Failed to load default card template: ${file}`, { error });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to load default templates', { defaultsPath, error });
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