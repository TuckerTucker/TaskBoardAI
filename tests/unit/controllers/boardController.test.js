const boardController = require('../../../server/controllers/boardController');
const Board = require('../../../server/models/Board');
const config = require('../../../server/config/config');

// Mock the Board model
jest.mock('../../../server/models/Board', () => {
  return {
    load: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    // Constructor mock
    mockImplementation: jest.fn(),
    // For prototype methods
    prototype: {
      validate: jest.fn(),
      save: jest.fn()
    }
  };
});

describe('Board Controller', () => {
  let mockRequest;
  let mockResponse;
  
  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    jest.clearAllMocks();
  });
  
  describe('getBoardInfo', () => {
    it('should return board file configuration', () => {
      boardController.getBoardInfo(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        boardFile: config.boardFile,
        fullPath: config.dataFile
      });
    });
  });
  
  describe('getBoard', () => {
    it('should return the default board data', async () => {
      const mockBoardData = { 
        id: 'default',
        projectName: 'Default Board',
        columns: []
      };
      
      Board.load.mockResolvedValueOnce({
        data: mockBoardData
      });
      
      await boardController.getBoard(mockRequest, mockResponse);
      
      expect(Board.load).toHaveBeenCalledWith();
      expect(mockResponse.json).toHaveBeenCalledWith(mockBoardData);
    });
    
    it('should handle errors and return a 500 status', async () => {
      Board.load.mockRejectedValueOnce(new Error('Test error'));
      
      await boardController.getBoard(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Failed to read board data' 
      });
    });
  });
  
  describe('getBoardById', () => {
    it('should return a specific board by ID', async () => {
      mockRequest.params = { id: 'board123' };
      
      const mockBoardData = { 
        id: 'board123',
        projectName: 'Test Board',
        columns: []
      };
      
      Board.load.mockResolvedValueOnce({
        data: mockBoardData
      });
      
      await boardController.getBoardById(mockRequest, mockResponse);
      
      expect(Board.load).toHaveBeenCalledWith('board123');
      expect(mockResponse.json).toHaveBeenCalledWith(mockBoardData);
    });
    
    it('should return 404 when board is not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      
      Board.load.mockRejectedValueOnce(new Error('Board not found'));
      
      await boardController.getBoardById(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Board not found'
      });
    });
  });
  
  describe('getBoards', () => {
    it('should return a list of all boards', async () => {
      const mockBoards = [
        { id: 'board1', name: 'Board 1', lastUpdated: '2023-01-01' },
        { id: 'board2', name: 'Board 2', lastUpdated: '2023-01-02' }
      ];
      
      Board.list.mockResolvedValueOnce(mockBoards);
      
      await boardController.getBoards(mockRequest, mockResponse);
      
      expect(Board.list).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(mockBoards);
    });
    
    it('should handle errors and return a 500 status', async () => {
      Board.list.mockRejectedValueOnce(new Error('Test error'));
      
      await boardController.getBoards(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to list boards'
      });
    });
  });
  
  describe('createBoard', () => {
    it('should create a new board with valid name', async () => {
      mockRequest.body = { name: 'New Board' };
      
      const mockBoard = {
        id: 'new-board-id',
        name: 'New Board',
        lastUpdated: '2023-01-01'
      };
      
      Board.create.mockResolvedValueOnce(mockBoard);
      
      await boardController.createBoard(mockRequest, mockResponse);
      
      expect(Board.create).toHaveBeenCalledWith('New Board');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockBoard);
    });
    
    it('should return 400 for invalid board name', async () => {
      mockRequest.body = { name: '' };
      
      await boardController.createBoard(mockRequest, mockResponse);
      
      expect(Board.create).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Board name is required'
      });
    });
  });
  
  describe('updateBoard', () => {
    it('should update a board with valid data', async () => {
      const mockBoardData = {
        id: 'board123',
        projectName: 'Updated Board',
        columns: []
      };
      
      mockRequest.body = mockBoardData;
      
      // Setup for this specific test
      const mockBoard = {
        data: mockBoardData,
        validate: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(undefined)
      };
      
      // Replace the actual Board constructor
      const originalBoard = require('../../../server/models/Board');
      jest.mock('../../../server/models/Board', () => {
        return jest.fn().mockImplementation(() => mockBoard);
      });
      
      // Re-require to use the new mock
      const boardControllerFresh = require('../../../server/controllers/boardController');
      
      await boardControllerFresh.updateBoard(mockRequest, mockResponse);
      
      expect(mockBoard.validate).toHaveBeenCalled();
      expect(mockBoard.save).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
      
      // Restore the original mock
      jest.mock('../../../server/models/Board', () => originalBoard);
    });
    
    it('should return 400 for invalid board data', async () => {
      mockRequest.body = { invalidData: true };
      
      // Setup for this specific test
      const mockBoard = {
        data: mockRequest.body,
        validate: jest.fn().mockReturnValue(false),
        save: jest.fn()
      };
      
      // Replace the actual Board constructor
      const originalBoard = require('../../../server/models/Board');
      jest.mock('../../../server/models/Board', () => {
        return jest.fn().mockImplementation(() => mockBoard);
      });
      
      // Re-require to use the new mock
      const boardControllerFresh = require('../../../server/controllers/boardController');
      
      await boardControllerFresh.updateBoard(mockRequest, mockResponse);
      
      expect(mockBoard.validate).toHaveBeenCalled();
      expect(mockBoard.save).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid board data format'
      });
      
      // Restore the original mock
      jest.mock('../../../server/models/Board', () => originalBoard);
    });
  });
  
  describe('deleteBoard', () => {
    it('should delete a board by ID', async () => {
      mockRequest.params = { id: 'board123' };
      
      const mockResult = { success: true, message: 'Board deleted successfully' };
      Board.delete.mockResolvedValueOnce(mockResult);
      
      await boardController.deleteBoard(mockRequest, mockResponse);
      
      expect(Board.delete).toHaveBeenCalledWith('board123');
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });
    
    it('should return 404 when board does not exist', async () => {
      mockRequest.params = { id: 'nonexistent' };
      
      Board.delete.mockRejectedValueOnce(new Error('Board not found'));
      
      await boardController.deleteBoard(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Board not found'
      });
    });
  });
});