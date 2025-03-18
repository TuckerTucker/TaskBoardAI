/**
 * Main Application Entry Point
 */

import { stateManager, initializeState } from './core/state.js';
import { setupDragAndDrop } from './utils/drag-drop.js';
import { Column } from './components/Column.js';
import { Card } from './components/Card.js';
import { NextSteps } from './components/NextSteps.js';
import { Settings } from './components/Settings.js';
import { apiService } from './services/api.js';

// Global component references
let nextSteps;

// Initialize the application
async function initializeApp() {
    try {
        // Initialize components first so they're available even if state initialization fails
        nextSteps = new NextSteps();
        const settings = new Settings();
        
        // Setup UI event listeners
        setupEventListeners();
        
        // Setup drag and drop
        setupDragAndDrop();
        
        // Initialize state with previously selected board if available
        try {
            await initializeState();
            console.log('State initialized successfully');
        } catch (stateError) {
            console.error('State initialization error:', stateError);
            showError('Error loading board data. Using default board.');
            // Continue execution - the state manager will use default board
        }
        
        // Try to load next steps if available
        try {
            const state = stateManager.getState();
            if (state['next-steps']) {
                console.log('Next steps found:', state['next-steps']);
                nextSteps.update(state['next-steps']);
            } else {
                console.log('No next steps found in state');
            }
        } catch (nextStepsError) {
            console.warn('Error loading next steps:', nextStepsError);
            // Continue without next steps
        }
        
        // Initial render
        renderBoard();
        
        // Subscribe to state changes
        stateManager.subscribe(renderBoard);
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError('Failed to initialize application. Please try refreshing the page.');
        
        // Create minimal UI to allow user interaction
        try {
            const board = document.getElementById('board');
            if (board) {
                board.innerHTML = '<div class="error-container"><h2>Failed to load board</h2><p>Please check your connection and try again.</p><button id="retry-btn">Retry</button></div>';
                document.getElementById('retry-btn')?.addEventListener('click', () => {
                    window.location.reload();
                });
            }
        } catch (fallbackError) {
            console.error('Failed to create fallback UI:', fallbackError);
        }
    }
}

// Show error message to user
function showError(message) {
    showMessage(message, 'error');
}

// Show message to user
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 5000);
}

// Setup UI event listeners
function setupEventListeners() {
    // Project name click
    const projectName = document.getElementById('project-name');
    projectName.addEventListener('click', async () => {
        const name = prompt('Enter new project name:', stateManager.getState().projectName);
        if (name) {
            await stateManager.updateProjectName(name);
        }
    });
    
    // Copy board info button
    document.getElementById('copy-board-info-btn').addEventListener('click', () => {
        const currentBoard = stateManager.getState();
        if (currentBoard && currentBoard.id) {
            const boardInfo = `Board: ${currentBoard.projectName || 'Untitled'}\nID: ${currentBoard.id}`;
            
            // Copy to clipboard
            navigator.clipboard.writeText(boardInfo).then(() => {
                showMessage('Board info copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy board info:', err);
                showMessage('Failed to copy board info', 'error');
            });
        } else {
            showMessage('No board is currently loaded', 'error');
        }
    });
    
    // Archive board button
    document.getElementById('archive-board-btn').addEventListener('click', async () => {
        const currentBoard = stateManager.getState();
        if (currentBoard && currentBoard.id) {
            if (confirm('Are you sure you want to archive this board? It will be moved to the Archives.')) {
                try {
                    await apiService.archiveBoard(currentBoard.id);
                    showMessage('Board archived successfully!', 'success');
                    // Redirect to the boards list or load a default board
                    window.location.reload();
                } catch (error) {
                    console.error('Failed to archive board:', error);
                    showMessage('Failed to archive board', 'error');
                }
            }
        } else {
            showMessage('No board is currently loaded', 'error');
        }
    });
    
    // Initialize modal backdrop if it doesn't exist
    if (!document.getElementById('modal-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.id = 'modal-backdrop';
        backdrop.className = 'modal-backdrop hidden';
        document.body.appendChild(backdrop);
    }
}

// Render the board
function renderBoard() {
    const state = stateManager.getState();
    const board = document.getElementById('board');
    const projectName = document.getElementById('project-name');
    
    // Update project name
    projectName.textContent = state.projectName;
    
    // Clear existing columns
    board.innerHTML = '';
    
    // Add "Add Column" button as the first element
    const addColumnBtn = document.createElement('div');
    addColumnBtn.id = 'add-column-container';
    addColumnBtn.innerHTML = `
        <button id="add-column-btn" class="circular-btn" title="Add Column">
            <i class="fas fa-plus"></i>
        </button>
    `;
    board.appendChild(addColumnBtn);
    
    // Render columns
    for (let index = 0; index < state.columns.length; index++) {
        const columnData = state.columns[index];
        const column = new Column(columnData, index);
        board.appendChild(column.render());
        
        // Render cards for this column based on the card-first architecture
        const columnCards = state.cards
            .filter(card => card.columnId === columnData.id)
            .sort((a, b) => a.position - b.position);
        
        for (const cardData of columnCards) {
            const card = new Card(cardData, index);
            column.addCard(card);
        }
    }
    
    // Update Next Steps if available
    if (state['next-steps'] && nextSteps) {
        console.log('Updating next steps during render:', state['next-steps']);
        nextSteps.update(state['next-steps']);
    }
    
    // Re-attach event listener for the new add column button
    document.getElementById('add-column-btn').addEventListener('click', async () => {
        const name = prompt('Enter column name:');
        if (name) {
            await stateManager.addColumn(name);
        }
    });
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
