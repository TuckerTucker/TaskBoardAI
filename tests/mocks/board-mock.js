/**
 * Shared mock implementation for the Board model
 * 
 * This mock provides consistent behavior for Board class tests and
 * supports both the Board.test.js and MCP server tests.
 */

// Create a reusable mocked board instance creator
const createBoardInstance = (data) => {
  const boardData = data || {
    id: 'test-board-id',
    projectName: 'Test Board',
    columns: [
      { id: 'col-1', name: 'To Do' },
      { id: 'col-2', name: 'In Progress' },
      { id: 'col-3', name: 'Done' }
    ],
    cards: [
      { 
        id: 'card-1', 
        title: 'Test Card 1', 
        columnId: 'col-1', 
        position: 0,
        content: 'Test content 1'
      },
      { 
        id: 'card-2', 
        title: 'Test Card 2', 
        columnId: 'col-2', 
        position: 0,
        content: 'Test content 2'
      }
    ]
  };

  // Create a format function that's a Jest mock for spying
  const formatFn = jest.fn((format = 'full', options = {}) => {
    if (format === 'summary') {
      return {
        id: boardData.id,
        projectName: boardData.projectName,
        last_updated: boardData.last_updated,
        columns: (boardData.columns || []).map(col => ({
          id: col.id,
          name: col.name,
          cardCount: (boardData.cards || []).filter(card => card.columnId === col.id).length
        })),
        stats: {
          totalCards: (boardData.cards || []).length,
          completedCards: (boardData.cards || []).filter(card => card.completed_at).length,
          progressPercentage: (boardData.cards || []).length > 0 
            ? Math.round(((boardData.cards || []).filter(card => card.completed_at).length / (boardData.cards || []).length) * 100)
            : 0
        }
      };
    } else if (format === 'compact') {
      return {
        id: boardData.id,
        name: boardData.projectName,
        up: boardData.last_updated,
        cols: (boardData.columns || []).map(col => ({ id: col.id, n: col.name })),
        cards: (boardData.cards || []).map(card => ({
          id: card.id,
          t: card.title,
          col: card.columnId,
          p: card.position,
          ...(card.content ? { c: card.content } : {})
        }))
      };
    } else if (format === 'cards-only') {
      let filteredCards = boardData.cards || [];
      if (options && options.columnId) {
        filteredCards = filteredCards.filter(card => card.columnId === options.columnId);
      }
      return { cards: filteredCards };
    } else {
      // Default is full format
      return boardData;
    }
  });

  // Create a save function that's a Jest mock for spying
  const saveFn = jest.fn().mockResolvedValue(undefined);
  
  // Create a validate function that's a Jest mock for spying
  const validateFn = jest.fn().mockReturnValue(true);

  // Create a simplified mock board instance for testing
  return {
    // Properties directly from boardData
    id: boardData.id,
    projectName: boardData.projectName,
    columns: boardData.columns || [],
    cards: boardData.cards || [],
    // Data property for tests that use board.data
    data: boardData,
    // Format function that's spied on in tests
    format: formatFn,
    // Save function that's spied on in tests
    save: saveFn,
    // Validate function
    validate: validateFn
  };
};

// Create a mock board constructor
const mockBoard = jest.fn().mockImplementation((data) => {
  return createBoardInstance(data);
});

// Shared board instances for tests - allows for consistent mock tracking
const boardInstances = {};

// Add static methods to the mock class
mockBoard.load = jest.fn().mockImplementation(async (boardId) => {
  if (boardId === 'invalid-board') {
    throw new Error('Board not found');
  }
  
  // If we already have this board instance, return it to ensure consistent mock tracking
  if (boardInstances[boardId]) {
    return boardInstances[boardId];
  }
  
  // Create test data based on boardId
  let boardData;
  if (boardId === 'legacy-board') {
    // Legacy board with column-items structure (no cards array)
    boardData = {
      id: boardId,
      projectName: 'Legacy Test Board',
      columns: [
        { 
          id: 'col1', 
          name: 'To Do',
          items: [
            { id: 'item1', title: 'Legacy Item 1' },
            { id: 'item2', title: 'Legacy Item 2' }
          ]
        }
      ]
    };
  } else {
    // Standard card-first board
    boardData = {
      id: boardId || 'test-board-id',
      projectName: 'Test Board',
      columns: [
        { id: 'col-1', name: 'To Do' },
        { id: 'col-2', name: 'In Progress' },
        { id: 'col-3', name: 'Done' }
      ],
      cards: [
        { 
          id: 'card-1', 
          title: 'Test Card 1', 
          columnId: 'col-1', 
          position: 0,
          content: 'Test content 1'
        },
        { 
          id: 'card-2', 
          title: 'Test Card 2', 
          columnId: 'col-2', 
          position: 0,
          content: 'Test content 2'
        }
      ]
    };
  }
  
  // Create a new board instance and save it
  const boardInstance = createBoardInstance(boardData);
  boardInstances[boardId] = boardInstance;
  
  return boardInstance;
});

mockBoard.validateItem = jest.fn().mockImplementation((item) => {
  // Basic validation for test items
  return item && item.id && item.title;
});

mockBoard.list = jest.fn().mockResolvedValue([
  { id: 'board1', name: 'Board 1', lastUpdated: '2023-01-01T00:00:00.000Z' },
  { id: 'board2', name: 'Board 2', lastUpdated: '2023-01-02T00:00:00.000Z' }
]);

mockBoard.import = jest.fn().mockImplementation(async (data) => {
  return {
    id: data.id || 'new-board-id',
    name: data.projectName || 'New Board',
    lastUpdated: data.last_updated || new Date().toISOString()
  };
});

mockBoard.create = jest.fn().mockImplementation(async (name) => {
  return {
    id: 'new-board-id',
    name,
    lastUpdated: new Date().toISOString()
  };
});

mockBoard.delete = jest.fn().mockImplementation(async (boardId) => {
  if (boardId === 'invalid-board') {
    throw new Error('Board not found');
  }
  return { success: true, message: 'Board deleted successfully' };
});

// Helper function to reset the board instances cache between tests
mockBoard.__resetInstances = () => {
  Object.keys(boardInstances).forEach(key => {
    delete boardInstances[key];
  });
};

module.exports = mockBoard;