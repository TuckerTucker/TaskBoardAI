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
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Setup UI event listeners
function setupEventListeners() {
    // Add column button
    document.getElementById('add-column-btn').addEventListener('click', async () => {
        const name = prompt('Enter column name:');
        if (name) {
            await stateManager.addColumn(name);
        }
    });

    // Project name click
    const projectName = document.getElementById('project-name');
    projectName.addEventListener('click', async () => {
        const name = prompt('Enter new project name:', stateManager.getState().projectName);
        if (name) {
            await stateManager.updateProjectName(name);
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
    
    // Render columns
    for (let index = 0; index < state.columns.length; index++) {
        const columnData = state.columns[index];
        const column = new Column(columnData, index);
        board.appendChild(column.render());
        
        // Render cards for this column
        for (const cardData of columnData.items) {
            const card = new Card(cardData, index);
            column.addCard(card);
        }
    }
    
    // Update Next Steps if available
    if (state['next-steps'] && nextSteps) {
        console.log('Updating next steps during render:', state['next-steps']);
        nextSteps.update(state['next-steps']);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeApp);
