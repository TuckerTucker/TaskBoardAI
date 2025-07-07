import { BaseService } from './BaseService';
import { IConfigService, IValidationService } from './interfaces';
import { IConfigRepository } from '@core/repositories';
import { Config } from '@core/schemas';

export class ConfigService extends BaseService<Config, Partial<Config>, Partial<Config>> implements IConfigService {
  
  constructor(
    repository: IConfigRepository,
    private validationService: IValidationService
  ) {
    super(repository);
  }

  protected getEntityName(): string {
    return 'Config';
  }

  private get configRepository(): IConfigRepository {
    return this.repository as IConfigRepository;
  }

  protected async validateCreate(data: Partial<Config>): Promise<void> {
    if (Object.keys(data).length > 0) {
      // Validate partial config data
      this.validationService.validateConfig({
        server: { port: 3001, host: 'localhost', enableCors: true, corsOrigins: ['*'], rateLimit: { windowMs: 900000, maxRequests: 100 } },
        defaults: { board: { columns: ['To Do', 'In Progress', 'Done'], settings: { allowWipLimitExceeding: false, showCardCount: true, enableDragDrop: true, theme: 'light' } } },
        ...data
      });
    }
  }

  protected async validateUpdate(id: string, data: Partial<Config>): Promise<void> {
    // Get current config and merge with updates for validation
    const current = await this.getDefault();
    const merged = {
      ...current,
      ...data,
      server: data.server ? { ...current.server, ...data.server } : current.server,
      defaults: data.defaults ? {
        ...current.defaults,
        ...data.defaults,
        board: data.defaults.board ? {
          ...current.defaults.board,
          ...data.defaults.board,
          settings: data.defaults.board.settings ? {
            ...current.defaults.board.settings,
            ...data.defaults.board.settings
          } : current.defaults.board.settings
        } : current.defaults.board
      } : current.defaults
    };
    
    this.validationService.validateConfig(merged);
  }

  async getDefault(): Promise<Config> {
    try {
      this.logger.debug('Getting default config');
      const config = await this.configRepository.getDefault();
      this.logger.debug('Default config retrieved');
      return config;
    } catch (error) {
      this.logger.error('Failed to get default config', { error });
      throw error;
    }
  }

  async updateServerConfig(updates: Partial<Config['server']>): Promise<Config> {
    try {
      this.logger.debug('Updating server config', { updates });
      
      // Validate the updates by merging with current config
      const current = await this.getDefault();
      const mergedServer = { ...current.server, ...updates };
      const testConfig = { ...current, server: mergedServer };
      this.validationService.validateConfig(testConfig);
      
      const config = await this.configRepository.updateServerConfig(updates);
      this.logger.info('Server config updated', { updates: Object.keys(updates) });
      
      return config;
    } catch (error) {
      this.logger.error('Failed to update server config', { updates, error });
      throw error;
    }
  }

  async updateDefaultsConfig(updates: Partial<Config['defaults']>): Promise<Config> {
    try {
      this.logger.debug('Updating defaults config', { updates });
      
      // Validate the updates by merging with current config
      const current = await this.getDefault();
      const mergedDefaults = {
        ...current.defaults,
        ...updates,
        board: updates.board ? {
          ...current.defaults.board,
          ...updates.board,
          settings: updates.board.settings ? {
            ...current.defaults.board.settings,
            ...updates.board.settings
          } : current.defaults.board.settings
        } : current.defaults.board
      };
      const testConfig = { ...current, defaults: mergedDefaults };
      this.validationService.validateConfig(testConfig);
      
      const config = await this.configRepository.updateDefaultsConfig(updates);
      this.logger.info('Defaults config updated', { updates: Object.keys(updates) });
      
      return config;
    } catch (error) {
      this.logger.error('Failed to update defaults config', { updates, error });
      throw error;
    }
  }

  async reset(): Promise<Config> {
    try {
      this.logger.debug('Resetting config to defaults');
      const config = await this.configRepository.reset();
      this.logger.info('Config reset to defaults');
      return config;
    } catch (error) {
      this.logger.error('Failed to reset config', { error });
      throw error;
    }
  }

  validateConfig(config: unknown): Config {
    return this.validationService.validateConfig(config);
  }

  // Override base methods to work with singleton config
  async findAll(): Promise<Config[]> {
    const config = await this.getDefault();
    return [config];
  }

  async findById(id: string): Promise<Config> {
    // Config is a singleton, so any ID returns the default config
    return await this.getDefault();
  }

  async create(data: Partial<Config>): Promise<Config> {
    try {
      this.logger.debug('Creating config', { data });
      await this.validateCreate(data);
      
      const config = await this.configRepository.create(data);
      this.logger.info('Config created');
      
      return config;
    } catch (error) {
      this.logger.error('Failed to create config', { data, error });
      throw error;
    }
  }

  async update(id: string, data: Partial<Config>): Promise<Config> {
    try {
      this.logger.debug('Updating config', { id, data });
      await this.validateUpdate(id, data);
      
      const config = await this.configRepository.update(id, data);
      this.logger.info('Config updated');
      
      return config;
    } catch (error) {
      this.logger.error('Failed to update config', { id, data, error });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      this.logger.debug('Deleting config (resetting to defaults)', { id });
      await this.reset();
      this.logger.info('Config deleted (reset to defaults)');
    } catch (error) {
      this.logger.error('Failed to delete config', { id, error });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    // Config always exists (singleton pattern)
    return true;
  }

  async count(): Promise<number> {
    // Config is always a singleton
    return 1;
  }

  // Additional utility methods
  async getServerPort(): Promise<number> {
    const config = await this.getDefault();
    return config.server.port;
  }

  async getServerHost(): Promise<string> {
    const config = await this.getDefault();
    return config.server.host;
  }

  async isCorsEnabled(): Promise<boolean> {
    const config = await this.getDefault();
    return config.server.enableCors;
  }

  async getCorsOrigins(): Promise<string[]> {
    const config = await this.getDefault();
    return config.server.corsOrigins;
  }

  async getRateLimitConfig(): Promise<{ windowMs: number; maxRequests: number }> {
    const config = await this.getDefault();
    return config.server.rateLimit;
  }

  async getDefaultColumns(): Promise<string[]> {
    const config = await this.getDefault();
    return config.defaults.board.columns;
  }

  async getDefaultBoardSettings(): Promise<Config['defaults']['board']['settings']> {
    const config = await this.getDefault();
    return config.defaults.board.settings;
  }
}