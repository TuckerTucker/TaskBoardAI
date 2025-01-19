/**
 * Drag and Drop Utility Module
 * Handles all drag and drop functionality for the kanban board
 */

import { stateManager } from '../core/state.js';

class DragDropManager {
    constructor() {
        this.draggedItem = null;
        this.dragging = false;
        this.sourceColumnIndex = null;
    }

    /**
     * Initialize drag and drop event listeners
     */
    initialize() {
        document.addEventListener('dragstart', this.handleDragStart.bind(this));
        document.addEventListener('dragend', this.handleDragEnd.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));
    }

    /**
     * Handle drag start event
     * @param {DragEvent} e - Drag event
     */
    handleDragStart(e) {
        if (!e.target.matches('.card')) return;
        
        this.draggedItem = e.target;
        this.sourceColumnIndex = parseInt(e.target.closest('.column').dataset.index);
        
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
        setTimeout(() => {
            this.draggedItem.classList.add('dragging');
        }, 0);
    }

    /**
     * Handle drag end event
     */
    handleDragEnd() {
        if (!this.draggedItem) return;
        
        this.draggedItem.classList.remove('dragging');
        this.draggedItem = null;
        this.sourceColumnIndex = null;
    }

    /**
     * Handle drag over event
     * @param {DragEvent} e - Drag event
     */
    handleDragOver(e) {
        e.preventDefault();
        
        const column = e.target.closest('.column');
        if (!column || !this.draggedItem) return;
        
        const cards = [...column.querySelectorAll('.card:not(.dragging)')];
        const afterElement = this.getDragAfterElement(column, e.clientY);
        
        if (afterElement) {
            column.querySelector('.cards').insertBefore(this.draggedItem, afterElement);
        } else {
            column.querySelector('.cards').appendChild(this.draggedItem);
        }
    }

    /**
     * Handle drop event
     * @param {DragEvent} e - Drag event
     */
    async handleDrop(e) {
        e.preventDefault();
        
        const column = e.target.closest('.column');
        if (!column || !this.draggedItem) return;
        
        const targetColumnIndex = parseInt(column.dataset.index);
        if (this.sourceColumnIndex === targetColumnIndex) return;
        
        const cardId = this.draggedItem.dataset.id;
        await stateManager.moveCard(cardId, this.sourceColumnIndex, targetColumnIndex);
    }

    /**
     * Get the element to insert the dragged item after
     * @param {HTMLElement} column - Column element
     * @param {number} y - Mouse Y position
     * @returns {HTMLElement} Element to insert after
     */
    getDragAfterElement(column, y) {
        const cards = [...column.querySelectorAll('.card:not(.dragging)')];
        
        return cards.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

// Create singleton instance
const dragDropManager = new DragDropManager();

/**
 * Setup drag and drop functionality
 */
export function setupDragAndDrop() {
    dragDropManager.initialize();
}
