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
        this.dragItemType = null;
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
        const isCard = e.target.matches('.card');
        const isColumn = e.target.matches('.column') && 
                       !e.target.closest('button') && 
                       !e.target.closest('.card') && 
                       !e.target.closest('.cards');
        
        if (!isCard && !isColumn) return;
        
        // Prevent event bubbling and duplicate drag-start events
        if (e._handled) return;
        e._handled = true;
        
        this.draggedItem = e.target;
        this.dragItemType = isCard ? 'card' : 'column';
        
        console.log(`Drag start: ${this.dragItemType}`, e.target);
        
        if (isCard) {
            this.sourceColumnIndex = parseInt(e.target.closest('.column').dataset.index);
            const data = {
                type: 'card',
                id: e.target.dataset.id,
                columnIndex: this.sourceColumnIndex
            };
            console.log('Setting card drag data:', data);
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
        } else if (isColumn) {
            const data = {
                type: 'column',
                id: e.target.dataset.id,
                index: parseInt(e.target.dataset.index)
            };
            console.log('Setting column drag data:', data);
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
        }
        
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
        this.dragItemType = null;
    }

    /**
     * Handle drag over event
     * @param {DragEvent} e - Drag event
     */
    handleDragOver(e) {
        e.preventDefault();
        
        if (!this.draggedItem) return;
        
        if (this.dragItemType === 'card') {
            this.handleCardDragOver(e);
        } else if (this.dragItemType === 'column') {
            this.handleColumnDragOver(e);
        }
    }
    
    /**
     * Handle drag over for cards
     * @param {DragEvent} e - Drag event
     */
    handleCardDragOver(e) {
        const column = e.target.closest('.column');
        if (!column) return;
        
        const cards = [...column.querySelectorAll('.card:not(.dragging)')];
        const afterElement = this.getDragAfterElement(column, e.clientY);
        
        if (afterElement) {
            column.querySelector('.cards').insertBefore(this.draggedItem, afterElement);
        } else {
            column.querySelector('.cards').appendChild(this.draggedItem);
        }
    }
    
    /**
     * Handle drag over for columns
     * @param {DragEvent} e - Drag event
     */
    handleColumnDragOver(e) {
        const board = document.getElementById('board');
        if (!board) return;
        
        let targetColumn = e.target.closest('.column');
        
        // If hovering over the dragged column itself, find the nearest non-dragged column
        if (targetColumn === this.draggedItem || !targetColumn) {
            const mouseX = e.clientX;
            const columns = [...board.querySelectorAll('.column:not(.dragging)')];
            
            // Find nearest column based on mouse position
            targetColumn = columns.reduce((closest, column) => {
                const box = column.getBoundingClientRect();
                const offset = mouseX - (box.left + box.width / 2);
                const absOffset = Math.abs(offset);
                
                if (absOffset < closest.absOffset) {
                    return { 
                        absOffset, 
                        element: column, 
                        isAfter: offset > 0 
                    };
                }
                return closest;
            }, { absOffset: Number.POSITIVE_INFINITY }).element;
            
            if (!targetColumn) return;
        }
        
        const targetIndex = parseInt(targetColumn.dataset.index);
        const draggedIndex = parseInt(this.draggedItem.dataset.index);
        
        // Determine if dragged column should go before or after target
        const targetRect = targetColumn.getBoundingClientRect();
        const isAfter = e.clientX > targetRect.left + targetRect.width / 2;
        
        if ((isAfter && draggedIndex < targetIndex) || (!isAfter && draggedIndex > targetIndex)) {
            if (isAfter) {
                board.insertBefore(this.draggedItem, targetColumn.nextSibling);
            } else {
                board.insertBefore(this.draggedItem, targetColumn);
            }
        }
    }

    /**
     * Handle drop event
     * @param {DragEvent} e - Drag event
     */
    async handleDrop(e) {
        e.preventDefault();
        
        if (!this.draggedItem) return;
        
        try {
            const dataTransferText = e.dataTransfer.getData('text/plain');
            console.log('Drop data received:', dataTransferText);
            
            const dataTransfer = JSON.parse(dataTransferText);
            console.log('Parsed data:', dataTransfer);
            
            if (dataTransfer.type === 'card') {
                await this.handleCardDrop(e, dataTransfer);
            } else if (dataTransfer.type === 'column') {
                await this.handleColumnDrop(e, dataTransfer);
            } else {
                console.warn('Unknown drag item type:', dataTransfer);
            }
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    }
    
    /**
     * Handle drop for cards
     * @param {DragEvent} e - Drag event
     * @param {Object} data - Card data
     */
    async handleCardDrop(e, data) {
        const column = e.target.closest('.column');
        if (!column) return;
        
        const targetColumnIndex = parseInt(column.dataset.index);
        const cardId = data.id;
        const sourceColumnIndex = data.columnIndex;
        
        // Get all cards in the target column
        const cards = [...column.querySelectorAll('.card')];
        const newIndex = cards.indexOf(this.draggedItem);
        
        if (sourceColumnIndex === targetColumnIndex) {
            // Same column - reorder
            await stateManager.reorderCard(cardId, targetColumnIndex, newIndex);
        } else {
            // Different column - move
            await stateManager.moveCard(cardId, sourceColumnIndex, targetColumnIndex, newIndex);
        }
    }
    
    /**
     * Handle drop for columns
     * @param {DragEvent} e - Drag event 
     * @param {Object} data - Column data
     */
    async handleColumnDrop(e, data) {
        const board = document.getElementById('board');
        if (!board) return;
        
        // Calculate the new index based on the DOM order
        const columns = [...board.querySelectorAll('.column')];
        const newIndex = columns.indexOf(this.draggedItem);
        
        // Reorder columns in state
        await stateManager.reorderColumns(data.id, newIndex);
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
