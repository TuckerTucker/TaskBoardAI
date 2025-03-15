/**
 * @jest-environment jsdom
 */

// Mock the state manager
jest.mock('../../../app/js/core/state.js', () => ({
  stateManager: {
    getState: jest.fn(),
    saveState: jest.fn(),
    notifyListeners: jest.fn()
  }
}));

// Mock the marked library (used for markdown rendering)
global.marked = {
  parse: jest.fn(text => `<p>${text}</p>`)
};

import { Card } from '../../../app/js/components/Card.js';
import { stateManager } from '../../../app/js/core/state.js';

describe('Card Component', () => {
  let mockCardData;
  let mockStateData;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock card data
    mockCardData = {
      id: 'card123',
      title: 'Test Card',
      content: 'Card description',
      tags: ['important', 'frontend'],
      subtasks: ['Task 1', '✓ Task 2 (completed)'],
      dependencies: ['card456'],
      collapsed: false
    };
    
    // Setup mock state data using card-first architecture
    mockStateData = {
      columns: [
        {
          id: 'col1',
          name: 'To Do'
        }
      ],
      cards: [
        mockCardData,
        {
          id: 'card456',
          title: 'Dependency Card',
          columnId: 'col1',
          position: 1
        }
      ]
    };
    
    // Configure stateManager mock
    stateManager.getState.mockReturnValue(mockStateData);
    
    // Setup DOM for testing
    document.body.innerHTML = '<div id="board"></div>';
  });
  
  describe('initialization', () => {
    it('should initialize with correct properties', () => {
      const card = new Card(mockCardData, 0);
      
      expect(card.data).toBe(mockCardData);
      expect(card.columnIndex).toBe(0);
      expect(card.element).toBeNull();
      expect(card.isCollapsed).toBe(false);
    });
    
    it('should handle collapsed state from data', () => {
      const collapsedCard = new Card({...mockCardData, collapsed: true}, 0);
      expect(collapsedCard.isCollapsed).toBe(true);
    });
  });
  
  describe('getDependencyTitle', () => {
    it('should return the title of a dependency card by ID', () => {
      const card = new Card(mockCardData, 0);
      const title = card.getDependencyTitle('card456');
      
      expect(title).toBe('Dependency Card');
      expect(stateManager.getState).toHaveBeenCalled();
    });
    
    it('should return an empty string if dependency not found', () => {
      const card = new Card(mockCardData, 0);
      const title = card.getDependencyTitle('nonexistent');
      
      expect(title).toBe('');
    });
  });
  
  describe('render', () => {
    it('should create a card element with the correct structure', () => {
      const card = new Card(mockCardData, 0);
      const element = card.render();
      
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.className).toContain('card');
      expect(element.dataset.id).toBe('card123');
      expect(element.draggable).toBe(true);
      
      // Check header content
      const header = element.querySelector('.card-header');
      expect(header).not.toBeNull();
      expect(header.querySelector('h3').textContent).toBe('Test Card');
      
      // Check card content sections
      const content = element.querySelector('.card-content');
      expect(content.querySelector('.description')).not.toBeNull();
      expect(content.querySelector('.subtasks')).not.toBeNull();
      expect(content.querySelector('.dependencies')).not.toBeNull();
      expect(content.querySelector('.tags')).not.toBeNull();
    });
    
    it('should render a collapsed card correctly', () => {
      const collapsedCard = new Card({...mockCardData, collapsed: true}, 0);
      const element = collapsedCard.render();
      
      expect(element.className).toContain('collapsed');
      expect(element.querySelector('.card-content').className).toContain('collapsed');
      expect(element.querySelector('.collapse-btn i').className).toContain('fa-chevron-down');
    });
    
    it('should use marked to parse markdown content', () => {
      new Card(mockCardData, 0).render();
      
      expect(marked.parse).toHaveBeenCalledWith('Card description');
    });
  });
  
  describe('renderSubtasks', () => {
    it('should render subtasks with correct checked states', () => {
      const card = new Card(mockCardData, 0);
      const subtasksHTML = card.renderSubtasks();
      
      expect(subtasksHTML).toContain('Subtasks');
      expect(subtasksHTML).toContain('Task 1');
      expect(subtasksHTML).toContain('Task 2 (completed)');
      
      // Create a temporary element to test the classes
      const div = document.createElement('div');
      div.innerHTML = subtasksHTML;
      
      const subtasks = div.querySelectorAll('.subtask');
      expect(subtasks.length).toBe(2);
      expect(subtasks[0].className).not.toContain('checked');
      expect(subtasks[1].className).toContain('checked');
    });
    
    it('should return empty string if no subtasks', () => {
      const cardWithoutSubtasks = new Card({...mockCardData, subtasks: []}, 0);
      expect(cardWithoutSubtasks.renderSubtasks()).toBe('');
    });
  });
  
  describe('renderDependencies', () => {
    it('should render dependencies with correct titles', () => {
      const card = new Card(mockCardData, 0);
      const dependenciesHTML = card.renderDependencies();
      
      expect(dependenciesHTML).toContain('Dependencies');
      expect(dependenciesHTML).toContain('Dependency Card');
      
      // Create a temporary element to check data attributes
      const div = document.createElement('div');
      div.innerHTML = dependenciesHTML;
      
      const dependencyItem = div.querySelector('li');
      expect(dependencyItem.dataset.id).toBe('card456');
    });
    
    it('should return empty string if dependencies are not found', () => {
      // Mock stateManager to return empty state
      stateManager.getState.mockReturnValue({ columns: [] });
      
      const card = new Card(mockCardData, 0);
      expect(card.renderDependencies()).toBe('');
    });
  });
  
  describe('renderTags', () => {
    it('should render tags correctly', () => {
      const card = new Card(mockCardData, 0);
      const tagsHTML = card.renderTags();
      
      expect(tagsHTML).toContain('important');
      expect(tagsHTML).toContain('frontend');
      
      // Create a temporary element
      const div = document.createElement('div');
      div.innerHTML = tagsHTML;
      
      const tags = div.querySelectorAll('.tag');
      expect(tags.length).toBe(2);
    });
    
    it('should return empty string if no tags', () => {
      const cardWithoutTags = new Card({...mockCardData, tags: []}, 0);
      expect(cardWithoutTags.renderTags()).toBe('');
    });
  });
  
  describe('setCollapsed', () => {
    it('should update collapsed state and DOM elements', () => {
      const card = new Card(mockCardData, 0);
      card.render(); // Create the element
      
      // Toggle to collapsed
      card.setCollapsed(true);
      
      // Check UI updates
      expect(card.isCollapsed).toBe(true);
      expect(card.data.collapsed).toBe(true);
      expect(card.element.classList.contains('collapsed')).toBe(true);
      expect(card.element.querySelector('.card-content').classList.contains('collapsed')).toBe(true);
      expect(card.element.querySelector('.collapse-btn i').className).toContain('fa-chevron-down');
      
      // Check state updates
      expect(stateManager.saveState).toHaveBeenCalled();
    });
  });
});