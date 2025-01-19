const Board = require('../models/Board');
const config = require('../config/config');

// Get board info
exports.getBoardInfo = (req, res) => {
    res.json({
        boardFile: config.boardFile,
        fullPath: config.dataFile
    });
};

// Get board data
exports.getBoard = async (req, res) => {
    try {
        const board = await Board.load();
        res.json(board.data);
    } catch (error) {
        console.error('Error reading board data:', error);
        res.status(500).json({ error: 'Failed to read board data' });
    }
};

// Update board data
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
