/**
 * @fileoverview Utility functions for managing the filesystem
 * @module utils/fileSystem
 * @requires node:fs
 * @requires node:path
 * @requires ../config/config
 */

const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../config/config');

/**
 * Ensure a directory exists, creating it if necessary
 * @async
 * @function ensureDir
 * @param {string} dirPath - Path to the directory to ensure exists
 * @returns {Promise<void>}
 * @throws {Error} If directory cannot be created for reasons other than it already exists
 */
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

/**
 * Ensure the boards directory exists
 * @async
 * @function ensureBoardsDir
 * @returns {Promise<void>}
 */
async function ensureBoardsDir() {
    const dirToCreate = path.isAbsolute(config.dataFile) 
        ? path.dirname(config.dataFile) 
        : config.boardsDir;
    
    await ensureDir(dirToCreate);
}

/**
 * Ensure the config directory exists
 * @async
 * @function ensureConfigDir
 * @returns {Promise<void>}
 */
async function ensureConfigDir() {
    const dirToCreate = path.isAbsolute(config.configDataFile) 
        ? path.dirname(config.configDataFile) 
        : config.configDir;
    
    await ensureDir(dirToCreate);
}

/**
 * Ensure the webhooks directory exists
 * @async
 * @function ensureWebhooksDir
 * @returns {Promise<void>}
 */
async function ensureWebhooksDir() {
    await ensureDir(config.webhooksDir);
}

module.exports = {
    ensureDir,
    ensureBoardsDir,
    ensureConfigDir,
    ensureWebhooksDir
};
