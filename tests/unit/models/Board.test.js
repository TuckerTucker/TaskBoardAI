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
      readFile: jest.fn(() => Promise.resolve('')),
      writeFile: jest.fn(() => Promise.resolve()),
      mkdir: jest.fn(() => Promise.resolve()),
      readdir: jest.fn(() => Promise.resolve([])),
      access: jest.fn(() => Promise.resolve()),
      unlink: jest.fn(() => Promise.resolve()),
      mock: {
        calls: []
      }
    }
  };
});

// Setup mocks for each test
beforeEach(() => {
  // Setup fs.readFile to be mockable with mockResolvedValueOnce
  const fs = require('node:fs').promises;
  fs.readFile.mockResolvedValue = jest.fn((value) => {
    return fs.readFile.mockImplementationOnce(() => Promise.resolve(value));
  });
  fs.readFile.mockRejectedValue = jest.fn((err) => {
    return fs.readFile.mockImplementationOnce(() => Promise.reject(err));
  });
  fs.readFile.mockResolvedValueOnce = fs.readFile.mockResolvedValue;
  fs.readFile.mockRejectedValueOnce = fs.readFile.mockRejectedValue;
  
  // Setup fs.writeFile to capture calls
  fs.writeFile.mock = { calls: [] };
  const originalWrite = fs.writeFile;
  fs.writeFile = jest.fn((path, content) => {
    fs.writeFile.mock.calls.push([path, content]);
    return Promise.resolve();
  });
  fs.writeFile.mockResolvedValueOnce = jest.fn(() => Promise.resolve());
  
  // Setup fs.readdir
  fs.readdir.mockResolvedValueOnce = jest.fn((value) => {
    return fs.readdir.mockImplementationOnce(() => Promise.resolve(value));
  });
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
    it('should return true for valid board data with card-first architecture', () => {
      const board = new Board({
        projectName: 'Valid Board',
        columns: [
          {
            id: 'col1',
            name: 'To Do'
          }
        ],
        cards: [
          {
            id: 'card1',
            title: 'Task 1',
            columnId: 'col1',
            position: 0
          }
        ]
      });
      
      expect(board.validate()).toBe(true);
    });

    it('should return true for valid legacy board data', () => {
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
    it('should return true for valid items in card-first architecture', () => {
      const validItem = {
        id: 'card1',
        title: 'Task 1',
        content: 'Description',
        columnId: 'col1',
        position: 0,
        collapsed: true,
        subtasks: ['Subtask 1'],
        tags: ['Tag 1'],
        dependencies: ['card2'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      };
      
      expect(Board.validateItem(validItem)).toBe(true);
    });
    
    it('should return true for valid items in legacy architecture', () => {
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
    
    it('should handle items in "Done" column by adding completed_at timestamps in legacy format', async () => {
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
    
    it('should handle cards in "Done" column by adding completed_at timestamps in card-first architecture', async () => {
      const board = new Board({
        id: '123',
        projectName: 'Test Board',
        columns: [
          {
            id: 'done-col',
            name: 'Done'
          }
        ],
        cards: [
          { 
            id: 'card1', 
            title: 'Task 1',
            columnId: 'done-col',
            position: 0
          }
        ]
      });
      
      await board.save();
      
      expect(board.data.cards[0].completed_at).toBeDefined();
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

  describe('format', () => {
    // Test data for format tests
    const testBoardData = {
      id: 'test-board',
      projectName: 'Test Board',
      last_updated: '2025-03-14T10:00:00.000Z',
      columns: [
        { id: 'backlog', name: 'Backlog' },
        { id: 'in-progress', name: 'In Progress' },
        { id: 'done', name: 'Done' }
      ],
      cards: [
        {
          id: 'card1',
          title: 'Task 1',
          content: 'Description for task 1',
          columnId: 'backlog',
          position: 0,
          collapsed: false,
          subtasks: ['Subtask 1', 'Subtask 2'],
          tags: ['backend'],
          dependencies: [],
          created_at: '2025-03-14T09:00:00.000Z',
          updated_at: '2025-03-14T09:30:00.000Z',
          completed_at: null
        },
        {
          id: 'card2',
          title: 'Task 2',
          content: 'Description for task 2',
          columnId: 'in-progress',
          position: 0,
          collapsed: true,
          subtasks: ['Subtask 1'],
          tags: ['frontend'],
          dependencies: ['card1'],
          created_at: '2025-03-14T09:15:00.000Z',
          updated_at: '2025-03-14T09:45:00.000Z',
          completed_at: null
        },
        {
          id: 'card3',
          title: 'Task 3',
          content: 'Description for task 3',
          columnId: 'done',
          position: 0,
          collapsed: false,
          subtasks: [],
          tags: ['backend'],
          dependencies: [],
          created_at: '2025-03-14T08:00:00.000Z',
          updated_at: '2025-03-14T08:30:00.000Z',
          completed_at: '2025-03-14T09:00:00.000Z'
        }
      ]
    };

    it('should return full board data when using full format', () => {
      const board = new Board(testBoardData);
      const result = board.format('full');
      
      expect(result).toEqual(testBoardData);
    });

    it('should return full board data when using default (no format specified)', () => {
      const board = new Board(testBoardData);
      const result = board.format();
      
      expect(result).toEqual(testBoardData);
    });

    it('should return summary format with column stats', () => {
      const board = new Board(testBoardData);
      const result = board.format('summary');
      
      expect(result).toHaveProperty('id', 'test-board');
      expect(result).toHaveProperty('projectName', 'Test Board');
      expect(result).toHaveProperty('last_updated');
      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('stats');
      
      // Check column structure in summary
      expect(result.columns).toHaveLength(3);
      expect(result.columns[0]).toHaveProperty('id', 'backlog');
      expect(result.columns[0]).toHaveProperty('name', 'Backlog');
      expect(result.columns[0]).toHaveProperty('cardCount', 1);
      
      // Check stats
      expect(result.stats).toHaveProperty('totalCards', 3);
      expect(result.stats).toHaveProperty('completedCards', 1);
      expect(result.stats).toHaveProperty('progressPercentage', 33);
    });

    it('should return compact format with shortened property names', () => {
      const board = new Board(testBoardData);
      const result = board.format('compact');
      
      expect(result).toHaveProperty('id', 'test-board');
      expect(result).toHaveProperty('name', 'Test Board');
      expect(result).toHaveProperty('up');
      expect(result).toHaveProperty('cols');
      expect(result).toHaveProperty('cards');
      
      // Check compact column structure
      expect(result.cols).toHaveLength(3);
      expect(result.cols[0]).toHaveProperty('id', 'backlog');
      expect(result.cols[0]).toHaveProperty('n', 'Backlog');
      
      // Check compact card structure
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0]).toHaveProperty('id', 'card1');
      expect(result.cards[0]).toHaveProperty('t', 'Task 1');
      expect(result.cards[0]).toHaveProperty('col', 'backlog');
      expect(result.cards[0]).toHaveProperty('p', 0);
      expect(result.cards[0]).toHaveProperty('c', 'Description for task 1');
      expect(result.cards[0]).toHaveProperty('sub');
      expect(result.cards[0]).toHaveProperty('tag');
    });

    it('should return cards-only format', () => {
      const board = new Board(testBoardData);
      const result = board.format('cards-only');
      
      expect(result).toHaveProperty('cards');
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0]).toHaveProperty('id', 'card1');
      expect(result.cards[0]).toHaveProperty('title', 'Task 1');
      expect(result.cards[0]).toHaveProperty('columnId', 'backlog');
      
      // Should not have board metadata
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('projectName');
      expect(result).not.toHaveProperty('columns');
    });

    it('should filter cards by column when using cards-only format with columnId option', () => {
      const board = new Board(testBoardData);
      const result = board.format('cards-only', { columnId: 'backlog' });
      
      expect(result).toHaveProperty('cards');
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]).toHaveProperty('id', 'card1');
      expect(result.cards[0]).toHaveProperty('columnId', 'backlog');
    });
  });
});