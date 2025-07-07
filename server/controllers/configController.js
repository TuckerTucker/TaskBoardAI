const Config = require('../models/Config');

// Get configuration data
exports.getConfig = async (req, res) => {
    try {
        const config = await Config.load();
        res.json(config.data);
    } catch (error) {
        console.error('Error reading configuration data:', error);
        
        // Return default configuration if file doesn't exist yet
        if (error.code === 'ENOENT') {
            return res.json({
                theme: 'light',
                dataStorage: 'local',
                serverOptions: {
                    apiEndpoint: '/api',
                    autoSave: true
                }
            });
        }
        
        res.status(500).json({ error: 'Failed to read configuration data' });
    }
};

// Update configuration data
exports.updateConfig = async (req, res) => {
    try {
        const config = new Config(req.body);
        
        // Validate configuration data
        if (!config.validate()) {
            return res.status(400).json({ error: 'Invalid configuration data format' });
        }

        // Save configuration
        await config.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving configuration data:', error);
        res.status(500).json({ error: 'Failed to save configuration data' });
    }
};
