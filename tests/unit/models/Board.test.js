const Board = require('../../../server/models/Board');
const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../../../server/config/config');

// Mock the filesystem module
jest.mock('node:fs', () => {
  const originalModule = jest.requireActual('node:fs');
  return {
    ...originalModule,
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      readdir: jest.fn(),
      access: jest.fn(),
      unlink: jest.fn(),
    }
  };
});

// Mock the fileSystem utility
jest.mock('../../../server/utils/fileSystem', () => ({
  ensureBoardsDir: jest.fn().mockResolvedValue(undefined)
}));

describe('Board Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new board with default values when no data is provided', () => {
      const board = new Board();
      
      expect(board.data).toHaveProperty('id');
      expect(board.data.projectName).toBe('My Kanban Board');
      expect(board.data.columns).toEqual([]);
      expect(board.filePath).toBeNull();
    });

    it('should use provided data and filePath', () => {
      const mockData = { 
        id: '123', 
        projectName: 'Test Board', 
        columns: [{ id: 'col1', name: 'To Do', items: [] }] 
      };
      const mockPath = '/path/to/board.json';
      
      const board = new Board(mockData, mockPath);
      
      expect(board.data).toEqual(mockData);
      expect(board.filePath).toBe(mockPath);
    });
  });

  describe('load', () => {
    it('should load a board from file when boardId is provided', async () => {
      const mockData = { 
        id: '123', 
        projectName: 'Test Board', 
        columns: [{ id: 'col1', name: 'To Do', items: [] }] 
      };
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));
      
      const board = await Board.load('123');
      
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(config.boardsDir, '123.json'),
        'utf8'
      );
      expect(board.data).toEqual(mockData);
    });

    it('should return a new default board if the file does not exist and no boardId is provided', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValueOnce(error);
      fs.writeFile.mockResolvedValueOnce(undefined);
      
      const board = await Board.load();
      
      expect(board.data.projectName).toBe('My Kanban Board');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw an error if the board with specified ID is not found', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValueOnce(error);
      
      await expect(Board.load('nonexistent')).rejects.toThrow('Board with ID nonexistent not found');
    });
  });

  describe('validate', () => {
    it('should return true for valid board data', () => {
      const board = new Board({
        projectName: 'Valid Board',
        columns: [
          {
            id: 'col1',
            name: 'To Do',
            items: [
              {
                id: 'item1',
                title: 'Task 1'
              }
            ]
          }
        ]
      });
      
      expect(board.validate()).toBe(true);
    });
    
    it('should return false for invalid board data', () => {
      const board = new Board({
        // Missing projectName
        columns: 'not an array'
      });
      
      expect(board.validate()).toBe(false);
    });
  });

  describe('validateItem', () => {
    it('should return true for valid items', () => {
      const validItem = {
        id: 'item1',
        title: 'Task 1',
        content: 'Description',
        collapsed: true,
        subtasks: ['Subtask 1'],
        tags: ['Tag 1'],
        dependencies: ['item2'],
        completed_at: new Date().toISOString()
      };
      
      expect(Board.validateItem(validItem)).toBe(true);
    });
    
    it('should return false for items with missing required fields', () => {
      expect(Board.validateItem({})).toBe(false);
      expect(Board.validateItem({ id: 'item1' })).toBe(false);
      expect(Board.validateItem({ title: 'Task 1' })).toBe(false);
    });
    
    it('should return false for items with invalid field types', () => {
      expect(Board.validateItem({ 
        id: 'item1', 
        title: 'Task 1',
        content: 123 // Should be string
      })).toBe(false);
      
      expect(Board.validateItem({ 
        id: 'item1', 
        title: 'Task 1',
        collapsed: 'yes' // Should be boolean
      })).toBe(false);
      
      expect(Board.validateItem({ 
        id: 'item1', 
        title: 'Task 1',
        subtasks: 'not an array' // Should be array
      })).toBe(false);
    });
  });

  describe('save', () => {
    it('should save the board data to file', async () => {
      const board = new Board({
        id: '123',
        projectName: 'Test Board',
        columns: []
      }, '/path/to/board.json');
      
      await board.save();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/board.json',
        expect.any(String)
      );
    });
    
    it('should add last_updated timestamp when saving', async () => {
      const board = new Board({
        id: '123',
        projectName: 'Test Board',
        columns: []
      });
      
      await board.save();
      
      expect(board.data.last_updated).toBeDefined();
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData.last_updated).toBeDefined();
    });
    
    it('should handle items in "Done" column by adding completed_at timestamps', async () => {
      const board = new Board({
        id: '123',
        projectName: 'Test Board',
        columns: [
          {
            id: 'col1',
            name: 'Done',
            items: [
              { id: 'item1', title: 'Task 1' }
            ]
          }
        ]
      });
      
      await board.save();
      
      expect(board.data.columns[0].items[0].completed_at).toBeDefined();
    });
  });

  describe('list', () => {
    it('should return a list of all boards', async () => {
      const mockFiles = ['board1.json', 'board2.json', 'notaboard.txt'];
      fs.readdir.mockResolvedValueOnce(mockFiles);
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        id: 'board1',
        projectName: 'Board 1',
        last_updated: '2023-01-01T00:00:00.000Z'
      }));
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        id: 'board2',
        projectName: 'Board 2',
        last_updated: '2023-01-02T00:00:00.000Z'
      }));
      
      const boards = await Board.list();
      
      expect(boards).toHaveLength(2);
      expect(boards[0].id).toBe('board1');
      expect(boards[1].id).toBe('board2');
    });
    
    it('should skip invalid board files and continue', async () => {
      const mockFiles = ['board1.json', 'invalid.json'];
      fs.readdir.mockResolvedValueOnce(mockFiles);
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        id: 'board1',
        projectName: 'Board 1'
      }));
      
      fs.readFile.mockRejectedValueOnce(new Error('Invalid JSON'));
      
      const boards = await Board.list();
      
      expect(boards).toHaveLength(1);
      expect(boards[0].id).toBe('board1');
    });
  });
});