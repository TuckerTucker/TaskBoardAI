/**
 * @jest-environment node
 */

const Board = require('../../../server/models/Board');

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
});

// Mock the fileSystem utility
jest.mock('../../../server/utils/fileSystem', () => ({
  ensureBoardsDir: jest.fn().mockResolvedValue(undefined)
}));

// Create test data factories for consistent test data
const createTestBoard = (overrides = {}) => {
  const defaultData = {
    id: 'test-board-id',
    projectName: 'Test Board',
    last_updated: '2025-03-15T12:00:00.000Z',
    columns: [
      { id: 'col-1', name: 'Backlog' },
      { id: 'col-2', name: 'In Progress' },
      { id: 'col-3', name: 'Done' }
    ],
    cards: [
      {
        id: 'card-1',
        title: 'Task 1',
        content: 'Description for task 1',
        columnId: 'col-1',
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
        id: 'card-2',
        title: 'Task 2',
        content: 'Description for task 2',
        columnId: 'col-2',
        position: 0,
        collapsed: true,
        subtasks: ['Subtask 1'],
        tags: ['frontend'],
        dependencies: ['card-1'],
        created_at: '2025-03-14T09:15:00.000Z',
        updated_at: '2025-03-14T09:45:00.000Z',
        completed_at: null
      },
      {
        id: 'card-3',
        title: 'Task 3',
        content: 'Description for task 3',
        columnId: 'col-3',
        position: 0,
        collapsed: false,
        subtasks: [],
        tags: ['backend'],
        dependencies: [],
        created_at: '2025-03-14T08:00:00.000Z',
        updated_at: '2025-03-14T10:30:00.000Z',
        completed_at: '2025-03-14T10:30:00.000Z'
      }
    ]
  };

  return { ...defaultData, ...overrides };
};

const createLegacyTestBoard = (overrides = {}) => {
  const defaultData = {
    id: 'legacy-board-id',
    projectName: 'Legacy Board',
    last_updated: '2025-03-15T12:00:00.000Z',
    columns: [
      { 
        id: 'col-1', 
        name: 'Backlog',
        items: [
          {
            id: 'item-1',
            title: 'Task 1',
            content: 'Description for task 1',
            collapsed: false,
            subtasks: ['Subtask 1', 'Subtask 2'],
            tags: ['backend'],
            dependencies: [],
            created_at: '2025-03-14T09:00:00.000Z',
            updated_at: '2025-03-14T09:30:00.000Z',
            completed_at: null
          }
        ]
      },
      { 
        id: 'col-2', 
        name: 'In Progress',
        items: [
          {
            id: 'item-2',
            title: 'Task 2',
            content: 'Description for task 2',
            collapsed: true,
            subtasks: ['Subtask 1'],
            tags: ['frontend'],
            dependencies: ['item-1'],
            created_at: '2025-03-14T09:15:00.000Z',
            updated_at: '2025-03-14T09:45:00.000Z',
            completed_at: null
          }
        ]
      },
      { 
        id: 'col-3', 
        name: 'Done',
        items: [
          {
            id: 'item-3',
            title: 'Task 3',
            content: 'Description for task 3',
            collapsed: false,
            subtasks: [],
            tags: ['backend'],
            dependencies: [],
            created_at: '2025-03-14T08:00:00.000Z',
            updated_at: '2025-03-14T10:30:00.000Z',
            completed_at: '2025-03-14T10:30:00.000Z'
          }
        ]
      }
    ]
  };

  return { ...defaultData, ...overrides };
};

// Setup token counting mock
const createTokenCounter = () => {
  let counts = {
    full: 0,
    summary: 0,
    compact: 0,
    cardsOnly: 0,
    cardsOnlyFiltered: 0
  };

  const countTokens = (text) => {
    // Simple approximation - in a real system we'd use a proper tokenizer
    return Math.ceil(text.length / 4);
  };

  return {
    counts,
    resetCounts: () => {
      counts = {
        full: 0,
        summary: 0,
        compact: 0,
        cardsOnly: 0,
        cardsOnlyFiltered: 0
      };
    },
    measureFormat: (board, format, options = {}) => {
      const result = board.format(format, options);
      const tokenCount = countTokens(JSON.stringify(result));
      
      switch (format) {
        case 'full':
          counts.full = tokenCount;
          break;
        case 'summary':
          counts.summary = tokenCount;
          break;
        case 'compact':
          counts.compact = tokenCount;
          break;
        case 'cards-only':
          if (options.columnId) {
            counts.cardsOnlyFiltered = tokenCount;
          } else {
            counts.cardsOnly = tokenCount;
          }
          break;
      }
      
      return { result, tokenCount };
    },
    getReductionPercentage: (format) => {
      if (counts.full === 0) return 0;
      
      const formatCount = counts[format];
      return Math.round((1 - (formatCount / counts.full)) * 100);
    }
  };
};

