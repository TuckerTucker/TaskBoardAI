/**
 * @fileoverview Controller handling board-related API endpoints
 * @module controllers/boardController
 * @requires ../models/Board
 * @requires ../config/config
 * @requires node:path
 */

const Board = require('../models/Board');
const config = require('../config/config');
const path = require('node:path');

/**
 * Get information about the current board file configuration
 * @function getBoardInfo
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getBoardInfo = (req, res) => {
    res.json({
        boardFile: config.boardFile,
        fullPath: config.dataFile
    });
};

/**
 * Get the default board data
 * @async
 * @function getBoard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} [req.query.format='full'] - Format to return the board data in ('full', 'summary', 'compact', 'cards-only')
 * @param {string} [req.query.columnId] - Filter cards by column ID (only used with 'cards-only' format)
 */
exports.getBoard = async (req, res) => {
    try {
        const format = req.query.format || 'full';
        const columnId = req.query.columnId;
        const options = { columnId };
        
        const board = await Board.load();
        const formattedData = board.format(format, options);
        
        res.json(formattedData);
    } catch (error) {
        console.error('Error reading board data:', error);
        res.status(500).json({ error: 'Failed to read board data' });
    }
};

/**
 * Get a specific board by ID
 * @async
 * @function getBoardById
 * @param {Object} req - Express request object with board ID in params
 * @param {Object} res - Express response object
 * @param {string} [req.query.format='full'] - Format to return the board data in ('full', 'summary', 'compact', 'cards-only')
 * @param {string} [req.query.columnId] - Filter cards by column ID (only used with 'cards-only' format)
 */
