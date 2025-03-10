const fs = require('node:fs').promises;
const path = require('node:path');
const config = require('../config/config');

class Config {
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

    // Load configuration data from file
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

    // Save configuration data to file
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

    // Validate configuration data structure
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
