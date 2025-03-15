/**
 * Test data factories to create consistent test data
 * for both legacy and card-first board formats
 */

/**
 * Create test board data in card-first format
 * @param {Object} options - Customization options
 * @returns {Object} Board data in card-first format
 */
function createCardFirstBoard(options = {}) {
  const defaults = {
    id: 'test-board',
    projectName: 'Test Board',
    last_updated: '2025-03-14T10:00:00.000Z',
  };
  
  const mergedOptions = { ...defaults, ...options };
  
  const board = {
    ...mergedOptions,
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
  
  // Allow for custom modifiers
  if (options.modifyBoard) {
    options.modifyBoard(board);
  }
  
  return board;
}

/**
 * Create test board data in legacy format
 * @param {Object} options - Customization options
 * @returns {Object} Board data in legacy format
 */
function createLegacyBoard(options = {}) {
  const defaults = {
    id: 'test-board',
    projectName: 'Test Board',
    last_updated: '2025-03-14T10:00:00.000Z',
  };
  
  const mergedOptions = { ...defaults, ...options };
  
  const board = {
    ...mergedOptions,
    columns: [
      { 
        id: 'backlog', 
        name: 'Backlog',
        items: [
          {
            id: 'card1',
            title: 'Task 1',
            content: 'Description for task 1',
            collapsed: false,
            subtasks: ['Subtask 1', 'Subtask 2'],
            tags: ['backend'],
            dependencies: [],
            created_at: '2025-03-14T09:00:00.000Z',
            updated_at: '2025-03-14T09:30:00.000Z'
          }
        ] 
      },
      { 
        id: 'in-progress', 
        name: 'In Progress',
        items: [
          {
            id: 'card2',
            title: 'Task 2',
            content: 'Description for task 2',
            collapsed: true,
            subtasks: ['Subtask 1'],
            tags: ['frontend'],
            dependencies: ['card1'],
            created_at: '2025-03-14T09:15:00.000Z',
            updated_at: '2025-03-14T09:45:00.000Z'
          }
        ] 
      },
      { 
        id: 'done', 
        name: 'Done',
        items: [
          {
            id: 'card3',
            title: 'Task 3',
            content: 'Description for task 3',
            collapsed: false,
            subtasks: [],
            tags: ['backend'],
            dependencies: [],
            created_at: '2025-03-14T08:00:00.000Z',
            updated_at: '2025-03-14T08:30:00.000Z',
            completed_at: '2025-03-14T09:00:00.000Z'
          }
        ] 
      }
    ]
  };
  
  // Allow for custom modifiers
  if (options.modifyBoard) {
    options.modifyBoard(board);
  }
  
  return board;
}

/**
 * Create a single card/item for testing
 * @param {Object} options - Customization options
 * @returns {Object} Card data
 */
function createCard(options = {}) {
  const defaults = {
    id: 'card-1',
    title: 'Test Card',
    content: 'Test content',
    columnId: 'backlog',
    position: 0,
    collapsed: false,
    subtasks: [],
    tags: [],
    dependencies: [],
    created_at: '2025-03-14T09:00:00.000Z',
    updated_at: '2025-03-14T09:30:00.000Z',
    completed_at: null
  };
  
  return { ...defaults, ...options };
}

/**
 * Create a single legacy item for testing
 * @param {Object} options - Customization options
 * @returns {Object} Item data in legacy format
 */
function createLegacyItem(options = {}) {
  const defaults = {
    id: 'item-1',
    title: 'Test Item',
    content: 'Test content',
    collapsed: false,
    subtasks: [],
    tags: [],
    dependencies: [],
    created_at: '2025-03-14T09:00:00.000Z',
    updated_at: '2025-03-14T09:30:00.000Z'
  };
  
  return { ...defaults, ...options };
}

module.exports = {
  createCardFirstBoard,
  createLegacyBoard,
  createCard,
  createLegacyItem
};