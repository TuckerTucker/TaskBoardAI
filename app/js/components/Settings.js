/**
 * Settings Component
 * Manages application settings, board management, and configuration
 */

import { apiService } from '../services/api.js';
import { stateManager } from '../core/state.js';
import { Modal } from './Modal.js';

export class Settings {
    /**
     * Create a new Settings instance
     */
    constructor() {
        this.modal = new Modal('settings-modal');
        this.currentSettings = {
            theme: 'light',
            dataStorage: 'local',
            serverOptions: {}
        };
        this.boards = [];
        this.currentBoard = null;
        this.webhooks = [];
        this.archives = [];
        this.selectedArchive = null;
        
        // Initialize without opening the modal
        this.initialize();
    }
    
    /**
     * Initialize settings component
     */
    async initialize() {
        // Get settings button and board selector
        this.settingsBtn = document.getElementById('settings-btn');
        this.boardSelector = document.getElementById('board-selector');
        
        if (!this.settingsBtn) {
            console.error('Settings button not found');
            return;
        }
        
        // Set up event listeners
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        
        // Board selector change event
        if (this.boardSelector) {
            this.boardSelector.addEventListener('change', (e) => this.loadBoard(e.target.value));
            
            // Add highlight effect when dropdown opens
            this.boardSelector.addEventListener('focus', () => {
                document.getElementById('board-select-btn').classList.add('active');
            });
            
            this.boardSelector.addEventListener('blur', () => {
                document.getElementById('board-select-btn').classList.remove('active');
            });
        }
        
        // Form submission handlers
        this.setupFormHandlers();
        
        // Load initial settings
        await this.loadSettings();
        
        // Load available boards
        await this.loadBoards();
        
        // Load archived boards
        await this.loadArchivedBoards();
        
        // Load webhooks
        await this.loadWebhooks();
    }
    
