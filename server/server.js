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
  // Check if port is in use before starting the server
  const net = require('net');
  const tester = net.createServer()
    .once('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log('Port 3001 is already in use. Attempting to kill the process...');
        
        // For MacOS, find and kill the process using the port
        const { execSync } = require('child_process');
        try {
          // Find the PID of the process using port 3001
          const pid = execSync('lsof -i :3001 -t').toString().trim();
          if (pid) {
            console.log(`Killing process with PID: ${pid}`);
            execSync(`kill -9 ${pid}`);
            console.log('Process killed successfully. Starting new server...');
            // Wait a moment for the port to be released
            setTimeout(() => startServer(), 1000);
          }
        } catch (error) {
          console.error('Failed to kill the process:', error.message);
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
    .listen(3001);
}

function startServer() {
  app.listen(3001, () => {
    console.log('Kanban server running on port 3001');
  });
}

// Call init to start the server with port checking
init();
