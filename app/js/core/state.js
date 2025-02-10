/**
 * State Management Module
 * Centralized state management for the kanban board
 */

import { apiService } from '../services/api.js';

class StateManager {
    constructor() {
        this.state = {
            projectName: 'My Kanban Board',
            columns: [],
            isDragging: false
        };
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
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to initialize state:', error);
            // Create default columns if loading fails
            if (this.state.columns.length === 0) {
                this.state.columns = [
                    {
                        id: this.generateUUID(),
                        name: 'To Do',
                        items: [{
                            id: this.generateUUID(),
                            title: 'Welcome!',
                            description: '# Welcome to the Enhanced Kanban Board\n\nThis board supports:\n- Markdown formatting\n- Subtasks\n- Tags\n- Dependencies\n- Completion tracking',
                            collapsed: false,
                            subtasks: [
                                'Try adding a new card',
                                'Try moving cards between columns',
                                'Try using markdown in descriptions'
                            ],
                            tags: ['example', 'welcome']
                        }]
                    },
                    {
                        id: this.generateUUID(),
                        name: 'Doing',
                        items: []
                    },
                    {
                        id: this.generateUUID(),
                        name: 'Done',
                        items: []
                    }
                ];
                this.notifyListeners();
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
        this.listeners.forEach(listener => listener(this.state));
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
            name: name || 'New Column',
            items: []
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
            this.state.columns.splice(columnIndex, 1);
            await this.saveState();
        }
    }

    /**
     * Add a card to a column
     * @param {number} columnIndex - Target column index
     * @param {Object} card - Card data
     */
    async addCard(columnIndex, card) {
        if (columnIndex >= 0 && columnIndex < this.state.columns.length) {
            const newCard = {
                id: this.generateUUID(),
                ...card,
                collapsed: false,
                subtasks: card.subtasks || [],
                tags: card.tags || []
            };
            this.state.columns[columnIndex].items.push(newCard);
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
        const column = this.state.columns[columnIndex];
        if (!column) return;

        // Find the card's current index
        const currentIndex = column.items.findIndex(item => item.id === cardId);
        if (currentIndex === -1) return;

        // Remove card from current position
        const [card] = column.items.splice(currentIndex, 1);
        
        // Insert at new position
        column.items.splice(newIndex, 0, card);
        
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
        const sourceColumn = this.state.columns[sourceColumnIndex];
        const targetColumn = this.state.columns[targetColumnIndex];
        
        if (!sourceColumn || !targetColumn) return;

        const cardIndex = sourceColumn.items.findIndex(item => item.id === cardId);
        if (cardIndex === -1) return;

        const [card] = sourceColumn.items.splice(cardIndex, 1);
        
        if (newIndex >= 0) {
            targetColumn.items.splice(newIndex, 0, card);
        } else {
            targetColumn.items.push(card);
        }
        
        await this.saveState();
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
     * Generate a UUID
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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

// Create and export a singleton instance
export const stateManager = new StateManager();