exports.getBoardById = async (req, res) => {
    try {
        const boardId = req.params.id;
        const format = req.query.format || 'full';
        const columnId = req.query.columnId;
        const options = { columnId };
        
        const board = await Board.load(boardId);
        const formattedData = board.format(format, options);
        
        res.json(formattedData);
    } catch (error) {
        console.error(`Error reading board ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Board not found' });
    }
};

/**
 * Get a list of all available boards
 * @async
 * @function getBoards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getBoards = async (req, res) => {
    try {
        const boards = await Board.list();
        res.json(boards);
    } catch (error) {
        console.error('Error listing boards:', error);
        res.status(500).json({ error: 'Failed to list boards' });
    }
};

/**
 * Create a new board
 * @async
 * @function createBoard
 * @param {Object} req - Express request object with board name in body
 * @param {Object} res - Express response object
 */
exports.createBoard = async (req, res) => {
    try {
        const { name, includeTemplate } = req.body;
        
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'Board name is required' });
        }
        
        const board = await Board.create(name.trim(), includeTemplate === true);
        res.status(201).json(board);
    } catch (error) {
        console.error('Error creating board:', error);
        res.status(500).json({ error: 'Failed to create board' });
    }
};

/**
 * Delete a board by ID
 * @async
 * @function deleteBoard
 * @param {Object} req - Express request object with board ID in params
 * @param {Object} res - Express response object
 */
exports.deleteBoard = async (req, res) => {
    try {
        const boardId = req.params.id;
        const result = await Board.delete(boardId);
        res.json(result);
    } catch (error) {
        console.error(`Error deleting board ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Failed to delete board' });
    }
};

/**
 * Import a board from provided data
 * @async
 * @function importBoard
 * @param {Object} req - Express request object with board data in body
 * @param {Object} res - Express response object
 */
exports.importBoard = async (req, res) => {
    try {
        const boardData = req.body;
        
        if (!boardData || typeof boardData !== 'object') {
            return res.status(400).json({ error: 'Invalid board data' });
        }
        
        const board = await Board.import(boardData);
        res.status(201).json(board);
    } catch (error) {
        console.error('Error importing board:', error);
        res.status(400).json({ error: error.message || 'Failed to import board' });
    }
};

/**
 * Update an existing board
 * @async
 * @function updateBoard
 * @param {Object} req - Express request object with updated board data in body
 * @param {Object} res - Express response object
 */
exports.updateBoard = async (req, res) => {
    try {
        const board = new Board(req.body);
        
        // Validate board data
        if (!board.validate()) {
            return res.status(400).json({ error: 'Invalid board data format' });
        }

        // Save board
        await board.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving board data:', error);
        res.status(500).json({ error: 'Failed to save board data' });
    }
};

/**
 * Archive a board
 * @async
 * @function archiveBoard
 * @param {Object} req - Express request object with board ID in params
 * @param {Object} res - Express response object
 */
exports.archiveBoard = async (req, res) => {
    try {
        const boardId = req.params.id;
        const result = await Board.archive(boardId);
        res.json(result);
    } catch (error) {
        console.error(`Error archiving board ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Failed to archive board' });
    }
};

/**
 * Get list of archived boards
 * @async
 * @function getArchivedBoards
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getArchivedBoards = async (req, res) => {
    try {
        const archives = await Board.listArchives();
        res.json(archives);
    } catch (error) {
        console.error('Error listing archived boards:', error);
        res.status(500).json({ error: 'Failed to list archived boards' });
    }
};

/**
 * Restore a board from archive
 * @async
 * @function restoreArchivedBoard
 * @param {Object} req - Express request object with archive ID in params
 * @param {Object} res - Express response object
 */
exports.restoreArchivedBoard = async (req, res) => {
    try {
        const archiveId = req.params.id;
        const result = await Board.restore(archiveId);
        res.json(result);
    } catch (error) {
        console.error(`Error restoring board ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Failed to restore board' });
    }
};

/**
 * Query boards with filtering, sorting, and pagination
 * @async
 * @function queryBoards
 * @param {Object} req - Express request object with query parameters
 * @param {Object} res - Express response object
 */
exports.queryBoards = async (req, res) => {
    try {
        const fs = require('node:fs').promises;
        const path = require('node:path');
        
        // Get all boards first
        const boardsDir = config.boardsDir;
        const files = await fs.readdir(boardsDir);
        const boardFiles = files.filter(file =>
            file.endsWith('.json') &&
            !file.startsWith('_') &&
            file !== 'config.json'
        );

        let boards = [];

        for (const file of boardFiles) {
            try {
                const filePath = path.join(boardsDir, file);
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) continue;

                const data = await fs.readFile(filePath, 'utf8');
                const boardData = JSON.parse(data);

                let lastUpdated = boardData.last_updated;
                if (!lastUpdated) lastUpdated = stats.mtime.toISOString();

                boards.push({
                    id: boardData.id || path.basename(file, '.json'),
                    title: boardData.projectName || 'Unnamed Board',
                    createdAt: boardData.created_at || stats.birthtime.toISOString(),
                    updatedAt: lastUpdated || new Date().toISOString(),
                    tags: boardData.tags || [],
                    cardCount: boardData.cards ? boardData.cards.length : 0,
                    columnCount: boardData.columns ? boardData.columns.length : 0
                });
            } catch (err) {
                console.error(`Error reading board file ${file}: ${err}`);
            }
        }

        // Apply filters
        if (req.query.title) {
            boards = boards.filter(board => 
                board.title.toLowerCase().includes(req.query.title.toLowerCase())
            );
        }

        if (req.query.tags) {
            const queryTags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
            boards = boards.filter(board => 
                queryTags.some(tag => board.tags.includes(tag))
            );
        }

        if (req.query.createdAfter) {
            const date = new Date(req.query.createdAfter);
            boards = boards.filter(board => new Date(board.createdAt) >= date);
        }

        if (req.query.createdBefore) {
            const date = new Date(req.query.createdBefore);
            boards = boards.filter(board => new Date(board.createdAt) <= date);
        }

        if (req.query.updatedAfter) {
            const date = new Date(req.query.updatedAfter);
            boards = boards.filter(board => new Date(board.updatedAt) >= date);
        }

        if (req.query.updatedBefore) {
            const date = new Date(req.query.updatedBefore);
            boards = boards.filter(board => new Date(board.updatedAt) <= date);
        }

        // Apply sorting
        if (req.query.sortBy) {
            const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
            boards.sort((a, b) => {
                if (req.query.sortBy === 'title') {
                    return sortOrder * a.title.localeCompare(b.title);
                } else if (req.query.sortBy === 'createdAt') {
                    return sortOrder * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                } else if (req.query.sortBy === 'updatedAt') {
                    return sortOrder * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
                }
                return 0;
            });
        }

        // Apply pagination
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || boards.length;
        boards = boards.slice(offset, offset + limit);

        res.json({
            success: true,
            count: boards.length,
            data: boards
        });
    } catch (error) {
        console.error('Error querying boards:', error);
        res.status(500).json({ error: 'Failed to query boards' });
    }
};

/**
 * Query cards within a board with filtering, sorting, and pagination
 * @async
 * @function queryCards
 * @param {Object} req - Express request object with board ID in params and query parameters
 * @param {Object} res - Express response object
 */
exports.queryCards = async (req, res) => {
    try {
        const boardId = req.params.boardId;
        const board = await Board.load(boardId);

        if (!board.data.cards || !Array.isArray(board.data.cards)) {
            return res.status(400).json({ error: 'Board is not using card-first architecture' });
        }

        // Start with all cards from the board
        let cards = [...board.data.cards];

        // Apply filters
        if (req.query.title) {
            cards = cards.filter(card => 
                card.title.toLowerCase().includes(req.query.title.toLowerCase())
            );
        }

        if (req.query.content) {
            cards = cards.filter(card => 
                card.content && card.content.toLowerCase().includes(req.query.content.toLowerCase())
            );
        }

        if (req.query.columnId) {
            cards = cards.filter(card => card.columnId === req.query.columnId);
        }

        if (req.query.priority) {
            cards = cards.filter(card => card.priority === req.query.priority);
        }

        if (req.query.status) {
            cards = cards.filter(card => card.status === req.query.status);
        }

        if (req.query.assignee) {
            cards = cards.filter(card => card.assignee === req.query.assignee);
        }

        if (req.query.tags) {
            const queryTags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
            cards = cards.filter(card => 
                card.tags && queryTags.some(tag => card.tags.includes(tag))
            );
        }

        if (req.query.createdAfter) {
            const date = new Date(req.query.createdAfter);
            cards = cards.filter(card => new Date(card.created_at) >= date);
        }

        if (req.query.createdBefore) {
            const date = new Date(req.query.createdBefore);
            cards = cards.filter(card => new Date(card.created_at) <= date);
        }

        if (req.query.updatedAfter) {
            const date = new Date(req.query.updatedAfter);
            cards = cards.filter(card => new Date(card.updated_at) >= date);
        }

        if (req.query.updatedBefore) {
            const date = new Date(req.query.updatedBefore);
            cards = cards.filter(card => new Date(card.updated_at) <= date);
        }

        // Apply sorting
        if (req.query.sortBy) {
            const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
            cards.sort((a, b) => {
                if (req.query.sortBy === 'title') {
                    return sortOrder * a.title.localeCompare(b.title);
                } else if (req.query.sortBy === 'priority') {
                    const priorityValues = { low: 0, medium: 1, high: 2 };
                    return sortOrder * (priorityValues[a.priority] - priorityValues[b.priority]);
                } else if (req.query.sortBy === 'createdAt') {
                    return sortOrder * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                } else if (req.query.sortBy === 'updatedAt') {
                    return sortOrder * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
                } else if (req.query.sortBy === 'status') {
                    return sortOrder * (a.status || '').localeCompare(b.status || '');
                }
                return 0;
            });
        }

        // Apply pagination
        const offset = parseInt(req.query.offset) || 0;
        const limit = parseInt(req.query.limit) || cards.length;
        cards = cards.slice(offset, offset + limit);

        // Enrich cards with column information
        const enrichedCards = cards.map(card => {
            const column = board.data.columns.find(col => col.id === card.columnId);
            return {
                ...card,
                columnName: column ? column.name : 'Unknown Column'
            };
        });

        res.json({
            success: true,
            count: enrichedCards.length,
            data: enrichedCards
        });
    } catch (error) {
        console.error('Error querying cards:', error);
        res.status(500).json({ error: 'Failed to query cards' });
    }
};
