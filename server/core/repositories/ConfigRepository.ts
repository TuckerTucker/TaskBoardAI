import { join } from 'path';
import { BaseRepository } from './BaseRepository';
import { IConfigRepository } from './interfaces';
import { Config, CreateBoard, UpdateBoard } from '@core/schemas';
import { EntityFactory, createSafeParser, ConfigSchema } from '@core/schemas';
import { DEFAULT_SERVER_CONFIG, DEFAULT_BOARD_SETTINGS, DEFAULT_COLUMNS } from '@core/schemas';
import { NotFoundError } from '@core/errors';

export class ConfigRepository extends BaseRepository<Config, Partial<Config>, Partial<Config>> implements IConfigRepository {
  private readonly CONFIG_FILE = 'config.json';
  
  constructor(fileSystem: any, basePath: string = 'config') {
    super(fileSystem, basePath);
  }

  protected getFilePath(id?: string): string {
    return join(this.basePath, this.CONFIG_FILE);
  }

  protected async validateCreate(data: Partial<Config>): Promise<void> {
    if (data) {
      const parseConfig = createSafeParser(ConfigSchema.partial());
      parseConfig(data);
    }
  }

  protected async validateUpdate(data: Partial<Config>): Promise<void> {
    const parseConfig = createSafeParser(ConfigSchema.partial());
    parseConfig(data);
  }

  protected async createEntity(data: Partial<Config>): Promise<Config> {
    await this.ensureDirectoryExists();
    return this.createDefaultConfig(data);
  }

  protected async updateEntity(existing: Config, updates: Partial<Config>): Promise<Config> {
    return {
      ...existing,
      ...updates,
      server: updates.server ? { ...existing.server, ...updates.server } : existing.server,
      defaults: updates.defaults ? {
        ...existing.defaults,
        board: updates.defaults.board ? {
          ...existing.defaults.board,
          ...updates.defaults.board,
          settings: updates.defaults.board.settings ? {
            ...existing.defaults.board.settings,
            ...updates.defaults.board.settings
          } : existing.defaults.board.settings
        } : existing.defaults.board
      } : existing.defaults
    };
  }

  private createDefaultConfig(overrides: Partial<Config> = {}): Config {
    return {
      server: {
        ...DEFAULT_SERVER_CONFIG,
        ...overrides.server
      },
      defaults: {
        board: {
          columns: [...DEFAULT_COLUMNS],
          settings: { ...DEFAULT_BOARD_SETTINGS }
        },
        ...overrides.defaults
      }
    };
  }

  async getDefault(): Promise<Config> {
    try {
      await this.ensureDirectoryExists();
      
      const configPath = this.getFilePath();
      const exists = await this.fileSystem.exists(configPath);
      
      if (!exists) {
        // Create default config file
        const defaultConfig = this.createDefaultConfig();
        await this.fileSystem.write(configPath, defaultConfig);
        this.logger.info('Default config file created');
        return defaultConfig;
      }

      const config = await this.fileSystem.read<Config>(configPath);
      
      // Validate and merge with defaults to ensure all fields are present
      const parseConfig = createSafeParser(ConfigSchema);
      return parseConfig(config);
    } catch (error) {
      this.logger.error('Failed to get default config', { error });
      throw error;
    }
  }

  async updateServerConfig(updates: Partial<Config['server']>): Promise<Config> {
    try {
      const config = await this.getDefault();
      const updatedConfig = {
        ...config,
        server: {
          ...config.server,
          ...updates
        }
      };

      const configPath = this.getFilePath();
      await this.fileSystem.write(configPath, updatedConfig);
      
      this.logger.info('Server config updated', { updates: Object.keys(updates) });
      return updatedConfig;
    } catch (error) {
      this.logger.error('Failed to update server config', { updates, error });
      throw error;
    }
  }

  async updateDefaultsConfig(updates: Partial<Config['defaults']>): Promise<Config> {
    try {
      const config = await this.getDefault();
      const updatedDefaults = {
        ...config.defaults,
        ...updates,
        board: updates.board ? {
          ...config.defaults.board,
          ...updates.board,
          settings: updates.board.settings ? {
            ...config.defaults.board.settings,
            ...updates.board.settings
          } : config.defaults.board.settings
        } : config.defaults.board
      };

      const updatedConfig = {
        ...config,
        defaults: updatedDefaults
      };

      const configPath = this.getFilePath();
      await this.fileSystem.write(configPath, updatedConfig);
      
      this.logger.info('Defaults config updated', { updates: Object.keys(updates) });
      return updatedConfig;
    } catch (error) {
      this.logger.error('Failed to update defaults config', { updates, error });
      throw error;
    }
  }

  async reset(): Promise<Config> {
    try {
      const defaultConfig = this.createDefaultConfig();
      const configPath = this.getFilePath();
      
      // Create backup before reset
      const backupPath = join(this.basePath, `config.backup.${Date.now()}.json`);
      const exists = await this.fileSystem.exists(configPath);
      if (exists) {
        await this.fileSystem.backup(configPath, backupPath);
      }

      await this.fileSystem.write(configPath, defaultConfig);
      
      this.logger.info('Config reset to defaults', { backupPath });
      return defaultConfig;
    } catch (error) {
      this.logger.error('Failed to reset config', { error });
      throw error;
    }
  }

  // Override base methods to work with singleton config file
  async findAll(): Promise<Config[]> {
    const config = await this.getDefault();
    return [config];
  }

  async findById(id: string): Promise<Config | null> {
    // Config is a singleton, so any valid ID returns the config
    return await this.getDefault();
  }

  async create(data: Partial<Config>): Promise<Config> {
    // For config, create means reset with provided data
    const defaultConfig = this.createDefaultConfig(data);
    const configPath = this.getFilePath();
    
    await this.ensureDirectoryExists();
    await this.fileSystem.write(configPath, defaultConfig);
    
    this.logger.info('Config created');
    return defaultConfig;
  }

  async update(id: string, data: Partial<Config>): Promise<Config> {
    const existing = await this.getDefault();
    const updated = await this.updateEntity(existing, data);
    
    const configPath = this.getFilePath();
    await this.fileSystem.write(configPath, updated);
    
    this.logger.info('Config updated');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    // Config cannot be deleted, only reset
    await this.reset();
    return true;
  }

  async exists(id: string): Promise<boolean> {
    const configPath = this.getFilePath();
    return await this.fileSystem.exists(configPath);
  }

  async count(): Promise<number> {
    return 1; // Config is always a singleton
  }
}