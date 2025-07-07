import { IRepository, IFileSystemRepository } from './interfaces';
import { PaginationParams, SortParams } from '@core/schemas';
import { NotFoundError, ValidationError } from '@core/errors';
import { logger } from '@core/utils';
import { ValidationHelper } from '@core/schemas';

export abstract class BaseRepository<T extends { id: string }, TCreate = Partial<T>, TUpdate = Partial<T>> 
  implements IRepository<T, TCreate, TUpdate> {
  
  protected logger = logger.child({ repository: this.constructor.name });
  
  constructor(
    protected fileSystem: IFileSystemRepository,
    protected basePath: string
  ) {}

  protected abstract getFilePath(id?: string): string;
  protected abstract validateCreate(data: TCreate): Promise<void>;
  protected abstract validateUpdate(data: TUpdate): Promise<void>;
  protected abstract createEntity(data: TCreate): Promise<T>;
  protected abstract updateEntity(existing: T, updates: TUpdate): Promise<T>;

  async findAll(pagination?: PaginationParams, sort?: SortParams): Promise<T[]> {
    try {
      const files = await this.fileSystem.list(this.basePath);
      const entities: T[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = `${this.basePath}/${file}`;
            const entity = await this.fileSystem.read<T>(filePath);
            entities.push(entity);
          } catch (error) {
            this.logger.warn(`Failed to read entity from ${file}`, { error });
          }
        }
      }

      // Apply sorting
      if (sort) {
        entities.sort((a, b) => {
          const aValue = (a as any)[sort.field];
          const bValue = (b as any)[sort.field];
          
          if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // Apply pagination
      if (pagination) {
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        return entities.slice(startIndex, endIndex);
      }

      return entities;
    } catch (error) {
      this.logger.error('Failed to find all entities', { error });
      throw error;
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      ValidationHelper.validateUUID(id);
      
      const filePath = this.getFilePath(id);
      const exists = await this.fileSystem.exists(filePath);
      
      if (!exists) {
        return null;
      }

      const entity = await this.fileSystem.read<T>(filePath);
      this.logger.debug('Entity found', { id, entity: entity.id });
      
      return entity;
    } catch (error) {
      this.logger.error('Failed to find entity by ID', { id, error });
      throw error;
    }
  }

  async create(data: TCreate): Promise<T> {
    try {
      await this.validateCreate(data);
      
      const entity = await this.createEntity(data);
      const filePath = this.getFilePath(entity.id);
      
      // Ensure the entity doesn't already exist
      const exists = await this.fileSystem.exists(filePath);
      if (exists) {
        throw new ValidationError(`Entity with id ${entity.id} already exists`);
      }

      await this.fileSystem.write(filePath, entity);
      this.logger.info('Entity created', { id: entity.id });
      
      return entity;
    } catch (error) {
      this.logger.error('Failed to create entity', { data, error });
      throw error;
    }
  }

  async update(id: string, data: TUpdate): Promise<T> {
    try {
      ValidationHelper.validateUUID(id);
      await this.validateUpdate(data);
      
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Entity', id);
      }

      const updated = await this.updateEntity(existing, data);
      const filePath = this.getFilePath(id);
      
      await this.fileSystem.write(filePath, updated);
      this.logger.info('Entity updated', { id, updates: Object.keys(data as object) });
      
      return updated;
    } catch (error) {
      this.logger.error('Failed to update entity', { id, data, error });
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      ValidationHelper.validateUUID(id);
      
      const filePath = this.getFilePath(id);
      const exists = await this.fileSystem.exists(filePath);
      
      if (!exists) {
        return false;
      }

      const deleted = await this.fileSystem.delete(filePath);
      
      if (deleted) {
        this.logger.info('Entity deleted', { id });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete entity', { id, error });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      ValidationHelper.validateUUID(id);
      const filePath = this.getFilePath(id);
      return await this.fileSystem.exists(filePath);
    } catch (error) {
      this.logger.error('Failed to check entity existence', { id, error });
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      const files = await this.fileSystem.list(this.basePath);
      return files.filter(file => file.endsWith('.json')).length;
    } catch (error) {
      this.logger.error('Failed to count entities', { error });
      throw error;
    }
  }

  protected async ensureDirectoryExists(): Promise<void> {
    const exists = await this.fileSystem.exists(this.basePath);
    if (!exists) {
      await this.fileSystem.createDirectory(this.basePath);
    }
  }
}