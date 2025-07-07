/**
 * @fileoverview Centralized state management for the kanban board
 * @module core/state
 * @requires ../services/api
 */

import { apiService } from '../services/api.js';

/**
 * Class for managing application state
 * @class
 * @classdesc Handles state management, persistence, and board operations
 * @category Core
 */
class StateManager {
    /**
     * Create a StateManager instance
     */
    constructor() {
        /**
         * Application state object
         * @type {Object}
         * @property {string} projectName - Name of the board project
         * @property {Array<Column>} columns - Column definitions in the board
         * @property {Array<Card>} cards - All cards in the board
         * @property {boolean} isDragging - Whether a drag operation is in progress
         */
        this.state = {
            projectName: 'My Kanban Board',
            columns: [],
            cards: [],
            isDragging: false
        };
        
        /**
         * Set of state change listeners
         * @type {Set<Function>}
         * @private
         */
        this.listeners = new Set();
    }

    /**
     * Initialize the state with default data
     */
    async initialize() {
        try {
            // Load data from server
            const data = await apiService.loadBoard();
            this.state = {
                ...data,
                isDragging: false
            };
            
            // If using legacy format (cards nested in columns), convert to new format
            if (this.state.columns && !this.state.cards) {
                this.convertToCardFirst(this.state);
            }
            
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to initialize state:', error);
            // Create default columns and cards if loading fails
            if (this.state.columns.length === 0) {
                this.state.columns = [
                    {
                        id: this.generateUUID(),
                        name: 'To Do'
                    },
                    {
                        id: this.generateUUID(),
                        name: 'Doing'
                    },
                    {
                        id: this.generateUUID(),
                        name: 'Done'
                    }
                ];
                
                const todoColumnId = this.state.columns[0].id;
                this.state.cards = [{
                    id: this.generateUUID(),
                    title: 'Welcome!',
                    content: '# Welcome to the Enhanced Kanban Board\n\nThis board supports:\n- Markdown formatting\n- Subtasks\n- Tags\n- Dependencies\n- Completion tracking',
                    columnId: todoColumnId,
                    position: 0,
                    collapsed: false,
                    subtasks: [
                        'Try adding a new card',
                        'Try moving cards between columns',
                        'Try using markdown in descriptions'
                    ],
                    tags: ['example', 'welcome'],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }];
                
                this.notifyListeners();
            }
        }
    }
    
