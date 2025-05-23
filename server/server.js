/**
 * @fileoverview Main server entry point for the TaskBoardAI application.
 * @module server
 * @requires express
 * @requires cors
 * @requires node:path
 * @requires ./config/config
 * @requires ./routes/boardRoutes
 * @requires ./routes/configRoutes
 * @requires ./routes/webhookRoutes
 * @requires ./middleware/errorHandler
 * @requires ./utils/fileSystem
 */

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const config = require('./config/config');
const boardRoutes = require('./routes/boardRoutes');
const configRoutes = require('./routes/configRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const errorHandler = require('./middleware/errorHandler');
const { ensureBoardsDir, ensureConfigDir, ensureWebhooksDir } = require('./utils/fileSystem');

/**
 * Express application instance
 * @type {Object}
 */
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Static file serving
app.use(express.static(config.appDir));
app.use('/css', express.static(config.staticDirs.css));
app.use('/js', express.static(config.staticDirs.js));
app.use('/img', express.static(config.staticDirs.img));
app.use('/public', express.static(config.staticDirs.public));

// API routes
app.use('/api', boardRoutes);
app.use('/api', configRoutes);
app.use('/api', webhookRoutes);

/**
 * Catch-all route to serve index.html for SPA navigation
 * @name get/*
 * @function
 * @memberof module:server
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
app.get('*', (req, res) => {
    res.sendFile(path.join(config.appDir, 'index.html'));
});

// Error handling
app.use(errorHandler);

/**
 * Initialize the server with port availability check
 * @async
 * @function init
 * @memberof module:server
 */
async function init() {
  // Check if port is in use before starting the server
  const net = require('net');
  const tester = net.createServer()
    .once('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${config.port} is already in use. Attempting to kill the process...`);
        
        // Platform-specific port handling
        const { execSync } = require('child_process');
        try {
          if (process.platform === 'win32') {
            // Windows
            execSync(`FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${config.port} ^| findstr LISTENING') do taskkill /F /PID %a`);
          } else {
            // Unix-like
            // Find the PID of the process using the port
            const pid = execSync(`lsof -i :${config.port} -t`).toString().trim();
            if (pid) {
              console.log(`Killing process with PID: ${pid}`);
              execSync(`kill -9 ${pid}`);
              console.log('Process killed successfully. Starting new server...');
            }
          }
          // Wait a moment for the port to be released
          setTimeout(() => startServer(), 1000);
        } catch (error) {
          console.error('Failed to kill the process:', error.message);
          console.error('Please manually kill the process using this port or specify a different port with PORT environment variable');
          process.exit(1);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    })
    .once('listening', () => {
      tester.close();
      startServer();
    })
    .listen(config.port);
}

/**
 * Start the Express server on the configured port
 * @function startServer
 * @memberof module:server
 */
function startServer() {
  app.listen(config.port, () => {
    console.log(`TaskBoardAI server running on port ${config.port}`);
    console.log(`Using data directory: ${config.userDataDir}`);
    console.log(`Board file: ${config.dataFile}`);
  });
}

// Call init to start the server with port checking
init();
