/**
 * @fileoverview Card component representing a task in the kanban board
 * @module components/Card
 * @requires ../core/state
 */

import { stateManager } from '../core/state.js';

/**
 * Class representing a card in the kanban board
 * @class
 * @classdesc Renders and manages a task card with title, description, subtasks, tags, and dependencies
 * @category Components
 */
export class Card {
    /**
     * Create a new Card
     * @param {Object} data - Card data
     * @param {string} data.id - Unique identifier for the card
     * @param {string} data.title - Card title
     * @param {string} [data.content] - Markdown content for card description
     * @param {boolean} [data.collapsed=false] - Whether the card is collapsed
     * @param {Array<string>} [data.subtasks] - List of subtasks
     * @param {Array<string>} [data.tags] - List of tags
     * @param {Array<string>} [data.dependencies] - List of dependency card IDs
     * @param {number} columnIndex - Parent column index
     */
    constructor(data, columnIndex) {
        this.data = data;
        this.columnIndex = columnIndex;
        this.element = null;
        this.isCollapsed = data.collapsed || false;
    }

    /**
     * Get the title of a card by its ID
     * @param {string} id - Card ID to look up
     * @returns {string} Card title or empty string if not found
     */
    getDependencyTitle(id) {
        const card = stateManager.getState().cards?.find(card => card.id === id);
        return card ? card.title : '';
    }

    /**
     * Render the card
     * @returns {HTMLElement}
     */
    render() {
        const card = document.createElement('div');
        card.className = `card ${this.isCollapsed ? 'collapsed' : ''}`;
        card.draggable = true;
        card.dataset.id = this.data.id;
        
        card.innerHTML = `
            <div class="card-header">
                <h3>${this.data.title}</h3>
                <div class="card-actions">
                    <button class="delete-card-btn" title="Delete Card">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="collapse-btn" title="Toggle Card">
                        <i class="fas fa-chevron-${this.isCollapsed ? 'down' : 'up'}"></i>
                    </button>
                </div>
            </div>
            <div class="card-content ${this.isCollapsed ? 'collapsed' : ''}">
                <div class="description">
                    ${this.data.content ? marked.parse(this.data.content) : '<em>No description</em>'}
                </div>
                ${this.renderSubtasks()}
                ${this.renderDependencies()}
                ${this.renderTags()}
            </div>
        `;

        this.element = card;
        this.setupEventListeners();
        return card;
    }

    /**
     * Render subtasks section
     * @returns {string}
     */
    renderSubtasks() {
        if (!this.data.subtasks?.length) return '';
        
        const subtasksList = this.data.subtasks
            .map(task => {
                const isChecked = task.startsWith('✓');
                const text = isChecked ? task.substring(1).trim() : task;
                
                return `
                    <li class="subtask ${isChecked ? 'checked' : ''}">
                        <span class="status-dot"></span>
                        <span class="text">${text}</span>
                    </li>`;
            })
            .join('');
            
        return `
            <div class="subtasks">
                <h4>Subtasks</h4>
                <ul>${subtasksList}</ul>
            </div>
        `;
    }

    /**
     * Render dependencies section
     * @returns {string}
     */
    renderDependencies() {
        if (!this.data.dependencies?.length) return '';
        
        const dependenciesList = this.data.dependencies
            .map(id => {
                const title = this.getDependencyTitle(id);
                return title ? `<li data-id="${id}">${title}</li>` : '';
            })
            .filter(Boolean)
            .join('');
            
        if (!dependenciesList) return '';
            
        return `
            <div class="dependencies">
                <h4>Dependencies</h4>
                <ul>${dependenciesList}</ul>
            </div>
        `;
    }

    /**
     * Render tags section
     * @returns {string}
     */
    renderTags() {
        if (!this.data.tags?.length) return '';
        
        const tagsList = this.data.tags
            .map(tag => `<span class="tag">${tag}</span>`)
            .join('');
            
        return `<div class="tags">${tagsList}</div>`;
    }

    /**
     * Set collapse state
     * @param {boolean} collapsed - Whether to collapse the card
     */
    setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        this.data.collapsed = collapsed;  // Update the data object
        
        if (this.element) {
            // Update both card and content classes
            this.element.classList.toggle('collapsed', collapsed);
            
            const icon = this.element.querySelector('.collapse-btn i');
            if (icon) {
                const newIconClass = collapsed ? 'down' : 'up';
                icon.className = `fas fa-chevron-${newIconClass}`;
            }
            
            const content = this.element.querySelector('.card-content');
            if (content) {
                content.classList.toggle('collapsed', collapsed);
            }
        }

        // Find and update the card in the state
        const cardIndex = stateManager.getState().cards.findIndex(card => card.id === this.data.id);
        if (cardIndex !== -1) {
            stateManager.getState().cards[cardIndex].collapsed = collapsed;
            stateManager.saveState();  // Persist the change
        }
    }

    /**
     * Setup event listeners for the card
     */
    setupEventListeners() {
        // Toggle collapse
        const collapseBtn = this.element.querySelector('.collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setCollapsed(!this.isCollapsed);
            });
        }
        
        // Delete card button
        const deleteBtn = this.element.querySelector('.delete-card-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this card?')) {
                    await stateManager.removeCard(this.data.id, this.columnIndex);
                }
            });
        }

        // Double click to edit
        this.element.addEventListener('dblclick', (e) => {
            // Don't trigger if clicking buttons
            if (e.target.closest('.collapse-btn') || e.target.closest('.delete-card-btn')) return;
            
            const title = prompt('Edit card title:', this.data.title);
            if (title && title !== this.data.title) {
                this.data.title = title;
                stateManager.notifyListeners();
            }
        });

        // Dependency click
        this.element.querySelectorAll('.dependencies li').forEach(li => {
            li.addEventListener('click', () => {
                const id = li.dataset.id;
                // Search across all columns
                const targetCard = document.querySelector(`.card[data-id="${id}"]`);
                if (targetCard) {
                    // Remove highlight from any previously highlighted cards
                    document.querySelectorAll('.card.highlight-dependency').forEach(card => {
                        card.classList.remove('highlight-dependency');
                        // Also remove any pending timeouts
                        const timeoutId = card.dataset.highlightTimeout;
                        if (timeoutId) {
                            clearTimeout(parseInt(timeoutId));
                            delete card.dataset.highlightTimeout;
                        }
                    });
                    
                    // Add highlight to target card
                    targetCard.classList.add('highlight-dependency');
                    
                    // Store timeout ID to allow cleanup
                    const timeoutId = setTimeout(() => {
                        targetCard.classList.remove('highlight-dependency');
                        delete targetCard.dataset.highlightTimeout;
                    }, 3000);
                    targetCard.dataset.highlightTimeout = timeoutId;
                    
                    // Get the column container and scroll it into view
                    const column = targetCard.closest('.column');
                    if (column) {
                        column.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        // After column is in view, scroll the card container to show the card
                        setTimeout(() => {
                            const cardContainer = targetCard.closest('.cards');
                            if (cardContainer) {
                                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 300);
                    }
                }
            });
        });

        // We'll rely on the central DragDropManager to handle drag events
        // and not add duplicate event listeners here
    }
}
