/**
 * API Service
 * Handles all API interactions with the server
 */

class ApiService {
    constructor() {
        this.baseUrl = '/api';
    }

    /**
     * Load board data from server
     * @returns {Promise<Object>} Board data
     */
    async loadBoard() {
        try {
            const response = await fetch(`${this.baseUrl}/kanban`);
            if (!response.ok) {
                throw new Error('Failed to load board data');
            }
            return await response.json();
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
}

// Create and export singleton instance
export const apiService = new ApiService();
