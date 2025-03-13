const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config/config');
const { ensureBoardsDir } = require('../utils/fileSystem');

/**
 * @fileoverview Board model that handles all kanban board operations.
 * @module models/Board
 * @requires node:fs
 * @requires node:path
 * @requires node:crypto
 * @requires ../config/config
 * @requires ../utils/fileSystem
 */

/**
 * @typedef {Object} BoardSummary
 * @property {string} id - Unique identifier for the board
 * @property {string} name - Display name of the board
 * @property {string} lastUpdated - ISO timestamp of last update
 */

/**
 * @typedef {Object} BoardColumn
 * @property {string} id - Unique identifier for the column
 * @property {string} name - Display name of the column
 * @property {Array<BoardItem>} items - Array of items in this column
 */

/**
 * @typedef {Object} BoardItem
 * @property {string} id - Unique identifier for the item
 * @property {string} title - Title of the item
 * @property {string} [content] - Markdown content for the item
 * @property {boolean} [collapsed=false] - Whether the item is collapsed
 * @property {Array<string>} [subtasks] - List of subtasks
 * @property {Array<string>} [tags] - List of tags
 * @property {Array<string>} [dependencies] - List of dependent item IDs
 * @property {string} [completed_at] - ISO timestamp when item was completed
 */

/**
 * Class representing a Kanban board
 * @class
 * @category Models
 */
class Board {
    /**
     * Create a Board instance
     * @param {Object} data - The board data
     * @param {string} [filePath=null] - Path to the board's JSON file
     */
    constructor(data = null, filePath = null) {
        this.data = data || {
            id: crypto.randomUUID(),
            projectName: 'My Kanban Board',
            columns: []
        };
        this.filePath = filePath;
    }

    /**
     * Load a board from file
     * @static
     * @async
     * @param {string} [boardId=null] - ID of the board to load (if null, loads default board)
     * @returns {Promise<Board>} The loaded board instance
     * @throws {Error} If the board is not found or cannot be loaded
     */
    static async load(boardId = null) {
        try {
            // If no boardId is provided, load the default board
            const filePath = boardId 
                ? path.join(config.boardsDir, `${boardId}.json`)
                : config.dataFile;
                
            const data = await fs.readFile(filePath, 'utf8');
            return new Board(JSON.parse(data), filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (boardId) {
                    throw new Error(`Board with ID ${boardId} not found`);
                }
                // Return default board if file doesn't exist
                const board = new Board(null, config.dataFile);
                await board.save();
                return board;
            }
            throw error;
        }
    }
    
