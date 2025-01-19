const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

// Ensure directory exists
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Ensure boards directory exists
async function ensureBoardsDir() {
    const dirToCreate = path.isAbsolute(config.dataFile) 
        ? path.dirname(config.dataFile) 
        : config.boardsDir;
    
    await ensureDir(dirToCreate);
}

module.exports = {
    ensureDir,
    ensureBoardsDir
};
