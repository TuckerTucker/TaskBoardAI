const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../../../server/config/config');
const { 
  ensureDir, 
  ensureBoardsDir, 
  ensureConfigDir, 
  ensureWebhooksDir 
} = require('../../../server/utils/fileSystem');

// Mock the fs module
jest.mock('node:fs', () => {
  return {
    promises: {
      mkdir: jest.fn().mockImplementation(() => Promise.resolve())
    }
  };
});

describe('FileSystem Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', async () => {
      fs.mkdir.mockResolvedValueOnce(undefined);
      
      await ensureDir('/test/dir');
      
      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should ignore EEXIST error', async () => {
      const error = new Error('Directory exists');
      error.code = 'EEXIST';
      fs.mkdir.mockRejectedValueOnce(error);
      
      await expect(ensureDir('/test/dir')).resolves.not.toThrow();
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EPERM';
      fs.mkdir.mockRejectedValueOnce(error);
      
      await expect(ensureDir('/test/dir')).rejects.toThrow('Permission denied');
    });
  });

  describe('ensureBoardsDir', () => {
    it('should call ensureDir with the correct path when dataFile is not absolute', async () => {
      const original = { ...config };
      Object.defineProperty(config, 'dataFile', { value: 'relative/path.json' });
      
      fs.mkdir.mockResolvedValueOnce(undefined);
      
      await ensureBoardsDir();
      
      expect(fs.mkdir).toHaveBeenCalledWith(config.boardsDir, { recursive: true });
      
      // Restore original config
      Object.assign(config, original);
    });

    it('should call ensureDir with dirname of dataFile when dataFile is absolute', async () => {
      const original = { ...config };
      Object.defineProperty(config, 'dataFile', { value: '/absolute/path/file.json' });
      
      fs.mkdir.mockResolvedValueOnce(undefined);
      
      await ensureBoardsDir();
      
      expect(fs.mkdir).toHaveBeenCalledWith('/absolute/path', { recursive: true });
      
      // Restore original config
      Object.assign(config, original);
    });
  });

  describe('ensureConfigDir', () => {
    it('should call ensureDir with the correct path', async () => {
      fs.mkdir.mockResolvedValueOnce(undefined);
      
      await ensureConfigDir();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('config'),
        { recursive: true }
      );
    });
  });

  describe('ensureWebhooksDir', () => {
    it('should call ensureDir with the webhooks directory path', async () => {
      fs.mkdir.mockResolvedValueOnce(undefined);
      
      await ensureWebhooksDir();
      
      expect(fs.mkdir).toHaveBeenCalledWith(config.webhooksDir, { recursive: true });
    });
  });
});