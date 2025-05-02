/**
 * MCP tools for server control operations.
 * Provides functionality to manage the Kanban web server with enhanced security and validation.
 */

const { z } = require('zod');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs').promises;
const { checkRateLimit } = require('../rateLimiter');
const logger = require('../utils/logger');
const { handleError, ValidationError } = require('../utils/errors');

// Array of allowed environment variables that can be passed to child processes
const ALLOWED_ENV_VARS = [
  'PORT', 
  'NODE_ENV', 
  'LOG_LEVEL',
  'USE_LOCAL_BOARDS',
  'BOARD_FILE'
];

/**
 * Sanitizes environment variables to only pass allowed variables to child processes
 * @param {Object} env - Original environment variables
 * @param {Object} additionalVars - Additional variables to include
 * @returns {Object} Sanitized environment variables
 */
function sanitizeEnv(env, additionalVars = {}) {
  const sanitized = {};
  
  // Only copy explicitly allowed environment variables
  for (const key of ALLOWED_ENV_VARS) {
    if (env[key] !== undefined) {
      sanitized[key] = env[key];
    }
  }
  
  // Add additional variables (after validating them)
  for (const [key, value] of Object.entries(additionalVars)) {
    if (ALLOWED_ENV_VARS.includes(key) && typeof value === 'string') {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Checks if a port is in use
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} Whether the port is in use
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false));
        tester.close();
      })
      .listen(port);
  });
}

/**
 * Verifies that the server file exists and is executable
 * @param {string} serverPath - Path to the server file
 * @returns {Promise<boolean>} Whether the server file is valid
 */
async function verifyServerFile(serverPath) {
  try {
    const stats = await fs.stat(serverPath);
    return stats.isFile();
  } catch (error) {
    logger.error('Error verifying server file', { path: serverPath, error: error.message });
    return false;
  }
}

/**
 * Register server control tools with the MCP server
 * @param {Object} server - MCP server instance
 * @param {Object} options - Tool options
 * @param {Object} options.config - Application configuration
 */
function registerServerControlTools(server, { config }) {
  server.tool(
    'start-webserver',
    {
      port: z.number()
        .int('Port must be an integer')
        .min(1024, 'Port must be at least 1024')
        .max(65535, 'Port must be at most 65535')
        .optional()
        .default(3001)
        .describe('Port number to start the web server on. Defaults to 3001 if not specified.'),
      
      timeout: z.number()
        .int('Timeout must be an integer')
        .min(500, 'Timeout must be at least 500ms')
        .max(10000, 'Timeout cannot exceed 10 seconds')
        .optional()
        .default(2000)
        .describe('Timeout in milliseconds to wait for server startup confirmation')
    },
    async ({ port, timeout }) => {
      try {
        // Apply rate limiting (prioritizing this operation as expensive)
        checkRateLimit({ 
          clientId: 'server-control',  
          operationType: 'write'
        });
        
        // Track operation in logs
        logger.setRequestContext({
          tool: 'start-webserver',
          port
        });
        logger.info('Starting web server', { port, timeout });
        
        // Check if port is already in use
        const portCheck = await isPortInUse(port);
        if (portCheck) {
          logger.warn('Port already in use', { port });
          return {
            content: [{
              type: 'text',
              text: `Error: Port ${port} is already in use. Please specify a different port.`
            }],
            isError: true
          };
        }
        
        // Define server path and verify file exists
        const serverPath = path.resolve(__dirname, '../../server.js');
        const isValidServerFile = await verifyServerFile(serverPath);
        
        if (!isValidServerFile) {
          throw new ValidationError('Server file not found or not executable');
        }
        
        // Create sanitized environment for child process
        const sanitizedEnv = sanitizeEnv(process.env, {
          PORT: port.toString()
        });
        
        // Log the server start attempt
        logger.audit('server-start-attempt', { 
          port,
          serverPath,
          user: process.env.USER || 'unknown'
        });
        
        // Start the server process
        const serverProcess = spawn('node', [serverPath], {
          env: sanitizedEnv,
          detached: true,
          stdio: 'ignore'
        });
        
        // Detach process from parent
        serverProcess.unref();
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, timeout));
        
        // Check if process exited prematurely
        if (serverProcess.exitCode !== null) {
          logger.error('Server failed to start', { exitCode: serverProcess.exitCode });
          return {
            content: [{
              type: 'text',
              text: `Error: Server failed to start (exit code: ${serverProcess.exitCode})`
            }],
            isError: true
          };
        }
        
        // Verify the port is now in use (server started successfully)
        const portInUseAfterStart = await isPortInUse(port);
        if (!portInUseAfterStart) {
          logger.warn('Port not in use after server start', { port });
          return {
            content: [{
              type: 'text',
              text: `Warning: Server started but port ${port} is not in use. The server may have started on a different port.`
            }],
            isError: true
          };
        }
        
        logger.info('Web server started successfully', { port });
        return {
          content: [{
            type: 'text',
            text: `Kanban web server started on port ${port}. You can access it at http://localhost:${port}`
          }]
        };
      } catch (error) {
        return handleError(error, 'start-webserver');
      } finally {
        logger.clearRequestContext();
      }
    },
    `Starts the Kanban web server on a specified or default port.
     - Checks if the port is available before starting
     - Uses strong security practices for server process creation
     - Automatically assigns a default port (3001) if not specified
     - Provides detailed feedback on server startup
     - Validates server process is running after startup
     - Supports configurable startup timeout`
  );
  
  // New tool to check server status without starting it
  server.tool(
    'check-webserver',
    {
      port: z.number()
        .int('Port must be an integer')
        .min(1024, 'Port must be at least 1024')
        .max(65535, 'Port must be at most 65535')
        .optional()
        .default(3001)
        .describe('Port number to check. Defaults to 3001 if not specified.')
    },
    async ({ port }) => {
      try {
        // Apply rate limiting (this is a lightweight read operation)
        checkRateLimit({ 
          clientId: 'server-control', 
          operationType: 'read'
        });
        
        logger.setRequestContext({
          tool: 'check-webserver',
          port
        });
        
        // Check if port is in use
        const portInUse = await isPortInUse(port);
        
        if (portInUse) {
          logger.info('Webserver is running', { port });
          return {
            content: [{
              type: 'text',
              text: `Kanban web server appears to be running on port ${port}.`
            }]
          };
        } else {
          logger.info('Webserver is not running', { port });
          return {
            content: [{
              type: 'text',
              text: `No server detected on port ${port}. Use the start-webserver tool to start the server.`
            }]
          };
        }
      } catch (error) {
        return handleError(error, 'check-webserver');
      } finally {
        logger.clearRequestContext();
      }
    },
    `Checks if the Kanban web server is running on the specified port.
     - Safely detects if a service is using the port
     - Does not attempt to start or modify any running services
     - Useful for diagnostics before attempting to start the server`
  );
}

module.exports = { registerServerControlTools };
