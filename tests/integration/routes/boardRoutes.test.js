const request = require('supertest');
const express = require('express');
const boardRoutes = require('../../../server/routes/boardRoutes');
const boardController = require('../../../server/controllers/boardController');

// Mock the boardController
jest.mock('../../../server/controllers/boardController', () => ({
  getBoardInfo: jest.fn((req, res) => res.json({ message: 'board info mock' })),
  getBoard: jest.fn((req, res) => res.json({ message: 'get board mock' })),
  getBoardById: jest.fn((req, res) => res.json({ message: 'get board by id mock', id: req.params.id })),
  getBoards: jest.fn((req, res) => res.json({ message: 'get boards mock' })),
  createBoard: jest.fn((req, res) => res.status(201).json({ message: 'create board mock' })),
  updateBoard: jest.fn((req, res) => res.json({ message: 'update board mock' })),
  deleteBoard: jest.fn((req, res) => res.json({ message: 'delete board mock', id: req.params.id })),
  importBoard: jest.fn((req, res) => res.status(201).json({ message: 'import board mock' }))
}));

describe('Board Routes', () => {
  let app;
  
  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/boards', boardRoutes);
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('GET /api/boards/info', () => {
    it('should return board info', async () => {
      const response = await request(app)
        .get('/api/boards/info');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('board info mock');
      expect(boardController.getBoardInfo).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/boards', () => {
    it('should return all boards', async () => {
      const response = await request(app)
        .get('/api/boards');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('get boards mock');
      expect(boardController.getBoards).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/boards/default', () => {
    it('should return default board', async () => {
      const response = await request(app)
        .get('/api/boards/default');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('get board mock');
      expect(boardController.getBoard).toHaveBeenCalled();
    });
  });
  
  describe('GET /api/boards/:id', () => {
    it('should return board by id', async () => {
      const response = await request(app)
        .get('/api/boards/board123');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('get board by id mock');
      expect(response.body.id).toBe('board123');
      expect(boardController.getBoardById).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/boards', () => {
    it('should create a new board', async () => {
      const response = await request(app)
        .post('/api/boards')
        .send({ name: 'New Test Board' });
      
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('create board mock');
      expect(boardController.createBoard).toHaveBeenCalled();
      expect(boardController.createBoard.mock.calls[0][0].body.name).toBe('New Test Board');
    });
  });
  
  describe('PUT /api/boards', () => {
    it('should update a board', async () => {
      const boardData = {
        id: 'board123',
        projectName: 'Updated Board',
        columns: []
      };
      
      const response = await request(app)
        .put('/api/boards')
        .send(boardData);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('update board mock');
      expect(boardController.updateBoard).toHaveBeenCalled();
      expect(boardController.updateBoard.mock.calls[0][0].body).toEqual(boardData);
    });
  });
  
  describe('DELETE /api/boards/:id', () => {
    it('should delete a board', async () => {
      const response = await request(app)
        .delete('/api/boards/board123');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('delete board mock');
      expect(response.body.id).toBe('board123');
      expect(boardController.deleteBoard).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/boards/import', () => {
    it('should import a board', async () => {
      const boardData = {
        projectName: 'Imported Board',
        columns: []
      };
      
      const response = await request(app)
        .post('/api/boards/import')
        .send(boardData);
      
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('import board mock');
      expect(boardController.importBoard).toHaveBeenCalled();
      expect(boardController.importBoard.mock.calls[0][0].body).toEqual(boardData);
    });
  });
});