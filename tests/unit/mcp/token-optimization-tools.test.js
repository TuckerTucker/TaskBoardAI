/**
 * @jest-environment node
 */

// Import handlers from the shared mock
const { handlers } = require('../../mocks/mcp-handlers-mock');

// Load the Board mock
const Board = require('../../mocks/board-mock');

describe('Token-Optimized MCP Tools', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('get-board with format parameter', () => {
    it('should retrieve a board in full format by default', async () => {
      const boardId = 'test-board-id';
      
      // Execute the handler
      const result = await handlers['get-board']({ boardId });
      
      // Verify the result and format parameter
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('full', {});
    });
    
    it('should retrieve a board in summary format when specified', async () => {
      const boardId = 'test-board-id';
      
      // Execute the handler with summary format
      const result = await handlers['get-board']({ 
        boardId, 
        format: 'summary' 
      });
      
      // Verify the result and format parameter
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('summary', {});
    });
    
    it('should retrieve a board in compact format when specified', async () => {
      const boardId = 'test-board-id';
      
      // Execute the handler with compact format
      const result = await handlers['get-board']({ 
        boardId, 
        format: 'compact' 
      });
      
      // Verify the result and format parameter
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('compact', {});
    });
    
    it('should retrieve cards from a specific column when using cards-only format with columnId', async () => {
      const boardId = 'test-board-id';
      const columnId = 'col-1';
      
      // Execute the handler with cards-only format and columnId
      const result = await handlers['get-board']({ 
        boardId, 
        format: 'cards-only',
        columnId
      });
      
      // Verify the result and format parameters
      expect(result.isError).toBeFalsy();
      expect(Board.load).toHaveBeenCalledWith(boardId);
      
      const board = await Board.load(boardId);
      expect(board.format).toHaveBeenCalledWith('cards-only', { columnId });
    });
    
    it('should handle errors when retrieving a board', async () => {
      const boardId = 'invalid-board';
      
      // Execute the handler with an invalid board ID
      const result = await handlers['get-board']({ boardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Error retrieving board');
      expect(Board.load).toHaveBeenCalledWith(boardId);
    });
  });
  
  describe('get-card', () => {
    it('should retrieve a specific card by ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      
      // Execute the handler
      const result = await handlers['get-card']({ boardId, cardId });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned card data
      const returnedCard = JSON.parse(result.content[0].text);
      
      // Check card properties
      expect(returnedCard.id).toBe(cardId);
      expect(returnedCard.title).toBeDefined();
    });
    
    it('should handle non-existent card ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'non-existent';
      
      // Execute the handler with a non-existent card ID
      const result = await handlers['get-card']({ boardId, cardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const cardId = 'item1';
      
      // Execute the handler with a legacy board
      const result = await handlers['get-card']({ boardId, cardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('card-first architecture');
    });
    
    it('should handle board loading errors', async () => {
      const boardId = 'invalid-board';
      const cardId = 'card-1';
      
      // Execute the handler with an invalid board ID
      const result = await handlers['get-card']({ boardId, cardId });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Error retrieving card');
    });
  });
  
  describe('update-card', () => {
    it('should update a card with valid data', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const cardData = JSON.stringify({
        title: 'Updated Card Title',
        content: 'Updated content'
      });
      
      // Execute the handler
      const result = await handlers['update-card']({ boardId, cardId, cardData });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned card data
      const updatedCard = JSON.parse(result.content[0].text);
      
      // Check updated properties
      expect(updatedCard.id).toBe(cardId);
      expect(updatedCard.title).toBe('Updated Card Title');
      expect(updatedCard.content).toBe('Updated content');
      
      // Verify the board was saved
      const board = await Board.load(boardId);
      expect(board.save).toHaveBeenCalled();
    });
    
    it('should handle invalid JSON input', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const cardData = '{ invalid json }';
      
      // Execute the handler with invalid JSON
      const result = await handlers['update-card']({ boardId, cardId, cardData });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Invalid JSON');
    });
    
    it('should reject non-existent card ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'non-existent';
      const cardData = JSON.stringify({ title: 'Updated Title' });
      
      // Execute the handler with a non-existent card ID
      const result = await handlers['update-card']({ boardId, cardId, cardData });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject invalid column ID in card data', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const cardData = JSON.stringify({
        title: 'Updated Card',
        columnId: 'invalid-column'
      });
      
      // Execute the handler with an invalid column ID
      const result = await handlers['update-card']({ boardId, cardId, cardData });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Target column');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const cardId = 'item1';
      const cardData = JSON.stringify({ title: 'Updated Title' });
      
      // Execute the handler with a legacy board
      const result = await handlers['update-card']({ boardId, cardId, cardData });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('card-first architecture');
    });
  });
  
  describe('move-card', () => {
    it('should move a card to a different column with absolute position', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'col-2';
      const position = 0;
      
      // Execute the handler
      const result = await handlers['move-card']({ boardId, cardId, columnId, position });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned data
      const responseData = JSON.parse(result.content[0].text);
      
      // Check updated properties
      expect(responseData.card.id).toBe(cardId);
      expect(responseData.card.columnId).toBe(columnId);
      expect(responseData.card.position).toBe(position);
      
      // Verify the board was saved
      const board = await Board.load(boardId);
      expect(board.save).toHaveBeenCalled();
    });
    
    it('should move a card using relative position "first"', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'col-2';
      const position = 'first';
      
      // Execute the handler
      const result = await handlers['move-card']({ boardId, cardId, columnId, position });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned data
      const responseData = JSON.parse(result.content[0].text);
      
      // Check updated properties
      expect(responseData.card.columnId).toBe(columnId);
      expect(responseData.card.position).toBe(0); // "first" should be position 0
    });
    
    it('should set completed_at when moving to Done column', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'col-3'; // Done column
      const position = 0;
      
      // Execute the handler
      const result = await handlers['move-card']({ boardId, cardId, columnId, position });
      
      // Verify that completed_at is set
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.card.completed_at).toBeDefined();
      expect(responseData.card.completed_at).not.toBeNull();
    });
    
    it('should reject non-existent card ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'non-existent';
      const columnId = 'col-2';
      const position = 0;
      
      // Execute the handler with a non-existent card ID
      const result = await handlers['move-card']({ boardId, cardId, columnId, position });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject non-existent column ID', async () => {
      const boardId = 'test-board-id';
      const cardId = 'card-1';
      const columnId = 'non-existent';
      const position = 0;
      
      // Execute the handler with a non-existent column ID
      const result = await handlers['move-card']({ boardId, cardId, columnId, position });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('does not exist');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const cardId = 'item1';
      const columnId = 'col1';
      const position = 0;
      
      // Execute the handler with a legacy board
      const result = await handlers['move-card']({ boardId, cardId, columnId, position });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('card-first architecture');
    });
  });
  
  describe('batch-cards', () => {
    it('should process multiple operations in a single transaction', async () => {
      const boardId = 'test-board-id';
      const operations = [
        {
          type: 'update',
          cardId: 'card-1',
          cardData: JSON.stringify({
            title: 'Updated Title 1'
          })
        },
        {
          type: 'move',
          cardId: 'card-2',
          columnId: 'col-3',
          position: 0
        }
      ];
      
      // Execute the handler
      const result = await handlers['batch-cards']({ boardId, operations });
      
      // Verify the result
      expect(result.isError).toBeFalsy();
      
      // Parse the returned results
      const responseData = JSON.parse(result.content[0].text);
      
      // Check that all operations were processed
      expect(responseData.success).toBeTruthy();
      expect(responseData.results).toHaveLength(operations.length);
      
      // Verify the board was saved once (transaction-like behavior)
      const board = await Board.load(boardId);
      expect(board.save).toHaveBeenCalledTimes(1);
    });
    
    it('should handle validation errors for update operations', async () => {
      const boardId = 'test-board-id';
      const operations = [
        {
          type: 'update',
          cardId: 'card-1',
          cardData: '{ invalid json }'
        }
      ];
      
      // Execute the handler with an invalid operation
      const result = await handlers['batch-cards']({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('Invalid JSON');
    });
    
    it('should handle validation errors for move operations', async () => {
      const boardId = 'test-board-id';
      const operations = [
        {
          type: 'move',
          cardId: 'card-1'
          // Missing columnId and position
        }
      ];
      
      // Execute the handler with an invalid operation
      const result = await handlers['batch-cards']({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('required');
    });
    
    it('should handle non-existent card IDs', async () => {
      const boardId = 'test-board-id';
      const operations = [
        {
          type: 'update',
          cardId: 'non-existent',
          cardData: JSON.stringify({
            title: 'Updated Title'
          })
        }
      ];
      
      // Execute the handler with a non-existent card ID
      const result = await handlers['batch-cards']({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('not found');
    });
    
    it('should reject legacy board format', async () => {
      const boardId = 'legacy-board';
      const operations = [
        {
          type: 'update',
          cardId: 'item1',
          cardData: JSON.stringify({
            title: 'Updated Title'
          })
        }
      ];
      
      // Execute the handler with a legacy board
      const result = await handlers['batch-cards']({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('card-first architecture');
    });
    
    it('should validate required fields for operations', async () => {
      const boardId = 'test-board-id';
      const operations = [
        {
          type: 'update',
          // Missing cardId
          cardData: JSON.stringify({
            title: 'Updated Title'
          })
        }
      ];
      
      // Execute the handler with a missing required field
      const result = await handlers['batch-cards']({ boardId, operations });
      
      // Verify error response
      expect(result.isError).toBeTruthy();
      expect(result.content[0].text).toContain('required');
    });
  });
});