describe('Token Optimization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Format Transformers', () => {
    describe('format method', () => {
      it('should return the correct format based on the parameter', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        // Spy on the transformer methods
        const summaryFormatSpy = jest.spyOn(board, 'toSummaryFormat');
        const compactFormatSpy = jest.spyOn(board, 'toCompactFormat');
        const cardsOnlyFormatSpy = jest.spyOn(board, 'toCardsOnlyFormat');
        
        // Test each format
        board.format('full');
        board.format('summary');
        board.format('compact');
        board.format('cards-only');
        
        // Verify each appropriate transformer was called
        expect(summaryFormatSpy).toHaveBeenCalledTimes(1);
        expect(compactFormatSpy).toHaveBeenCalledTimes(1);
        expect(cardsOnlyFormatSpy).toHaveBeenCalledTimes(1);
      });
      
      it('should use full format when no format is specified', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const result = board.format();
        expect(result).toEqual(boardData);
      });
      
      it('should pass columnId option to cards-only format', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const cardsOnlyFormatSpy = jest.spyOn(board, 'toCardsOnlyFormat');
        
        board.format('cards-only', { columnId: 'col-1' });
        
        expect(cardsOnlyFormatSpy).toHaveBeenCalledWith('col-1');
      });
    });
    
    describe('toSummaryFormat', () => {
      it('should transform card-first board to summary format', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const result = board.toSummaryFormat();
        
        // Check structure
        expect(result).toHaveProperty('id', boardData.id);
        expect(result).toHaveProperty('projectName', boardData.projectName);
        expect(result).toHaveProperty('last_updated', boardData.last_updated);
        expect(result).toHaveProperty('columns');
        expect(result).toHaveProperty('stats');
        
        // Check columns
        expect(result.columns).toHaveLength(3);
        expect(result.columns[0]).toEqual({
          id: 'col-1',
          name: 'Backlog',
          cardCount: 1
        });
        
        // Check stats
        expect(result.stats).toEqual({
          totalCards: 3,
          completedCards: 1,
          progressPercentage: 33
        });
      });
      
      it('should handle empty boards', () => {
        const boardData = createTestBoard({
          cards: [] // Empty cards array
        });
        const board = new Board(boardData);
        
        const result = board.toSummaryFormat();
        
        // Verify counts are zero
        expect(result.stats).toEqual({
          totalCards: 0,
          completedCards: 0,
          progressPercentage: 0
        });
        
        // Verify columns have zero cards
        expect(result.columns[0].cardCount).toBe(0);
      });
      
      it('should handle legacy board format', () => {
        const legacyBoardData = createLegacyTestBoard();
        const board = new Board(legacyBoardData);
        
        const result = board.toSummaryFormat();
        
        // We expect empty stats since the summary format primarily works with card-first architecture
        expect(result.stats).toEqual({
          totalCards: 0,
          completedCards: 0,
          progressPercentage: 0
        });
        
        // Columns should still be present but with zero counts
        expect(result.columns).toHaveLength(3);
        expect(result.columns[0].cardCount).toBe(0);
      });
    });
    
    describe('toCompactFormat', () => {
      it('should transform card-first board to compact format with shortened property names', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const result = board.toCompactFormat();
        
        // Check basic structure
        expect(result).toHaveProperty('id', boardData.id);
        expect(result).toHaveProperty('name', boardData.projectName); // projectName → name
        expect(result).toHaveProperty('up', boardData.last_updated); // last_updated → up
        expect(result).toHaveProperty('cols'); // columns → cols
        expect(result).toHaveProperty('cards');
        
        // Check columns
        expect(result.cols).toHaveLength(3);
        expect(result.cols[0]).toEqual({
          id: 'col-1',
          n: 'Backlog' // name → n
        });
        
        // Check cards with shortened property names
        expect(result.cards).toHaveLength(3);
        
        // Check first card property mapping
        const originalCard = boardData.cards[0];
        const compactCard = result.cards[0];
        
        expect(compactCard.id).toBe(originalCard.id);
        expect(compactCard.t).toBe(originalCard.title); // title → t
        expect(compactCard.col).toBe(originalCard.columnId); // columnId → col
        expect(compactCard.p).toBe(originalCard.position); // position → p
        expect(compactCard.c).toBe(originalCard.content); // content → c
        expect(compactCard.sub).toEqual(originalCard.subtasks); // subtasks → sub
        expect(compactCard.tag).toEqual(originalCard.tags); // tags → tag
      });
      
      it('should omit optional properties when empty', () => {
        const boardData = createTestBoard({
          cards: [
            {
              id: 'card-minimal',
              title: 'Minimal Card',
              columnId: 'col-1',
              position: 0,
              // No other properties
            }
          ]
        });
        const board = new Board(boardData);
        
        const result = board.toCompactFormat();
        const compactCard = result.cards[0];
        
        // Core properties should be present
        expect(compactCard).toHaveProperty('id');
        expect(compactCard).toHaveProperty('t');
        expect(compactCard).toHaveProperty('col');
        expect(compactCard).toHaveProperty('p');
        
        // Optional properties should be omitted
        expect(compactCard).not.toHaveProperty('c');
        expect(compactCard).not.toHaveProperty('coll');
        expect(compactCard).not.toHaveProperty('sub');
        expect(compactCard).not.toHaveProperty('tag');
        expect(compactCard).not.toHaveProperty('dep');
        expect(compactCard).not.toHaveProperty('ca');
        expect(compactCard).not.toHaveProperty('ua');
        expect(compactCard).not.toHaveProperty('comp');
      });
      
      it('should handle legacy board format', () => {
        const legacyBoardData = createLegacyTestBoard();
        const board = new Board(legacyBoardData);
        
        const result = board.toCompactFormat();
        
        // Basic structure should be present
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('cols');
        
        // Cards array should be empty since legacy format doesn't have top-level cards
        expect(result.cards).toHaveLength(0);
      });
    });
    
    describe('toCardsOnlyFormat', () => {
      it('should return only the cards array without other board metadata', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const result = board.toCardsOnlyFormat();
        
        // Should only have cards property
        expect(Object.keys(result)).toHaveLength(1);
        expect(result).toHaveProperty('cards');
        expect(result.cards).toEqual(boardData.cards);
        
        // Should not have board metadata
        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('projectName');
        expect(result).not.toHaveProperty('columns');
        expect(result).not.toHaveProperty('last_updated');
      });
      
      it('should filter cards by column when columnId is provided', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const result = board.toCardsOnlyFormat('col-1');
        
        // Should only have cards from the specified column
        expect(result.cards).toHaveLength(1);
        expect(result.cards[0].columnId).toBe('col-1');
        expect(result.cards[0].id).toBe('card-1');
      });
      
      it('should return an empty cards array for non-existent columnId', () => {
        const boardData = createTestBoard();
        const board = new Board(boardData);
        
        const result = board.toCardsOnlyFormat('non-existent-column');
        
        expect(result.cards).toHaveLength(0);
      });
      
      it('should return an empty cards array for legacy boards', () => {
        const legacyBoardData = createLegacyTestBoard();
        const board = new Board(legacyBoardData);
        
        const result = board.toCardsOnlyFormat();
        
        expect(result.cards).toHaveLength(0);
      });
    });
  });
  
  describe('Token Optimization Measurement', () => {
    it('should demonstrate significant token reduction with summary format', () => {
      const boardData = createTestBoard();
      const board = new Board(boardData);
      const tokenCounter = createTokenCounter();
      
      // Measure tokens for different formats
      tokenCounter.measureFormat(board, 'full');
      tokenCounter.measureFormat(board, 'summary');
      
      // Get reduction percentage
      const reduction = tokenCounter.getReductionPercentage('summary');
      
      // Summary format should use significantly fewer tokens (at least 40% fewer)
      expect(reduction).toBeGreaterThanOrEqual(40);
      
      // Log token usage for documentation
      console.log(`Summary format reduces tokens by ${reduction}%`);
    });
    
    it('should demonstrate significant token reduction with compact format', () => {
      const boardData = createTestBoard();
      const board = new Board(boardData);
      const tokenCounter = createTokenCounter();
      
      // Measure tokens for different formats
      tokenCounter.measureFormat(board, 'full');
      tokenCounter.measureFormat(board, 'compact');
      
      // Get reduction percentage
      const reduction = tokenCounter.getReductionPercentage('compact');
      
      // Compact format should use significantly fewer tokens (at least 30% fewer)
      expect(reduction).toBeGreaterThanOrEqual(30);
      
      // Log token usage for documentation
      console.log(`Compact format reduces tokens by ${reduction}%`);
    });
    
    it('should demonstrate significant token reduction with cards-only format', () => {
      const boardData = createTestBoard();
      const board = new Board(boardData);
      const tokenCounter = createTokenCounter();
      
      // Measure tokens for different formats
      tokenCounter.measureFormat(board, 'full');
      tokenCounter.measureFormat(board, 'cards-only');
      
      // Get reduction percentage
      const reduction = tokenCounter.getReductionPercentage('cardsOnly');
      
      // Cards-only format should use significantly fewer tokens (at least 20% fewer)
      expect(reduction).toBeGreaterThanOrEqual(20);
      
      // Log token usage for documentation
      console.log(`Cards-only format reduces tokens by ${reduction}%`);
    });
    
    it('should demonstrate extreme token reduction with filtered cards-only format', () => {
      const boardData = createTestBoard();
      const board = new Board(boardData);
      const tokenCounter = createTokenCounter();
      
      // Measure tokens for different formats
      tokenCounter.measureFormat(board, 'full');
      tokenCounter.measureFormat(board, 'cards-only', { columnId: 'col-1' });
      
      // Get reduction percentage
      const reduction = tokenCounter.getReductionPercentage('cardsOnlyFiltered');
      
      // Filtered cards-only format should use dramatically fewer tokens (at least 60% fewer)
      expect(reduction).toBeGreaterThanOrEqual(60);
      
      // Log token usage for documentation
      console.log(`Filtered cards-only format reduces tokens by ${reduction}%`);
    });
    
    it('should show increasing token reduction with larger boards', () => {
      // Create a larger test board with more cards
      const largeBoard = createTestBoard();
      
      // Add 20 more cards to simulate a larger board
      for (let i = 4; i <= 23; i++) {
        const columnId = `col-${(i % 3) + 1}`; // Distribute across 3 columns
        
        largeBoard.cards.push({
          id: `card-${i}`,
          title: `Task ${i}`,
          content: `Description for task ${i}. This includes some longer content to simulate a realistic card with detailed information.`,
          columnId: columnId,
          position: largeBoard.cards.filter(card => card.columnId === columnId).length,
          collapsed: false,
          subtasks: [`Subtask ${i}.1`, `Subtask ${i}.2`],
          tags: i % 2 === 0 ? ['backend'] : ['frontend'],
          dependencies: [],
          created_at: '2025-03-14T09:00:00.000Z',
          updated_at: '2025-03-14T09:30:00.000Z',
          completed_at: columnId === 'col-3' ? '2025-03-14T10:30:00.000Z' : null
        });
      }
      
      const board = new Board(largeBoard);
      const tokenCounter = createTokenCounter();
      
      // Measure tokens for different formats with larger board
      tokenCounter.measureFormat(board, 'full');
      tokenCounter.measureFormat(board, 'summary');
      tokenCounter.measureFormat(board, 'compact');
      tokenCounter.measureFormat(board, 'cards-only');
      tokenCounter.measureFormat(board, 'cards-only', { columnId: 'col-1' });
      
      // Get reduction percentages
      const summaryReduction = tokenCounter.getReductionPercentage('summary');
      const compactReduction = tokenCounter.getReductionPercentage('compact');
      const cardsOnlyReduction = tokenCounter.getReductionPercentage('cardsOnly');
      const filteredReduction = tokenCounter.getReductionPercentage('cardsOnlyFiltered');
      
      // Larger boards should show more dramatic token reductions
      expect(summaryReduction).toBeGreaterThanOrEqual(60);
      expect(compactReduction).toBeGreaterThanOrEqual(40);
      expect(cardsOnlyReduction).toBeGreaterThanOrEqual(25);
      expect(filteredReduction).toBeGreaterThanOrEqual(75);
      
      // Log token usage for documentation
      console.log(`With larger board (${largeBoard.cards.length} cards):`);
      console.log(`- Summary format reduces tokens by ${summaryReduction}%`);
      console.log(`- Compact format reduces tokens by ${compactReduction}%`);
      console.log(`- Cards-only format reduces tokens by ${cardsOnlyReduction}%`);
      console.log(`- Filtered cards-only format reduces tokens by ${filteredReduction}%`);
    });
  });
});