    /**
     * Get a list of all available boards
     * @static
     * @async
     * @returns {Promise<Array<BoardSummary>>} Array of board summary objects
     */
    static async list() {
        await ensureBoardsDir();
        
        try {
            const files = await fs.readdir(config.boardsDir);
            const boardFiles = files.filter(file => file.endsWith('.json'));
            
            const boards = [];
            
            for (const file of boardFiles) {
                try {
                    const filePath = path.join(config.boardsDir, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const boardData = JSON.parse(data);
                    
                    boards.push({
                        id: boardData.id || path.basename(file, '.json'),
                        name: boardData.projectName || 'Unnamed Board',
                        lastUpdated: boardData.last_updated || null
                    });
                } catch (err) {
                    console.error(`Error reading board file ${file}:`, err);
                    // Skip this file and continue
                }
            }
            
            return boards;
        } catch (error) {
            console.error('Error listing boards:', error);
            return [];
        }
    }
    
    /**
     * Create a new board
     * @static
     * @async
     * @param {string} name - Name for the new board
     * @returns {Promise<BoardSummary>} Summary of the created board
     */
    static async create(name) {
        await ensureBoardsDir();
        
        const boardId = crypto.randomUUID();
        const board = new Board({
            id: boardId,
            projectName: name,
            columns: [],
            last_updated: new Date().toISOString()
        }, path.join(config.boardsDir, `${boardId}.json`));
        
        await board.save();
        
        return {
            id: boardId,
            name: name,
            lastUpdated: board.data.last_updated
        };
    }

    /**
     * Save the board to its file
     * @async
     * @returns {Promise<void>}
     */
    async save() {
        // Ensure board has an ID
        if (!this.data.id) {
            this.data.id = crypto.randomUUID();
        }
        
        // Update last_updated timestamp
        this.data.last_updated = new Date().toISOString();

        // Handle completion timestamps
        if (this.data.columns) {
            for (const column of this.data.columns) {
                if (column.name.toLowerCase() === 'done') {
                    for (const item of column.items) {
                        if (!item.completed_at) {
                            item.completed_at = new Date().toISOString();
                        }
                    }
                } else {
                    // Remove completion timestamp if moved out of Done
                    for (const item of column.items) {
                        // Set to null instead of using delete operator
                        item.completed_at = null;
                    }
                }
            }
        }

        // Determine file path
        const filePath = this.filePath || path.join(config.boardsDir, `${this.data.id}.json`);
        
        // Ensure the directory exists
        await ensureBoardsDir();
        
        // Write file
        await fs.writeFile(filePath, JSON.stringify(this.data, null, 2));
    }
    
    /**
     * Delete a board
     * @static
     * @async
     * @param {string} boardId - ID of the board to delete
     * @returns {Promise<Object>} Result of the delete operation
     * @throws {Error} If the board is not found or cannot be deleted
     */
    static async delete(boardId) {
        if (!boardId) {
            throw new Error('Board ID is required');
        }
        
        const filePath = path.join(config.boardsDir, `${boardId}.json`);
        
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            return { success: true, message: 'Board deleted successfully' };
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Board with ID ${boardId} not found`);
            }
            throw error;
        }
    }
    
    /**
     * Import a board from external data
     * @static
     * @async
     * @param {Object} boardData - Complete board data to import
     * @returns {Promise<BoardSummary>} Summary of the imported board
     * @throws {Error} If the board data is invalid
     */
    static async import(boardData) {
        // Validate the board data
        const board = new Board(boardData);
        if (!board.validate()) {
            throw new Error('Invalid board data format');
        }
        
        // Ensure board has an ID
        if (!board.data.id) {
            board.data.id = crypto.randomUUID();
        }
        
        // Set file path
        board.filePath = path.join(config.boardsDir, `${board.data.id}.json`);
        
        // Save the board
        await board.save();
        
        return {
            id: board.data.id,
            name: board.data.projectName,
            lastUpdated: board.data.last_updated
        };
    }

    /**
     * Validate board data structure
     * @returns {boolean} True if the board data is valid
     */
    validate() {
        return (
            this.data &&
            typeof this.data === 'object' &&
            typeof this.data.projectName === 'string' &&
            Array.isArray(this.data.columns) &&
            this.data.columns.every(this.validateColumn) &&
            (this.data.id === undefined || typeof this.data.id === 'string') &&
            (this.data.description === undefined || typeof this.data.description === 'string') &&
            (this.data.last_updated === undefined || !Number.isNaN(new Date(this.data.last_updated).getTime()))
        );
    }

    /**
     * Validate a column object
     * @param {BoardColumn} column - The column to validate
     * @returns {boolean} True if the column is valid
     */
    validateColumn(column) {
        return (
            column &&
            typeof column === 'object' &&
            typeof column.id === 'string' &&
            typeof column.name === 'string' &&
            Array.isArray(column.items) &&
            column.items.every(Board.validateItem)
        );
    }

    /**
     * Validate a board item object
     * @static
     * @param {BoardItem} item - The item to validate
     * @returns {boolean} True if the item is valid
     */
    static validateItem(item) {
        if (!item || typeof item !== 'object') return false;
        if (!item.id || typeof item.id !== 'string') return false;
        if (!item.title || typeof item.title !== 'string') return false;
        if (typeof item.collapsed !== 'boolean' && item.collapsed !== undefined) return false;

        // Content/description validation
        if (item.content && typeof item.content !== 'string') return false;
        if (item.description && typeof item.description !== 'string') return false;

        // V2.1 fields validation
        if (item.subtasks !== undefined) {
            if (!Array.isArray(item.subtasks)) return false;
            if (!item.subtasks.every(task => typeof task === 'string')) return false;
        }

        if (item.tags !== undefined) {
            if (!Array.isArray(item.tags)) return false;
            if (!item.tags.every(tag => typeof tag === 'string')) return false;
        }

        if (item.dependencies !== undefined) {
            if (!Array.isArray(item.dependencies)) return false;
            if (!item.dependencies.every(dep => typeof dep === 'string')) return false;
        }

        if (item.completed_at !== undefined) {
            const timestamp = new Date(item.completed_at);
            if (Number.isNaN(timestamp.getTime())) return false;
        }

        return true;
    }
}

module.exports = Board;