    /**
     * Set up form submission handlers
     */
    setupFormHandlers() {
        // Configuration form
        const configForm = document.getElementById('config-form');
        if (configForm) {
            configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConfiguration();
            });
        }
        
        // New board form
        const newBoardForm = document.getElementById('new-board-form');
        if (newBoardForm) {
            newBoardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createNewBoard();
            });
        }
        
        // Board action buttons
        const boardActionButtons = document.querySelectorAll('.board-action-btn');
        for (const btn of boardActionButtons) {
            btn.addEventListener('click', (e) => {
                const action = e.target.closest('.board-action-btn').dataset.action;
                const boardId = e.target.closest('.board-action-btn').dataset.boardId;
                
                if (action === 'load') {
                    this.loadBoard(boardId);
                } else if (action === 'delete') {
                    this.deleteBoard(boardId);
                } else if (action === 'archive') {
                    this.archiveBoard(boardId);
                }
            });
        }
        
        // Restore archive button
        const restoreArchiveBtn = document.getElementById('restore-archive-btn');
        if (restoreArchiveBtn) {
            restoreArchiveBtn.addEventListener('click', () => {
                if (this.selectedArchive) {
                    this.restoreArchivedBoard(this.selectedArchive.id);
                }
            });
        }
        
        // Export board button
        const exportBoardBtn = document.getElementById('export-board-btn');
        if (exportBoardBtn) {
            exportBoardBtn.addEventListener('click', () => this.exportBoard());
        }
        
        // Import board file input
        const importBoardFile = document.getElementById('import-board-file');
        if (importBoardFile) {
            importBoardFile.addEventListener('change', (e) => this.importBoard(e));
        }
        
        // Webhook form
        const webhookForm = document.getElementById('webhook-form');
        if (webhookForm) {
            webhookForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addWebhook();
            });
        }
        
        // Test webhook button
        const testWebhookBtn = document.getElementById('test-webhook-btn');
        if (testWebhookBtn) {
            testWebhookBtn.addEventListener('click', () => this.testWebhookConnection());
        }
        
        // Webhook action buttons (delete, test)
        const webhookActionButtons = document.querySelectorAll('.webhook-action-btn');
        for (const btn of webhookActionButtons) {
            btn.addEventListener('click', (e) => {
                const action = e.target.closest('.webhook-action-btn').dataset.action;
                const webhookId = e.target.closest('.webhook-action-btn').dataset.webhookId;
                
                if (action === 'test') {
                    this.testWebhook(webhookId);
                } else if (action === 'delete') {
                    this.deleteWebhook(webhookId);
                }
            });
        }
    }
    
    /**
     * Open settings modal
     */
    openSettings() {
        this.modal.open();
        // Default to boards tab
        this.modal.switchTab('boards');
    }
    
    /**
     * Load settings from API
     */
    async loadSettings() {
        try {
            // Load configuration from API
            this.currentSettings = await apiService.loadConfig();
            
            // Update form fields with current settings
            this.updateSettingsForm();
            
            // Apply current theme
            this.applyTheme(this.currentSettings.theme);
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.showMessage('Failed to load settings. Using defaults.', 'error');
            
            // Use default settings as fallback
            this.currentSettings = {
                theme: 'light',
                dataStorage: 'local',
                serverOptions: {
                    apiEndpoint: '/api',
                    autoSave: true
                }
            };
            
            this.updateSettingsForm();
        }
    }
    
    /**
     * Update settings form with current values
     */
    updateSettingsForm() {
        const themeSelect = document.getElementById('theme-select');
        const storageSelect = document.getElementById('storage-select');
        const apiEndpointInput = document.getElementById('api-endpoint');
        const autoSaveCheckbox = document.getElementById('auto-save');
        
        if (themeSelect) themeSelect.value = this.currentSettings.theme;
        if (storageSelect) storageSelect.value = this.currentSettings.dataStorage;
        if (apiEndpointInput) apiEndpointInput.value = this.currentSettings.serverOptions.apiEndpoint || '';
        if (autoSaveCheckbox) autoSaveCheckbox.checked = this.currentSettings.serverOptions.autoSave || false;
    }
    
    /**
     * Save configuration settings
     */
    async saveConfiguration() {
        const themeSelect = document.getElementById('theme-select');
        const storageSelect = document.getElementById('storage-select');
        const apiEndpointInput = document.getElementById('api-endpoint');
        const autoSaveCheckbox = document.getElementById('auto-save');
        
        this.currentSettings = {
            theme: themeSelect ? themeSelect.value : 'light',
            dataStorage: storageSelect ? storageSelect.value : 'local',
            serverOptions: {
                apiEndpoint: apiEndpointInput ? apiEndpointInput.value : '/api',
                autoSave: autoSaveCheckbox ? autoSaveCheckbox.checked : false
            }
        };
        
        try {
            // Save configuration to API
            await apiService.saveConfig(this.currentSettings);
            
            // Apply theme immediately
            this.applyTheme(this.currentSettings.theme);
            
            // Show success message
            this.showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showMessage('Failed to save settings', 'error');
        }
    }
    
    /**
     * Apply theme to the application
     * @param {string} theme - Theme name
     */
    applyTheme(theme) {
        document.body.className = `theme-${theme}`;
    }
    
    /**
     * Load available boards
     */
    async loadBoards() {
        try {
            // Load boards from API
            this.boards = await apiService.getBoards();
            
            // Update board list UI
            this.updateBoardList();
            
            // Update board selector in header
            this.updateBoardSelector();
        } catch (error) {
            console.error('Failed to load boards:', error);
            this.showMessage('Failed to load boards', 'error');
        }
    }
    
    /**
     * Update board list in UI
     */
    updateBoardList() {
        const boardList = document.getElementById('board-list');
        if (!boardList) return;
        
        boardList.innerHTML = '';
        
        if (this.boards.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'board-item';
            emptyMessage.textContent = 'No boards available. Create a new one!';
            boardList.appendChild(emptyMessage);
            return;
        }
        
        for (const board of this.boards) {
            const boardItem = document.createElement('div');
            boardItem.className = 'board-item';
            if (this.currentBoard && this.currentBoard.id === board.id) {
                boardItem.classList.add('selected');
            }
            
            boardItem.innerHTML = `
                <div class="board-name">${board.name}</div>
                <div class="board-actions">
                    <button class="icon-btn board-action-btn" data-action="load" data-board-id="${board.id}" title="Load Board">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="icon-btn board-action-btn" data-action="archive" data-board-id="${board.id}" title="Archive Board">
                        <i class="fas fa-archive"></i>
                    </button>
                    <button class="icon-btn board-action-btn" data-action="delete" data-board-id="${board.id}" title="Delete Board">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            boardList.appendChild(boardItem);
        }
        
        // Re-attach event listeners
        this.setupFormHandlers();
    }
    
    /**
     * Update board selector in header
     */
    updateBoardSelector() {
        if (!this.boardSelector) return;
        
        this.boardSelector.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a board...';
        this.boardSelector.appendChild(defaultOption);
        
        // Add board options
        for (const board of this.boards) {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = board.name;
            
            if (this.currentBoard && this.currentBoard.id === board.id) {
                option.selected = true;
            }
            
            this.boardSelector.appendChild(option);
        }
    }
    
    /**
     * Create a new board
     */
    async createNewBoard() {
        const boardNameInput = document.getElementById('new-board-name');
        if (!boardNameInput || !boardNameInput.value.trim()) {
            this.showMessage('Please enter a board name', 'error');
            return;
        }
        
        const boardName = boardNameInput.value.trim();
        
        try {
            const newBoard = await apiService.createBoard(boardName);
            
            // Add to local list
            this.boards.push(newBoard);
            
            // Update UI
            this.updateBoardList();
            this.updateBoardSelector();
            
            // Clear input
            boardNameInput.value = '';
            
            // Show success message
            this.showMessage(`Board "${boardName}" created successfully!`, 'success');
        } catch (error) {
            console.error('Failed to create board:', error);
            this.showMessage('Failed to create board', 'error');
        }
    }
    
    /**
     * Load a specific board
     * @param {string|Object} boardId - ID of the board to load or board object
     */
    async loadBoard(boardId) {
        if (!boardId) return;
        
        try {
            // Check if boardId is an object (full board) or a string (board ID)
            let board;
            if (typeof boardId === 'object') {
                // We already have the board object
                board = boardId;
            } else {
                // We have a board ID, need to load the board
                board = await apiService.loadBoard(String(boardId));
                
                // Store the board ID in localStorage for persistence
                localStorage.setItem('selectedBoard', String(boardId));
            }
            
            // Update state
            await stateManager.loadBoard(board);
            
            // Update current board
            this.currentBoard = board;
            
            // Update project name in header
            const projectNameElement = document.getElementById('project-name');
            if (projectNameElement) {
                projectNameElement.textContent = board.projectName || 'My Kanban Board';
            }
            
            // Update UI
            this.updateBoardList();
            this.updateBoardSelector();
            
            // Close modal
            this.modal.close();
            
            // Show success message
            this.showMessage(`Board "${board.projectName}" loaded successfully!`, 'success');
        } catch (error) {
            console.error('Failed to load board:', error);
            this.showMessage('Failed to load board', 'error');
        }
    }
    
    /**
     * Delete a board
     * @param {string} boardId - ID of the board to delete
     */
    async deleteBoard(boardId) {
        if (!confirm('Are you sure you want to delete this board? This action cannot be undone.')) {
            return;
        }
        
        try {
            await apiService.deleteBoard(boardId);
            
            // If deleting current board, reset current board
            if (this.currentBoard && this.currentBoard.id === boardId) {
                this.currentBoard = null;
            }
            
            // Remove from local list
            this.boards = this.boards.filter(board => board.id !== boardId);
            
            // Update UI
            this.updateBoardList();
            this.updateBoardSelector();
            
            // Show success message
            this.showMessage('Board deleted successfully!', 'success');
        } catch (error) {
            console.error('Failed to delete board:', error);
            this.showMessage('Failed to delete board', 'error');
        }
    }
    
    /**
     * Export current board to JSON file
     */
    async exportBoard() {
        if (!this.currentBoard) {
            this.showMessage('No board is currently loaded', 'error');
            return;
        }
        
        try {
            // Get current board data
            const boardData = await stateManager.getState();
            
            // Create a Blob with the JSON data
            const blob = new Blob([JSON.stringify(boardData, null, 2)], { type: 'application/json' });
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = `${boardData.projectName.replace(/\s+/g, '-').toLowerCase()}.json`;
            
            // Trigger download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            this.showMessage('Board exported successfully!', 'success');
        } catch (error) {
            console.error('Failed to export board:', error);
            this.showMessage('Failed to export board', 'error');
        }
    }
    
    /**
     * Import board from JSON file
     * @param {Event} event - File input change event
     */
    async importBoard(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Read file content
            const fileContent = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
            
            // Parse JSON
            const boardData = JSON.parse(fileContent);
            
            // Validate board data
            if (!boardData.projectName || !Array.isArray(boardData.columns)) {
                throw new Error('Invalid board data format');
            }
            
            // Import board
            const importedBoard = await apiService.importBoard(boardData);
            
            // Add to local list if not already present
            if (!this.boards.some(board => board.id === importedBoard.id)) {
                this.boards.push(importedBoard);
            }
            
            // Update UI
            this.updateBoardList();
            this.updateBoardSelector();
            
            // Load the imported board
            await this.loadBoard(importedBoard.id);
            
            // Reset file input
            event.target.value = '';
            
            this.showMessage(`Board "${importedBoard.projectName}" imported successfully!`, 'success');
        } catch (error) {
            console.error('Failed to import board:', error);
            this.showMessage(`Failed to import board: ${error.message || 'Unknown error'}`, 'error');
            // Reset file input
            event.target.value = '';
        }
    }
    
    /**
     * Load archived boards
     */
    async loadArchivedBoards() {
        try {
            // Load archives from API
            this.archives = await apiService.getArchivedBoards();
            
            // Update archive list UI
            this.updateArchiveList();
        } catch (error) {
            console.error('Failed to load archived boards:', error);
            this.showMessage('Failed to load archived boards', 'error');
        }
    }
    
    /**
     * Update archive list in UI
     */
    updateArchiveList() {
        const archiveList = document.getElementById('archive-list');
        if (!archiveList) return;
        
        archiveList.innerHTML = '';
        
        if (this.archives.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'board-item';
            emptyMessage.textContent = 'No archived boards available.';
            archiveList.appendChild(emptyMessage);
            
            // Disable restore button
            const restoreButton = document.getElementById('restore-archive-btn');
            if (restoreButton) {
                restoreButton.disabled = true;
            }
            
            return;
        }
        
        for (const archive of this.archives) {
            const archiveItem = document.createElement('div');
            archiveItem.className = 'board-item';
            
            if (this.selectedArchive && this.selectedArchive.id === archive.id) {
                archiveItem.classList.add('selected');
            }
            
            archiveItem.innerHTML = `
                <div class="board-name">${archive.name}</div>
                <div class="board-info">
                    <span class="archive-date">${new Date(archive.archivedAt).toLocaleDateString()} </br> ${new Date(archive.archivedAt).toLocaleTimeString()}</span>
                </div>
            `;
            
            // Add click handler to select this archive
            archiveItem.addEventListener('click', () => {
                this.selectArchive(archive);
            });
            
            archiveList.appendChild(archiveItem);
        }
    }
    
    /**
     * Select an archive to potentially restore
     * @param {Object} archive - Archive to select
     */
    selectArchive(archive) {
        this.selectedArchive = archive;
        
        // Update UI for selected archive
        const archiveItems = document.querySelectorAll('#archive-list .board-item');
        for (const item of archiveItems) {
            if (item.querySelector('.board-name').textContent === archive.name) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        }
        
        // Update selected archive name
        const selectedNameElement = document.getElementById('selected-archive-name');
        if (selectedNameElement) {
            selectedNameElement.textContent = archive.name;
        }
        
        // Enable restore button
        const restoreButton = document.getElementById('restore-archive-btn');
        if (restoreButton) {
            restoreButton.disabled = false;
        }
    }
    
    /**
     * Archive a board
     * @param {string} boardId - ID of the board to archive
     */
    async archiveBoard(boardId) {
        if (!confirm('Are you sure you want to archive this board? It will be moved to the Archives.')) {
            return;
        }
        
        try {
            await apiService.archiveBoard(boardId);
            
            // If archiving current board, reset current board
            if (this.currentBoard && this.currentBoard.id === boardId) {
                this.currentBoard = null;
            }
            
            // Remove from local list
            this.boards = this.boards.filter(board => board.id !== boardId);
            
            // Refresh archives list
            await this.loadArchivedBoards();
            
            // Update UI
            this.updateBoardList();
            this.updateBoardSelector();
            
            // Show success message
            this.showMessage('Board archived successfully!', 'success');
        } catch (error) {
            console.error('Failed to archive board:', error);
            this.showMessage('Failed to archive board', 'error');
        }
    }
    
    /**
     * Restore a board from archive
     * @param {string} archiveId - ID of the archive to restore
     */
    async restoreArchivedBoard(archiveId) {
        try {
            const restoredBoard = await apiService.restoreArchivedBoard(archiveId);
            
            // Add to local boards list
            this.boards.push(restoredBoard);
            
            // Refresh archives list
            await this.loadArchivedBoards();
            
            // Clear selected archive
            this.selectedArchive = null;
            
            // Update UI
            this.updateBoardList();
            this.updateBoardSelector();
            this.updateArchiveList();
            
            // Update selected archive name
            const selectedNameElement = document.getElementById('selected-archive-name');
            if (selectedNameElement) {
                selectedNameElement.textContent = 'No archive selected';
            }
            
            // Disable restore button
            const restoreButton = document.getElementById('restore-archive-btn');
            if (restoreButton) {
                restoreButton.disabled = true;
            }
            
            // Show success message
            this.showMessage(`Board "${restoredBoard.name}" restored successfully!`, 'success');
        } catch (error) {
            console.error('Failed to restore board from archive:', error);
            this.showMessage('Failed to restore board from archive', 'error');
        }
    }
    
    /**
     * Show a message to the user
     * @param {string} message - Message to display
     * @param {string} type - Message type (success, error, info)
     */
    showMessage(message, type = 'info') {
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;
        
        document.body.appendChild(messageElement);
        
        // Remove after 3 seconds
        setTimeout(() => {
            messageElement.classList.add('fade-out');
            setTimeout(() => {
                messageElement.remove();
            }, 300);
        }, 3000);
    }
    
    /**
     * Load webhooks from API
     */
    async loadWebhooks() {
        try {
            // Load webhooks from API
            this.webhooks = await apiService.getWebhooks();
            
            // Update webhook list UI
            this.updateWebhookList();
        } catch (error) {
            console.error('Failed to load webhooks:', error);
            this.showMessage('Failed to load webhooks', 'error');
            this.webhooks = [];
        }
    }
    
    /**
     * Update webhook list in UI
     */
    updateWebhookList() {
        const webhookList = document.getElementById('webhook-list');
        if (!webhookList) return;
        
        webhookList.innerHTML = '';
        
        if (this.webhooks.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'webhook-item';
            emptyMessage.textContent = 'No webhooks configured. Add one below!';
            webhookList.appendChild(emptyMessage);
            return;
        }
        
        for (const webhook of this.webhooks) {
            const webhookItem = document.createElement('div');
            webhookItem.className = 'webhook-item';
            
            webhookItem.innerHTML = `
                <div class="webhook-info">
                    <div class="webhook-name">${webhook.name}</div>
                    <div class="webhook-url">${webhook.url}</div>
                    <div class="webhook-event"><span class="event-badge">${webhook.event}</span></div>
                </div>
                <div class="webhook-actions">
                    <button class="icon-btn webhook-action-btn" data-action="test" data-webhook-id="${webhook.id}" title="Test Webhook">
                        <i class="fas fa-vial"></i>
                    </button>
                    <button class="icon-btn webhook-action-btn" data-action="delete" data-webhook-id="${webhook.id}" title="Delete Webhook">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            webhookList.appendChild(webhookItem);
        }
        
        // Re-attach event listeners
        this.setupFormHandlers();
    }
    
    /**
     * Add a new webhook
     */
    async addWebhook() {
        const nameInput = document.getElementById('webhook-name');
        const urlInput = document.getElementById('webhook-url');
        const eventSelect = document.getElementById('webhook-event');
        
        if (!nameInput || !urlInput || !eventSelect) {
            this.showMessage('Webhook form elements not found', 'error');
            return;
        }
        
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const event = eventSelect.value;
        
        if (!name || !url || !event) {
            this.showMessage('Please fill in all webhook fields', 'error');
            return;
        }
        
        try {
            const newWebhook = await apiService.createWebhook({ name, url, event });
            
            // Add to local list
            this.webhooks.push(newWebhook);
            
            // Update UI
            this.updateWebhookList();
            
            // Clear form
            nameInput.value = '';
            urlInput.value = '';
            eventSelect.selectedIndex = 0;
            
            this.showMessage(`Webhook "${name}" created successfully!`, 'success');
        } catch (error) {
            console.error('Failed to create webhook:', error);
            this.showMessage('Failed to create webhook', 'error');
        }
    }
    
    /**
     * Delete a webhook
     * @param {string} webhookId - ID of the webhook to delete
     */
    async deleteWebhook(webhookId) {
        if (!confirm('Are you sure you want to delete this webhook?')) {
            return;
        }
        
        try {
            await apiService.deleteWebhook(webhookId);
            
            // Remove from local list
            this.webhooks = this.webhooks.filter(webhook => webhook.id !== webhookId);
            
            // Update UI
            this.updateWebhookList();
            
            this.showMessage('Webhook deleted successfully!', 'success');
        } catch (error) {
            console.error('Failed to delete webhook:', error);
            this.showMessage('Failed to delete webhook', 'error');
        }
    }
    
    /**
     * Test a specific webhook
     * @param {string} webhookId - ID of the webhook to test
     */
    async testWebhook(webhookId) {
        try {
            const webhook = this.webhooks.find(wh => wh.id === webhookId);
            if (!webhook) {
                throw new Error('Webhook not found');
            }
            
            const result = await apiService.testWebhook(webhookId);
            this.showMessage(`Test successful for webhook "${webhook.name}"!`, 'success');
        } catch (error) {
            console.error('Failed to test webhook:', error);
            this.showMessage(`Failed to test webhook: ${error.message || 'Unknown error'}`, 'error');
        }
    }
    
    /**
     * Test webhook connection from form
     */
    async testWebhookConnection() {
        const urlInput = document.getElementById('webhook-url');
        if (!urlInput || !urlInput.value.trim()) {
            this.showMessage('Please enter a webhook URL to test', 'error');
            return;
        }
        
        const url = urlInput.value.trim();
        
        try {
            const result = await apiService.testWebhookConnection(url);
            this.showMessage('Webhook connection test successful!', 'success');
        } catch (error) {
            console.error('Failed to test webhook connection:', error);
            this.showMessage(`Failed to test webhook connection: ${error.message || 'Unknown error'}`, 'error');
        }
    }
}
