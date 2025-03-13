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
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
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
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
exports.getBoard = async (req, res) => {
    try {
        const board = await Board.load();
        res.json(board.data);
    } catch (error) {
        console.error('Error reading board data:', error);
        res.status(500).json({ error: 'Failed to read board data' });
    }
};

/**
 * Get a specific board by ID
 * @async
 * @function getBoardById
 * @param {import('express').Request} req - Express request object with board ID in params
 * @param {import('express').Response} res - Express response object
 */
exports.getBoardById = async (req, res) => {
    try {
        const boardId = req.params.id;
        const board = await Board.load(boardId);
        res.json(board.data);
    } catch (error) {
        console.error(`Error reading board ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Board not found' });
    }
};

/**
 * Get a list of all available boards
 * @async
 * @function getBoards
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
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
 * @param {import('express').Request} req - Express request object with board name in body
 * @param {import('express').Response} res - Express response object
 */
exports.createBoard = async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ error: 'Board name is required' });
        }
        
        const board = await Board.create(name.trim());
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
 * @param {import('express').Request} req - Express request object with board ID in params
 * @param {import('express').Response} res - Express response object
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
 * @param {import('express').Request} req - Express request object with board data in body
 * @param {import('express').Response} res - Express response object
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
 * @param {import('express').Request} req - Express request object with updated board data in body
 * @param {import('express').Response} res - Express response object
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
