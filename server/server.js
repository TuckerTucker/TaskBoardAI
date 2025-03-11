const express = require('express');
const cors = require('cors');
const path = require('node:path');
const config = require('./config/config');
const boardRoutes = require('./routes/boardRoutes');
const configRoutes = require('./routes/configRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const errorHandler = require('./middleware/errorHandler');
const { ensureBoardsDir, ensureConfigDir, ensureWebhooksDir } = require('./utils/fileSystem');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Static file serving
app.use(express.static(config.appDir));
app.use('/css', express.static(config.staticDirs.css));
app.use('/img', express.static(config.staticDirs.img));

// API routes
app.use('/api', boardRoutes);
app.use('/api', configRoutes);
app.use('/api', webhookRoutes);

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(config.appDir, 'index.html'));
});

// Error handling
app.use(errorHandler);

// Initialize server
async function init() {
    try {
        // Ensure required directories exist
        await ensureBoardsDir();
        await ensureConfigDir();
        await ensureWebhooksDir();
        
        // Start server
        app.listen(config.port, () => {
            console.log(`Server running on port ${config.port}`);
            console.log('Using board file:', config.dataFile);
            console.log('Using config file:', config.configDataFile);
            console.log('Using webhooks directory:', config.webhooksDir);
        });
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

// Start server
init();
