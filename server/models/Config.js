const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../config/config');

/**
 * @fileoverview Configuration model that handles app settings.
 * @module models/Config
 * @requires node:fs
 * @requires node:path
 * @requires ../config/config
 */

/**
 * @typedef {Object} ServerOptions
 * @property {string} apiEndpoint - Base API endpoint path
 * @property {boolean} autoSave - Whether to automatically save board changes
 */

/**
 * @typedef {Object} ConfigData
 * @property {string} theme - UI theme ('light' or 'dark')
 * @property {string} dataStorage - Storage method ('local' or 'remote')
 * @property {ServerOptions} serverOptions - Server configuration options
 * @property {string} [last_updated] - ISO timestamp of last update
 */

/**
 * Class representing application configuration
 * @class
 * @category Models
 */
class Config {
    /**
     * Create a Config instance
     * @param {ConfigData} [data=null] - Configuration data
     */
    constructor(data = null) {
        this.data = data || {
            theme: 'light',
            dataStorage: 'local',
            serverOptions: {
                apiEndpoint: '/api',
                autoSave: true
            }
        };
    }

    /**
     * Load configuration from file
     * @static
     * @async
     * @returns {Promise<Config>} The loaded configuration instance
     * @throws {Error} If the configuration cannot be loaded
     */
    static async load() {
        try {
            const data = await fs.readFile(config.configDataFile, 'utf8');
            return new Config(JSON.parse(data));
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Return default config if file doesn't exist
                const defaultConfig = new Config();
                await defaultConfig.save();
                return defaultConfig;
            }
            throw error;
        }
    }

    /**
     * Save configuration to file
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If the configuration cannot be saved
     */
    async save() {
        // Ensure config directory exists
        try {
            await fs.mkdir(path.dirname(config.configDataFile), { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }

        // Update last_updated timestamp
        this.data.last_updated = new Date().toISOString();

        await fs.writeFile(config.configDataFile, JSON.stringify(this.data, null, 2));
    }

    /**
     * Validate configuration data structure
     * @returns {boolean} True if the configuration data is valid
     */
    validate() {
        return (
            this.data &&
            typeof this.data === 'object' &&
            typeof this.data.theme === 'string' &&
            typeof this.data.dataStorage === 'string' &&
            this.data.serverOptions &&
            typeof this.data.serverOptions === 'object' &&
            typeof this.data.serverOptions.apiEndpoint === 'string' &&
            typeof this.data.serverOptions.autoSave === 'boolean'
        );
    }
}

module.exports = Config;
