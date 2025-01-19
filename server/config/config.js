const path = require('path');

// Environment variables and defaults
const config = {
    port: process.env.PORT || 3001,
    boardFile: process.env.BOARD_FILE || 'kanban.json',
    
    // Directories
    rootDir: path.join(__dirname, '../..'),
    appDir: path.join(__dirname, '../../app'),
    boardsDir: path.join(__dirname, '../../boards'),
    
    // Static directories
    staticDirs: {
        css: path.join(__dirname, '../../app/css'),
        img: path.join(__dirname, '../../img')
    }
};

// Handle board file path
const isAbsolutePath = path.isAbsolute(config.boardFile);
const hasJsonExt = config.boardFile.toLowerCase().endsWith('.json');

// Set final data file path
if (process.env.BOARD_FILE) {
    config.dataFile = hasJsonExt ? config.boardFile : `${config.boardFile}.json`;
} else {
    const normalizedBoardFile = hasJsonExt ? config.boardFile : `${config.boardFile}.json`;
    config.dataFile = path.join(config.boardsDir, normalizedBoardFile);
}

module.exports = config;
