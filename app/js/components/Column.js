/**
 * Column Component
 * Represents a single column in the kanban board
 */

import { stateManager } from '../core/state.js';
import { Card } from './Card.js';

const COLUMN_TYPES = {
    TODO: ['todo', 'to do', 'backlog', 'pending', 'new'],
    DOING: ['doing', 'in progress', 'working', 'active'],
    REVIEW: ['review', 'testing', 'qa', 'verify'],
    DONE: ['done', 'complete', 'finished', 'completed']
};

export class Column {
    /**
     * Create a new Column
     * @param {Object} data - Column data
     * @param {number} index - Column index
     */
    constructor(data, index) {
        this.data = data;
        this.index = index;
        this.element = null;
        this.isCollapsed = false;
        this.isDragging = false;
    }

    /**
     * Get the column type based on name
     * @returns {string}
     */
    getType() {
        const name = this.data.name.toLowerCase().trim();
        
        // Check each type's keywords
        for (const [type, keywords] of Object.entries(COLUMN_TYPES)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                return type.toLowerCase();
            }
        }
        
        // Default to todo for first column, doing for middle columns, done for last column
        const totalColumns = stateManager.getState().columns.length;
        if (this.index === 0) return 'todo';
        if (this.index === totalColumns - 1) return 'done';
        return 'doing';
    }

    /**
     * Render the column
     * @returns {HTMLElement}
     */
    render() {
        const column = document.createElement('div');
        column.className = 'column';
        column.dataset.index = this.index;
        column.dataset.type = this.getType();
        column.dataset.id = this.data.id;
        column.draggable = true;
        
        column.innerHTML = `
            <div class="column-header">
                <h2>${this.data.name}</h2>
                <div class="column-actions">
                    <button class="delete-column-btn" title="Delete Column">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="collapse-all-btn" title="Collapse All Cards">
                        <i class="fas fa-circle-chevron-up"></i>
                    </button>
                    <button class="expand-all-btn" title="Expand All Cards">
                        <i class="fas fa-circle-chevron-down"></i>
                    </button>
                </div>
            </div>
            <!-- button class="add-card-btn">+ Add Card</button -->
            <div class="cards"></div>
        `;

        this.element = column;
        this.setupEventListeners();
        return column;
    }

    /**
     * Add a card to the column
     * @param {Card} card - Card instance
     */
    addCard(card) {
        const cardContainer = this.element.querySelector('.cards');
        cardContainer.appendChild(card.render());
    }

    /**
     * Set collapse state for all cards in the column
     * @param {boolean} collapsed - Whether to collapse the cards
     */
    setAllCardsCollapsed(collapsed) {
        const cardsContainer = this.element.querySelector('.cards');
        
        // Get all card elements and update their state
        const cardElements = cardsContainer.querySelectorAll('.card');
        cardElements.forEach(cardElement => {
            const cardId = cardElement.dataset.id;
            
            // Update the card's visual state
            cardElement.classList.toggle('collapsed', collapsed);
            
            // Update the collapse button icon
            const icon = cardElement.querySelector('.collapse-btn i');
            icon.className = `fas fa-chevron-${collapsed ? 'down' : 'up'}`;
            
            // Update the content visibility
            const content = cardElement.querySelector('.card-content');
            content.classList.toggle('collapsed', collapsed);
            
            // Update the card data in the state
            const cardData = this.data.items.find(item => item.id === cardId);
            if (cardData) {
                cardData.collapsed = collapsed;
            }
        });
        
        // Save the updated state
        stateManager.saveState();
    }

    /**
     * Setup event listeners for the column
     */

    
    setupEventListeners() {
        /**
        // Add card button
        const addCardBtn = this.element.querySelector('.add-card-btn');
        addCardBtn.addEventListener('click', async () => {
            const title = prompt('Enter card title:');
            if (title) {
                await stateManager.addCard(this.index, {
                    title,
                    description: '',
                    subtasks: [],
                    tags: []
                });
            }
            
        });*/
        
        // Delete column button
        const deleteBtn = this.element.querySelector('.delete-column-btn');
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this column?')) {
                await stateManager.removeColumn(this.index);
            }
        });

        // Collapse all button
        const collapseAllBtn = this.element.querySelector('.collapse-all-btn');
        collapseAllBtn.addEventListener('click', () => {
            this.setAllCardsCollapsed(true);
        });

        // Expand all button
        const expandAllBtn = this.element.querySelector('.expand-all-btn');
        expandAllBtn.addEventListener('click', () => {
            this.setAllCardsCollapsed(false);
        });
        
        // Column Title edit on double click
        this.element.querySelector('.column-header h2').addEventListener('dblclick', (e) => {
            const newName = prompt('Enter column name:', this.data.name);
            if (newName && newName !== this.data.name) {
                this.data.name = newName;
                e.target.textContent = newName;
                this.element.dataset.type = this.getType();
                stateManager.saveState();
            }
        });
        
        // We'll rely on the central DragDropManager to handle drag events
        // and not add duplicate event listeners here
    }
}
