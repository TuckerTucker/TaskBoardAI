const fs = require('node:fs').promises;
const path = require('node:path');
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

// Ensure config directory exists
async function ensureConfigDir() {
    const dirToCreate = path.isAbsolute(config.configDataFile) 
        ? path.dirname(config.configDataFile) 
        : config.configDir;
    
    await ensureDir(dirToCreate);
}

// Ensure webhooks directory exists
async function ensureWebhooksDir() {
    await ensureDir(config.webhooksDir);
}

module.exports = {
    ensureDir,
    ensureBoardsDir,
    ensureConfigDir,
    ensureWebhooksDir
};