    /**
     * Convert legacy column-based state to card-first state
     * @param {Object} state - State object to convert
     * @private
     */
    convertToCardFirst(state) {
        // Create cards array if it doesn't exist
        if (!state.cards) {
            state.cards = [];
        }
        
        // Extract all cards from columns
        if (state.columns && Array.isArray(state.columns)) {
            for (let columnIndex = 0; columnIndex < state.columns.length; columnIndex++) {
                const column = state.columns[columnIndex];
                
                if (column.items && Array.isArray(column.items)) {
                    // Process each card in the column
                    for (let cardIndex = 0; cardIndex < column.items.length; cardIndex++) {
                        const card = column.items[cardIndex];
                        
                        // Add the card to the cards array with columnId and position
                        state.cards.push({
                            ...card,
                            columnId: column.id,
                            position: cardIndex,
                            created_at: card.created_at || new Date().toISOString(),
                            updated_at: card.updated_at || new Date().toISOString()
                        });
                    }
                }
                
                // Remove items array from column
                delete column.items;
            }
        }
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function for state changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of state changes
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    /**
     * Update project name
     * @param {string} name - New project name
     */
    async updateProjectName(name) {
        this.state.projectName = name;
        await this.saveState();
    }

    /**
     * Add a new column
     * @param {string} name - Column name
     */
    async addColumn(name) {
        const column = {
            id: this.generateUUID(),
            name: name || 'New Column'
        };
        this.state.columns.push(column);
        await this.saveState();
        return column;
    }

    /**
     * Remove a column
     * @param {number} columnIndex - Index of column to remove
     */
    async removeColumn(columnIndex) {
        if (columnIndex >= 0 && columnIndex < this.state.columns.length) {
            const columnId = this.state.columns[columnIndex].id;
            
            // Remove column from columns array
            this.state.columns.splice(columnIndex, 1);
            
            // Find and remove cards in this column
            this.state.cards = this.state.cards.filter(card => card.columnId !== columnId);
            
            await this.saveState();
        }
    }
    
    /**
     * Reorder columns
     * @param {string} columnId - Column ID 
     * @param {number} newIndex - New position index
     */
    async reorderColumns(columnId, newIndex) {
        // Find the column's current index
        const currentIndex = this.state.columns.findIndex(column => column.id === columnId);
        if (currentIndex === -1 || newIndex < 0 || newIndex >= this.state.columns.length) return;
        
        // Remove column from current position
        const [column] = this.state.columns.splice(currentIndex, 1);
        
        // Insert at new position
        this.state.columns.splice(newIndex, 0, column);
        
        await this.saveState();
    }

    /**
     * Add a card to a column
     * @param {number} columnIndex - Target column index
     * @param {Object} card - Card data
     */
    async addCard(columnIndex, card) {
        if (columnIndex >= 0 && columnIndex < this.state.columns.length) {
            const columnId = this.state.columns[columnIndex].id;
            
            // Calculate highest position value for this column
            const position = this.getCardsInColumn(columnId).length;
            
            const newCard = {
                id: this.generateUUID(),
                ...card,
                columnId,
                position,
                collapsed: false,
                subtasks: card.subtasks || [],
                tags: card.tags || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            this.state.cards.push(newCard);
            await this.saveState();
            return newCard;
        }
        return null;
    }

    /**
     * Reorder a card within its column
     * @param {string} cardId - Card ID
     * @param {number} columnIndex - Column index
     * @param {number} newIndex - New position index
     */
    async reorderCard(cardId, columnIndex, newIndex) {
        const card = this.state.cards.find(c => c.id === cardId);
        if (!card) return;
        
        const columnId = this.state.columns[columnIndex].id;
        const columnCards = this.getCardsInColumn(columnId);
        
        // Update positions for all affected cards
        if (newIndex >= 0 && newIndex < columnCards.length) {
            // Remove card from its current position (keeping it in the cards array)
            const sortedCards = [...columnCards];
            const cardToMove = sortedCards.find(c => c.id === cardId);
            const currentIndex = sortedCards.indexOf(cardToMove);
            
            if (currentIndex !== -1) {
                // Update card positions based on their new order
                if (currentIndex < newIndex) {
                    // Moving down: decrement positions of cards between old and new position
                    for (let i = currentIndex + 1; i <= newIndex; i++) {
                        const c = sortedCards[i];
                        const cardIndex = this.state.cards.findIndex(sc => sc.id === c.id);
                        if (cardIndex !== -1) {
                            this.state.cards[cardIndex].position = i - 1;
                        }
                    }
                } else if (currentIndex > newIndex) {
                    // Moving up: increment positions of cards between new and old position
                    for (let i = newIndex; i < currentIndex; i++) {
                        const c = sortedCards[i];
                        const cardIndex = this.state.cards.findIndex(sc => sc.id === c.id);
                        if (cardIndex !== -1) {
                            this.state.cards[cardIndex].position = i + 1;
                        }
                    }
                }
                
                // Set the card's new position
                const cardIndex = this.state.cards.findIndex(c => c.id === cardId);
                if (cardIndex !== -1) {
                    this.state.cards[cardIndex].position = newIndex;
                }
            }
        }
        
        await this.saveState();
    }

    /**
     * Move a card between columns
     * @param {string} cardId - Card ID
     * @param {number} sourceColumnIndex - Source column index
     * @param {number} targetColumnIndex - Target column index
     * @param {number} newIndex - New position index (optional)
     */
    async moveCard(cardId, sourceColumnIndex, targetColumnIndex, newIndex = -1) {
        const cardIndex = this.state.cards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) return;
        
        // Find source and target column IDs
        const sourceColumnId = this.state.columns[sourceColumnIndex]?.id;
        const targetColumnId = this.state.columns[targetColumnIndex]?.id;
        
        if (!sourceColumnId || !targetColumnId) return;
        
        // Update columnId
        this.state.cards[cardIndex].columnId = targetColumnId;
        this.state.cards[cardIndex].updated_at = new Date().toISOString();
        
        // Position handling
        const targetCards = this.getCardsInColumn(targetColumnId);
        
        if (targetColumnId.toLowerCase().includes('done')) {
            // Set completed_at timestamp when moved to "Done" column
            this.state.cards[cardIndex].completed_at = new Date().toISOString();
        } else {
            // Remove completed_at when moved out of "Done"
            this.state.cards[cardIndex].completed_at = null;
        }
        
        // Update position based on drop position
        if (newIndex >= 0 && newIndex <= targetCards.length) {
            // Increment positions of all cards after the insertion point
            for (const c of this.state.cards) {
                if (c.id !== cardId && c.columnId === targetColumnId && c.position >= newIndex) {
                    c.position++;
                }
            }
            
            // Set card position
            this.state.cards[cardIndex].position = newIndex;
        } else {
            // Add to the end
            this.state.cards[cardIndex].position = targetCards.length;
        }
        
        await this.saveState();
    }
    
    /**
     * Remove a card
     * @param {string} cardId - Card ID
     * @param {number} columnIndex - Column index (for backwards compatibility)
     */
    async removeCard(cardId, columnIndex) {
        const cardIndex = this.state.cards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) return;
        
        // Remove the card
        this.state.cards.splice(cardIndex, 1);
        await this.saveState();
    }
    
    /**
     * Get cards in a specific column, sorted by position
     * @param {string} columnId - Column ID
     * @returns {Array} Array of cards in the column
     */
    getCardsInColumn(columnId) {
        return this.state.cards
            .filter(card => card.columnId === columnId)
            .sort((a, b) => a.position - b.position);
    }

