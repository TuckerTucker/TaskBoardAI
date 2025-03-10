const path = require('node:path');

// Environment variables and defaults
const config = {
    port: process.env.PORT || 3001,
    boardFile: process.env.BOARD_FILE || 'kanban.json',
    configFile: process.env.CONFIG_FILE || 'config.json',
    
    // Directories
    rootDir: path.join(__dirname, '../..'),
    appDir: path.join(__dirname, '../../app'),
    boardsDir: path.join(__dirname, '../../boards'),
    configDir: path.join(__dirname, '../../config'),
    webhooksDir: path.join(__dirname, '../../webhooks'),
    
    // Static directories
    staticDirs: {
        css: path.join(__dirname, '../../app/css'),
        img: path.join(__dirname, '../../img')
    }
};

// Handle board file path
const isBoardAbsolutePath = path.isAbsolute(config.boardFile);
const hasBoardJsonExt = config.boardFile.toLowerCase().endsWith('.json');

// Set final data file path
if (process.env.BOARD_FILE) {
    config.dataFile = hasBoardJsonExt ? config.boardFile : `${config.boardFile}.json`;
} else {
    const normalizedBoardFile = hasBoardJsonExt ? config.boardFile : `${config.boardFile}.json`;
    config.dataFile = path.join(config.boardsDir, normalizedBoardFile);
}

// Handle config file path
const isConfigAbsolutePath = path.isAbsolute(config.configFile);
const hasConfigJsonExt = config.configFile.toLowerCase().endsWith('.json');

// Set final config file path
if (process.env.CONFIG_FILE) {
    config.configDataFile = hasConfigJsonExt ? config.configFile : `${config.configFile}.json`;
} else {
    const normalizedConfigFile = hasConfigJsonExt ? config.configFile : `${config.configFile}.json`;
    config.configDataFile = path.join(config.configDir, normalizedConfigFile);
}

module.exports = config;
