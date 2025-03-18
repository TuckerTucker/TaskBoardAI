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
 */

/**
 * @typedef {Object} BoardCard
 * @property {string} id - Unique identifier for the card
 * @property {string} title - Title of the card
 * @property {string} [content] - Markdown content for the card description
 * @property {string} columnId - ID of the column this card belongs to
 * @property {number} position - Position within the column (0-indexed)
 * @property {boolean} [collapsed=false] - Whether the card is collapsed
 * @property {Array<string>} [subtasks] - List of subtasks
 * @property {Array<string>} [tags] - List of tags
 * @property {Array<string>} [dependencies] - List of dependent card IDs
 * @property {string} [created_at] - ISO timestamp when card was created
 * @property {string} [updated_at] - ISO timestamp of last card update
 * @property {string} [completed_at] - ISO timestamp when card was completed
 * @property {string} [blocked_at] - ISO timestamp when card was blocked
 */

/**
 * @typedef {string} BoardFormat
 * Supported formats for board data retrieval:
 * - 'full': Complete board data with all details (default)
 * - 'summary': Metadata and column structure with card counts and statistics
 * - 'compact': Shortened property names and essential card data only
 * - 'cards-only': Returns just the cards array without board metadata
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
     * @returns {Promise<Array<{id: string, name: string, lastUpdated: string}>>} Array of simplified board objects with id, name and lastUpdated
     */
    static async list() {
        await ensureBoardsDir();
        
        try {
            // Get all files in the boards directory
            const files = await fs.readdir(config.boardsDir);
            console.log('Files in boards directory:', files);
            
            const boards = [];
            
            // Process each file
            for (const file of files) {
                // Skip files that don't match our criteria
                if (!file.endsWith('.json') || file.startsWith('_') || file === 'config.json') {
                    continue;
                }
                
                try {
                    // Check if it's a directory (async)
                    const filePath = path.join(config.boardsDir, file);
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory && stats.isDirectory()) {
                        continue; // Skip directories
                    }
                    
                    // Read and parse the board file
                    const data = await fs.readFile(filePath, 'utf8');
                    const boardData = JSON.parse(data);
                    
                    // Get the file's last modification date if no lastUpdated field exists
                    let lastUpdated = boardData.last_updated;
                    
                    // If no last_updated field, try to get file modification time as fallback
                    try {
                        if (!lastUpdated) {
                            lastUpdated = stats.mtime.toISOString();
                        }
                    } catch (statErr) {
                        // If stats fail, use current time
                        console.error(`Error getting file stats for ${file}:`, statErr);
                        lastUpdated = new Date().toISOString();
                    }
                    
                    // Include id, name, and lastUpdated for the output
                    boards.push({
                        id: boardData.id || path.basename(file, '.json'),
                        name: boardData.projectName || 'Unnamed Board',
                        lastUpdated: lastUpdated || new Date().toISOString() // Ensure we always have a date
                    });
                } catch (err) {
                    console.error(`Error reading board file ${file}:`, err);
                    // Skip this file and continue
                }
            }
            
            // Sort boards alphabetically by name for easier viewing
            boards.sort((a, b) => a.name.localeCompare(b.name));
            
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
     * @param {boolean} includeTemplate - Whether to include template documentation
     * @returns {Promise<Object>} Summary of the created board or full template with documentation
     */
    static async create(name, includeTemplate = false) {
        await ensureBoardsDir();
        
        const boardId = crypto.randomUUID();
        
        // Read the example template
        try {
            const templatePath = path.join(config.templateBoardsDir, '_kanban_example.json');
            const templateData = JSON.parse(await fs.readFile(templatePath, 'utf8'));
            
            // Create new board data with the template structure but user-provided name
            const boardData = {
                ...templateData,
                id: boardId,
                projectName: name,
                last_updated: new Date().toISOString()
            };
            
            const board = new Board(boardData, path.join(config.boardsDir, `${boardId}.json`));
            await board.save();
            
            if (includeTemplate) {
                // If template documentation is requested, read the documented example
                try {
                    const docPath = path.join(config.templateBoardsDir, '_kanban_example_doc.md');
                    const docContent = await fs.readFile(docPath, 'utf8');
                    
                    return {
                        id: boardId,
                        name: name,
                        lastUpdated: board.data.last_updated,
                        templateDoc: docContent,
                        fullTemplate: boardData
                    };
                } catch (docError) {
                    console.error('Error reading template documentation:', docError);
                }
            }
            
            // Return basic board info if no template requested or if loading template failed
            return {
                id: boardId,
                name: name,
                lastUpdated: board.data.last_updated
            };
        } catch (error) {
            console.error('Error reading board template:', error);
            
            // Fallback to empty board if template can't be loaded
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

        // Handle completion timestamps for card-first architecture
        if (this.data.columns && this.data.cards) {
            const doneColumns = this.data.columns
                .filter(column => column.name.toLowerCase() === 'done')
                .map(column => column.id);
                
            for (const card of this.data.cards) {
                if (doneColumns.includes(card.columnId)) {
                    // Set completed_at timestamp if card is in a Done column
                    if (!card.completed_at) {
                        card.completed_at = new Date().toISOString();
                    }
                } else {
                    // Remove completion timestamp if not in a Done column
                    card.completed_at = null;
                }
            }
        }
        
        // Legacy support for column-based architecture
        if (this.data.columns && !this.data.cards) {
            for (const column of this.data.columns) {
                if (column.items && Array.isArray(column.items)) {
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
        const basicValidation = (
            this.data &&
            typeof this.data === 'object' &&
            typeof this.data.projectName === 'string' &&
            Array.isArray(this.data.columns) &&
            this.data.columns.every(this.validateColumn) &&
            (this.data.id === undefined || typeof this.data.id === 'string') &&
            (this.data.description === undefined || typeof this.data.description === 'string') &&
            (this.data.last_updated === undefined || !Number.isNaN(new Date(this.data.last_updated).getTime()))
        );
        
        // Check if it's using the card-first architecture
        if (Array.isArray(this.data.cards)) {
            return basicValidation && this.data.cards.every(Board.validateItem);
        }
        
        // Legacy column-based architecture
        return basicValidation;
    }

    /**
     * Validate a column object
     * @param {BoardColumn} column - The column to validate
     * @returns {boolean} True if the column is valid
     */
    validateColumn(column) {
        // For card-first architecture
        if (column &&
            typeof column === 'object' &&
            typeof column.id === 'string' &&
            typeof column.name === 'string') {
            return true;
        }
        
        // Legacy support for column-based architecture
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
     * @param {BoardItem|BoardCard} item - The item/card to validate
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
        
        // Card-first architecture specific fields
        if (item.columnId !== undefined && typeof item.columnId !== 'string') return false;
        if (item.position !== undefined && typeof item.position !== 'number') return false;
        
        // Timestamp validations
        const timestampFields = ['created_at', 'updated_at', 'completed_at', 'blocked_at'];
        for (const field of timestampFields) {
            if (item[field] !== undefined && item[field] !== null) {
                const timestamp = new Date(item[field]);
                if (Number.isNaN(timestamp.getTime())) return false;
            }
        }

        // Array fields validation
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

        return true;
    }

    /**
     * Transform board data to specified format for token-optimized operations.
     * Different formats allow for obtaining only the necessary data for specific operations,
     * significantly reducing token usage for large boards.
     * 
     * @param {BoardFormat} [format='full'] - Format to transform board data to:
     *   - 'full': Complete board data with all details (default)
     *   - 'summary': Basic board metadata and statistics
     *   - 'compact': Abbreviated board representation with shortened property names
     *   - 'cards-only': Only returns the cards array, optionally filtered by column
     * 
     * @param {Object} [options={}] - Additional options for formatting
     * @param {string} [options.columnId] - When using 'cards-only' format, filter cards by this column ID
     * 
     * @returns {Object} Transformed board data
     * 
     * @example
     * // Get only cards from a specific column (token-optimized)
     * const todoColumnCards = board.format('cards-only', { columnId: 'col-123' });
     */
    format(format = 'full', options = {}) {
        switch (format) {
            case 'summary':
                return this.toSummaryFormat();
            case 'compact':
                return this.toCompactFormat();
            case 'cards-only':
                return this.toCardsOnlyFormat(options.columnId);
            case 'full':
            default:
                return this.data;
        }
    }

    /**
     * Transform board data to summary format for token-optimized retrieval.
     * This format provides metadata and statistics about the board without including
     * full card content, significantly reducing token usage.
     * 
     * @returns {Object} Summary format containing:
     *   - Basic board metadata (id, name, last_updated)
     *   - Column information with card counts
     *   - Statistics (total cards, completed cards, progress percentage)
     * 
     * @example
     * // Get board summary without loading all card content
     * const boardSummary = board.toSummaryFormat();
     * console.log(`Progress: ${boardSummary.stats.progressPercentage}%`);
     */
    toSummaryFormat() {
        const { id, projectName, columns, cards, last_updated } = this.data;
        
        // Get card statistics
        const cardCount = cards ? cards.length : 0;
        let completedCount = 0;
        const cardsByColumn = {};
        
        // Initialize cardsByColumn with column IDs
        if (columns) {
            columns.forEach(column => {
                cardsByColumn[column.id] = 0;
            });
        }
        
        // Count cards per column and completed cards
        if (cards) {
            cards.forEach(card => {
                // Increment column count
                if (cardsByColumn[card.columnId] !== undefined) {
                    cardsByColumn[card.columnId]++;
                }
                
                // Count completed cards
                if (card.completed_at) {
                    completedCount++;
                }
            });
        }
        
        return {
            id,
            projectName,
            last_updated,
            columns: columns ? columns.map(column => ({
                id: column.id,
                name: column.name,
                cardCount: cardsByColumn[column.id] || 0
            })) : [],
            stats: {
                totalCards: cardCount,
                completedCards: completedCount,
                progressPercentage: cardCount > 0 ? Math.round((completedCount / cardCount) * 100) : 0
            }
        };
    }

    /**
     * Transform board data to compact format for maximized token efficiency.
     * Uses abbreviated property names and omits optional properties when empty,
     * resulting in significantly smaller JSON payloads.
     * 
     * @returns {Object} Compact format with:
     *   - Shortened property names (id, name→n, columns→cols, etc.)
     *   - Minimal card representation (title→t, columnId→col, position→p)
     *   - Optional properties omitted when empty
     * 
     * @example
     * // Property mapping examples:
     * // - projectName → name
     * // - last_updated → up
     * // - columnId → col
     * // - position → p
     * // - content → c
     * // - completed_at → comp
     * 
     * // Get token-efficient compact representation of the board
     * const compactBoard = board.toCompactFormat();
     */
    toCompactFormat() {
        const { id, projectName, columns, cards, last_updated } = this.data;
        
        // Transform cards to more compact representation
        const compactCards = cards ? cards.map(card => ({
            id: card.id,
            t: card.title,
            col: card.columnId,
            p: card.position,
            // Only include other properties if they exist
            ...(card.content ? { c: card.content } : {}),
            ...(card.collapsed ? { coll: card.collapsed } : {}),
            ...(card.subtasks && card.subtasks.length ? { sub: card.subtasks } : {}),
            ...(card.tags && card.tags.length ? { tag: card.tags } : {}),
            ...(card.dependencies && card.dependencies.length ? { dep: card.dependencies } : {}),
            ...(card.created_at ? { ca: card.created_at } : {}),
            ...(card.updated_at ? { ua: card.updated_at } : {}),
            ...(card.completed_at ? { comp: card.completed_at } : {})
        })) : [];
        
        // Return compact representation
        return {
            id,
            name: projectName,
            up: last_updated,
            cols: columns ? columns.map(col => ({ id: col.id, n: col.name })) : [],
            cards: compactCards
        };
    }

    /**
     * Transform board data to cards-only format for maximum token efficiency.
     * This format is specifically designed to optimize token usage when only
     * card data is needed, without column definitions or other board metadata.
     * 
     * @param {string} [columnId] - Optional column ID to filter cards by
     * @returns {Object} Cards-only format data containing just the cards array
     * 
     * @example
     * // Get only cards in the "Done" column
     * const doneCards = board.toCardsOnlyFormat('col-done');
     * 
     * @example
     * // Get all cards regardless of column
     * const allCards = board.toCardsOnlyFormat();
     */
    toCardsOnlyFormat(columnId) {
        if (!this.data.cards) {
            return { cards: [] };
        }
        
        // Filter cards by column if specified
        let filteredCards = this.data.cards;
        if (columnId) {
            filteredCards = this.data.cards.filter(card => card.columnId === columnId);
        }
        
        return { 
            cards: filteredCards
        };
    }
}

module.exports = Board;