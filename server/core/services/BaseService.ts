import { IService } from './interfaces';
import { IRepository } from '@core/repositories';
import { PaginationParams, SortParams } from '@core/schemas';
import { NotFoundError } from '@core/errors';
import { logger } from '@core/utils';

export abstract class BaseService<T extends { id: string }, TCreate = Partial<T>, TUpdate = Partial<T>> 
  implements IService<T, TCreate, TUpdate> {
  
  protected logger = logger.child({ service: this.constructor.name });
  
  constructor(
    protected repository: IRepository<T, TCreate, TUpdate>
  ) {}

  protected abstract getEntityName(): string;

  async findAll(pagination?: PaginationParams, sort?: SortParams): Promise<T[]> {
    try {
      this.logger.debug('Finding all entities', { pagination, sort });
      const entities = await this.repository.findAll(pagination, sort);
      this.logger.debug('Found entities', { count: entities.length });
      return entities;
    } catch (error) {
      this.logger.error('Failed to find all entities', { error });
      throw error;
    }
  }

  async findById(id: string): Promise<T> {
    try {
      this.logger.debug('Finding entity by ID', { id });
      const entity = await this.repository.findById(id);
      
      if (!entity) {
        throw new NotFoundError(this.getEntityName(), id);
      }
      
      this.logger.debug('Entity found', { id });
      return entity;
    } catch (error) {
      this.logger.error('Failed to find entity by ID', { id, error });
      throw error;
    }
  }

  async create(data: TCreate): Promise<T> {
    try {
      this.logger.debug('Creating entity', { data });
      await this.validateCreate(data);
      
      const entity = await this.repository.create(data);
      this.logger.info('Entity created', { id: entity.id });
      
      await this.afterCreate(entity);
      return entity;
    } catch (error) {
      this.logger.error('Failed to create entity', { data, error });
      throw error;
    }
  }

  async update(id: string, data: TUpdate): Promise<T> {
    try {
      this.logger.debug('Updating entity', { id, data });
      await this.validateUpdate(id, data);
      
      const entity = await this.repository.update(id, data);
      this.logger.info('Entity updated', { id });
      
      await this.afterUpdate(entity);
      return entity;
    } catch (error) {
      this.logger.error('Failed to update entity', { id, data, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.logger.debug('Deleting entity', { id });
      await this.validateDelete(id);
      
      const deleted = await this.repository.delete(id);
      if (!deleted) {
        throw new NotFoundError(this.getEntityName(), id);
      }
      
      this.logger.info('Entity deleted', { id });
      await this.afterDelete(id);
    } catch (error) {
      this.logger.error('Failed to delete entity', { id, error });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      return await this.repository.exists(id);
    } catch (error) {
      this.logger.error('Failed to check entity existence', { id, error });
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      const count = await this.repository.count();
      this.logger.debug('Entity count retrieved', { count });
      return count;
    } catch (error) {
      this.logger.error('Failed to count entities', { error });
      throw error;
    }
  }

  // Template methods for subclasses to override
  protected async validateCreate(data: TCreate): Promise<void> {
    // Override in subclasses for specific validation
  }

  protected async validateUpdate(id: string, data: TUpdate): Promise<void> {
    // Override in subclasses for specific validation
  }

  protected async validateDelete(id: string): Promise<void> {
    // Override in subclasses for specific validation
  }

  protected async afterCreate(entity: T): Promise<void> {
    // Override in subclasses for post-creation logic
  }

  protected async afterUpdate(entity: T): Promise<void> {
    // Override in subclasses for post-update logic
  }

  protected async afterDelete(id: string): Promise<void> {
    // Override in subclasses for post-deletion logic
  }

  // Utility methods
  protected async ensureExists(id: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundError(this.getEntityName(), id);
    }
    return entity;
  }

  protected async ensureNotExists(id: string): Promise<void> {
    const exists = await this.repository.exists(id);
    if (exists) {
      throw new Error(`${this.getEntityName()} with id ${id} already exists`);
    }
  }
}