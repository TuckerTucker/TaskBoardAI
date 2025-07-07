/**
 * API Service
 * Handles all API interactions with the server
 */

class ApiService {
    constructor() {
        this.baseUrl = '/api';
        this.configPath = '/config';
        this.boardsPath = '/boards';
        this.webhooksPath = '/webhooks';
        this.archivesPath = '/archives';
    }

    /**
     * Load board data from server
     * @param {string|Object} boardId - ID of the board to load (optional) or board object
     * @param {Object} [options] - Additional options for loading the board
     * @param {string} [options.format='full'] - Format to return the board data in ('full', 'summary', 'compact', 'cards-only')
     * @param {string} [options.columnId] - Filter cards by column ID (only used with 'cards-only' format)
     * @returns {Promise<Object>} Board data
     */
    async loadBoard(boardId, options = {}) {
        try {
            // If boardId is an object, return it directly
            if (typeof boardId === 'object' && boardId !== null) {
                console.log('Board object provided directly, skipping API call');
                return boardId;
            }
            
            // Make sure boardId is properly encoded if it's a string
            let url;
            if (boardId && typeof boardId === 'string' && boardId.trim() !== '') {
                url = `${this.baseUrl}${this.boardsPath}/${encodeURIComponent(boardId.trim())}`;
            } else {
                url = `${this.baseUrl}/kanban`;
            }
            
            // Add query parameters for format and columnId if provided
            const params = new URLSearchParams();
            if (options.format) {
                params.append('format', options.format);
            }
            if (options.columnId) {
                params.append('columnId', options.columnId);
            }
            
            // Append parameters to URL if any exist
            const queryString = params.toString();
            if (queryString) {
                url = `${url}?${queryString}`;
            }
                
            console.log(`Attempting to load board from: ${url}`);
            
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`Failed to load board data: ${response.status} ${response.statusText}`);
                }
                
                // Check if response is empty
                const text = await response.text();
                if (!text || text.trim() === '') {
                    throw new Error('Empty response received from server');
                }
                