    /**
     * Save current state to server
     */
    async saveState() {
        try {
            await apiService.saveBoard(this.state);
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to save state:', error);
            throw error;
        }
    }
    
    /**
     * Load a specific board
     * @param {string|Object} boardNameOrData - Name of the board to load or board data object
     */
    async loadBoard(boardNameOrData) {
      // Check if we received a board object or a board name
      if (typeof boardNameOrData === 'object') {
        // We received a board object directly
        this.state = {
          ...boardNameOrData,
          isDragging: false
        };
        
        // Convert to card-first if using legacy format
        if (this.state.columns && !this.state.cards) {
            this.convertToCardFirst(this.state);
        }
        
        this.notifyListeners();
        return boardNameOrData;
      }
      
      // We received a board name, save it to localStorage
      // Make sure boardName is a string and not undefined or null
      const boardName = boardNameOrData || 'default';
      localStorage.setItem('selectedBoard', boardName);
      
      try {
        // First try to load from API
        try {
          // Make sure we're passing a valid string to the API service
          const data = await apiService.loadBoard(String(boardName));
          this.state = {
            ...data,
            isDragging: false
          };
          
          // Convert to card-first if using legacy format
          if (this.state.columns && !this.state.cards) {
              this.convertToCardFirst(this.state);
          }
          
          this.notifyListeners();
          return data;
        } catch (apiError) {
          console.warn('Could not load board from API, trying local fetch:', apiError);
          
          // If API fails, try to fetch from local boards directory
          try {
            const response = await fetch(`/boards/${encodeURIComponent(boardName)}.json`);
            if (!response.ok) {
              throw new Error(`Failed to load board: ${response.status} ${response.statusText}`);
            }
            
            // Check if the response is valid JSON before parsing
            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.includes('application/json')) {
              console.warn('Response content-type is not JSON:', contentType);
              // Continue anyway, as some servers might not set the correct content type
            }
            
            const text = await response.text();
            if (!text || text.trim() === '') {
              throw new Error('Empty response received');
            }
            
            try {
              const board = JSON.parse(text);
              this.state = {
                ...board,
                isDragging: false
              };
              
              // Convert to card-first if using legacy format
              if (this.state.columns && !this.state.cards) {
                  this.convertToCardFirst(this.state);
              }
              
              this.notifyListeners();
              return board;
            } catch (parseError) {
              console.error('JSON parse error:', parseError, 'Response text:', text);
              throw new Error(`Failed to parse board data: ${parseError.message}`);
            }
          } catch (localError) {
            console.warn('Could not load board from local file:', localError);
            throw localError;
          }
        }
      } catch (error) {
        console.error('Failed to load board:', error);
        
        // Create a default board instead of throwing an error
        console.log('Creating default board as fallback');
        const todoColumnId = this.generateUUID();
        const doingColumnId = this.generateUUID();
        const doneColumnId = this.generateUUID();
        
        const defaultBoard = {
          projectName: boardNameOrData ? `${boardNameOrData} Board` : 'My Kanban Board',
          columns: [
            {
              id: todoColumnId,
              name: 'To Do'
            },
            {
              id: doingColumnId,
              name: 'Doing'
            },
            {
              id: doneColumnId,
              name: 'Done'
            }
          ],
          cards: [{
            id: this.generateUUID(),
            title: 'Welcome!',
            content: '# Welcome to the Enhanced Kanban Board\n\nThis board supports:\n- Markdown formatting\n- Subtasks\n- Tags\n- Dependencies\n- Completion tracking',
            columnId: todoColumnId,
            position: 0,
            collapsed: false,
            subtasks: [
              'Try adding a new card',
              'Try moving cards between columns',
              'Try using markdown in descriptions'
            ],
            tags: ['example', 'welcome'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        };
        
        this.state = {
          ...defaultBoard,
          isDragging: false
        };
        this.notifyListeners();
        return defaultBoard;
      }
    }

    /**
     * Generate a UUID
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get the current state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }
}

/**
 * Singleton instance of StateManager
 * @type {StateManager}
 */
export const stateManager = new StateManager();

/**
 * Initialize application state with previously selected board if available
 * @async
 * @function initializeState
 * @returns {Promise<Object>} Initialized board data
 */
export async function initializeState() {
  try {
    // Check if there's a previously selected board in localStorage
    const savedBoard = localStorage.getItem('selectedBoard');
    
    // If there is a saved board, load it, otherwise initialize with default
    if (savedBoard && 
        typeof savedBoard === 'string' && 
        savedBoard !== 'undefined' && 
        savedBoard !== 'null' && 
        !savedBoard.includes('[object Object]') && 
        savedBoard.trim() !== '') {
      console.log('Loading previously selected board:', savedBoard);
      return stateManager.loadBoard(savedBoard);
    } else {
      console.log('No valid saved board found, initializing with default');
      // Clear invalid value from localStorage
      localStorage.removeItem('selectedBoard');
      return stateManager.initialize();
    }
  } catch (error) {
    console.error('Error in initializeState:', error);
    // Fall back to default initialization
    return stateManager.initialize();
  }
}