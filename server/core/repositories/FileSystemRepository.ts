import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { IFileSystemRepository } from './interfaces';
import { logger } from '@core/utils';
import { InternalServerError } from '@core/errors';

export class FileSystemRepository implements IFileSystemRepository {
  private logger = logger.child({ repository: 'FileSystemRepository' });

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async read<T>(path: string): Promise<T> {
    try {
      this.logger.debug('Reading file', { path });
      const data = await fs.readFile(path, 'utf-8');
      const parsed = JSON.parse(data);
      this.logger.debug('File read successfully', { path, size: data.length });
      return parsed;
    } catch (error) {
      this.logger.error('Failed to read file', { path, error });
      if (error instanceof SyntaxError) {
        throw new InternalServerError(`Invalid JSON in file: ${path}`, error);
      }
      throw new InternalServerError(`Failed to read file: ${path}`, error);
    }
  }

  async write<T>(path: string, data: T): Promise<void> {
    try {
      this.logger.debug('Writing file', { path });
      
      // Ensure directory exists
      const dir = dirname(path);
      await this.createDirectory(dir);
      
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(path, jsonData, 'utf-8');
      
      this.logger.debug('File written successfully', { path, size: jsonData.length });
    } catch (error) {
      this.logger.error('Failed to write file', { path, error });
      throw new InternalServerError(`Failed to write file: ${path}`, error);
    }
  }

  async delete(path: string): Promise<boolean> {
    try {
      this.logger.debug('Deleting file', { path });
      await fs.unlink(path);
      this.logger.debug('File deleted successfully', { path });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete file', { path, error });
      return false;
    }
  }

  async list(directory: string): Promise<string[]> {
    try {
      this.logger.debug('Listing directory', { directory });
      
      const exists = await this.exists(directory);
      if (!exists) {
        this.logger.debug('Directory does not exist', { directory });
        return [];
      }

      const files = await fs.readdir(directory);
      this.logger.debug('Directory listed successfully', { directory, count: files.length });
      return files;
    } catch (error) {
      this.logger.error('Failed to list directory', { directory, error });
      throw new InternalServerError(`Failed to list directory: ${directory}`, error);
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      this.logger.debug('Creating directory', { path });
      await fs.mkdir(path, { recursive: true });
      this.logger.debug('Directory created successfully', { path });
    } catch (error) {
      this.logger.error('Failed to create directory', { path, error });
      throw new InternalServerError(`Failed to create directory: ${path}`, error);
    }
  }

  async backup(sourcePath: string, backupPath: string): Promise<void> {
    try {
      this.logger.debug('Creating backup', { sourcePath, backupPath });
      
      const exists = await this.exists(sourcePath);
      if (!exists) {
        throw new InternalServerError(`Source file does not exist: ${sourcePath}`);
      }

      // Ensure backup directory exists
      const backupDir = dirname(backupPath);
      await this.createDirectory(backupDir);

      // Copy file
      await fs.copyFile(sourcePath, backupPath);
      
      this.logger.info('Backup created successfully', { sourcePath, backupPath });
    } catch (error) {
      this.logger.error('Failed to create backup', { sourcePath, backupPath, error });
      throw new InternalServerError(`Failed to create backup from ${sourcePath} to ${backupPath}`, error);
    }
  }

  async getStats(path: string): Promise<{ size: number; modified: Date; created: Date }> {
    try {
      const stats = await fs.stat(path);
      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    } catch (error) {
      this.logger.error('Failed to get file stats', { path, error });
      throw new InternalServerError(`Failed to get stats for: ${path}`, error);
    }
  }

  async ensureFileExists(path: string, defaultContent: any = {}): Promise<void> {
    const exists = await this.exists(path);
    if (!exists) {
      await this.write(path, defaultContent);
      this.logger.info('Default file created', { path });
    }
  }
}