                // Try to parse JSON
                try {
                    return JSON.parse(text);
                } catch (parseError) {
                    console.error('JSON parse error:', parseError, 'Response text:', text);
                    throw new Error(`Invalid JSON response: ${parseError.message}`);
                }
            } catch (fetchError) {
                if (fetchError.name === 'AbortError') {
                    throw new Error('Request timed out. Server may be unavailable.');
                }
                throw fetchError;
            }
        } catch (error) {
            console.error('Error loading board:', error);
            throw error;
        }
    }

    /**
     * Save board data to server
     * @param {Object} data Board data to save
     * @returns {Promise<Object>} Response data
     */
    async saveBoard(data) {
        try {
            const response = await fetch(`${this.baseUrl}/kanban`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            
            if (!response.ok) {
                throw new Error('Failed to save board data');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving board:', error);
            throw error;
        }
    }

    /**
     * Get board info from server
     * @returns {Promise<Object>} Board info
     */
    async getBoardInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/boardinfo`);
            if (!response.ok) {
                throw new Error('Failed to load board info');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading board info:', error);
            throw error;
        }
    }
    
    /**
     * Get list of available boards
     * @returns {Promise<Array>} List of boards
     */
    async getBoards() {
        try {
            const response = await fetch(`${this.baseUrl}${this.boardsPath}`);
            if (!response.ok) {
                throw new Error('Failed to load boards list');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading boards:', error);
            // Return empty array as fallback
            return [];
        }
    }
    
    /**
     * Create a new board
     * @param {string} name - Name of the new board
     * @returns {Promise<Object>} New board data
     */
    async createBoard(name) {
        try {
            const response = await fetch(`${this.baseUrl}${this.boardsPath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create board');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating board:', error);
            throw error;
        }
    }
    
    /**
     * Delete a board
     * @param {string} boardId - ID of the board to delete
     * @returns {Promise<Object>} Response data
     */
    async deleteBoard(boardId) {
        try {
            const response = await fetch(`${this.baseUrl}${this.boardsPath}/${boardId}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete board');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting board:', error);
            throw error;
        }
    }
    
    /**
     * Import a board from JSON data
     * @param {Object} boardData - Board data to import
     * @returns {Promise<Object>} Imported board data
     */
    async importBoard(boardData) {
        try {
            const response = await fetch(`${this.baseUrl}${this.boardsPath}/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(boardData),
            });
            
            if (!response.ok) {
                throw new Error('Failed to import board');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error importing board:', error);
            throw error;
        }
    }
    
    /**
     * Load configuration from server
     * @returns {Promise<Object>} Configuration data
     */
    async loadConfig() {
        try {
            const response = await fetch(`${this.baseUrl}${this.configPath}`);
            if (!response.ok) {
                throw new Error('Failed to load configuration');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading configuration:', error);
            // Return default config as fallback
            return {
                theme: 'light',
                dataStorage: 'local',
                serverOptions: {
                    apiEndpoint: '/api',
                    autoSave: true
                }
            };
        }
    }
    
    /**
     * Save configuration to server
     * @param {Object} config - Configuration data to save
     * @returns {Promise<Object>} Response data
     */
    async saveConfig(config) {
        try {
            const response = await fetch(`${this.baseUrl}${this.configPath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config),
            });
            
            if (!response.ok) {
                throw new Error('Failed to save configuration');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving configuration:', error);
            throw error;
        }
    }

    /**
     * Get list of configured webhooks
     * @returns {Promise<Array>} List of webhooks
     */
    async getWebhooks() {
        try {
            const response = await fetch(`${this.baseUrl}${this.webhooksPath}`);
            if (!response.ok) {
                throw new Error('Failed to load webhooks list');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading webhooks:', error);
            // Return empty array as fallback
            return [];
        }
    }
    
    /**
     * Create a new webhook
     * @param {Object} webhookData - Webhook data (name, url, event)
     * @returns {Promise<Object>} New webhook data
     */
    async createWebhook(webhookData) {
        try {
            const response = await fetch(`${this.baseUrl}${this.webhooksPath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookData),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create webhook');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating webhook:', error);
            throw error;
        }
    }
    
    /**
     * Delete a webhook
     * @param {string} webhookId - ID of the webhook to delete
     * @returns {Promise<Object>} Response data
     */
    async deleteWebhook(webhookId) {
        try {
            const response = await fetch(`${this.baseUrl}${this.webhooksPath}/${webhookId}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete webhook');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error deleting webhook:', error);
            throw error;
        }
    }
    
    /**
     * Test a specific webhook
     * @param {string} webhookId - ID of the webhook to test
     * @returns {Promise<Object>} Test result
     */
    async testWebhook(webhookId) {
        try {
            const response = await fetch(`${this.baseUrl}${this.webhooksPath}/${webhookId}/test`, {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error('Failed to test webhook');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error testing webhook:', error);
            throw error;
        }
    }
    
    /**
     * Test a webhook connection
     * @param {string} url - URL to test
     * @returns {Promise<Object>} Test result
     */
    async testWebhookConnection(url) {
        try {
            const response = await fetch(`${this.baseUrl}${this.webhooksPath}/test-connection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to test webhook connection');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error testing webhook connection:', error);
            throw error;
        }
    }
    
    /**
     * Get list of archived boards
     * @returns {Promise<Array>} List of archived boards
     */
    async getArchivedBoards() {
        try {
            const response = await fetch(`${this.baseUrl}${this.archivesPath}`);
            if (!response.ok) {
                throw new Error('Failed to load archived boards list');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading archived boards:', error);
            // Return empty array as fallback
            return [];
        }
    }
    
    /**
     * Archive a board
     * @param {string} boardId - ID of the board to archive
     * @returns {Promise<Object>} Response data
     */
    async archiveBoard(boardId) {
        try {
            const response = await fetch(`${this.baseUrl}${this.boardsPath}/${boardId}/archive`, {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error('Failed to archive board');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error archiving board:', error);
            throw error;
        }
    }
    
    /**
     * Restore a board from archive
     * @param {string} archiveId - ID of the archived board to restore
     * @returns {Promise<Object>} Restored board data
     */
    async restoreArchivedBoard(archiveId) {
        try {
            const response = await fetch(`${this.baseUrl}${this.archivesPath}/${archiveId}/restore`, {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error('Failed to restore archived board');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error restoring archived board:', error);
            throw error;
        }
    }
}

// Create and export singleton instance
export const apiService = new ApiService();
