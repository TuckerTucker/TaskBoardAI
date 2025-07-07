#!/usr/bin/env node

/**
 * TaskBoardAI MCP Server
 * 
 * Main entry point for the Model Context Protocol server that provides
 * tools for interacting with the kanban board system.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('node:fs').promises;
const path = require('node:path');

// Configuration and utilities
const config = require('./config');
const { checkRateLimit, getRateLimitStats } = require('./rateLimiter');
const logger = require('./utils/logger');

// Tools
const { registerBoardTools } = require('./tools/boards');
const { registerCardTools } = require('./tools/cards');
const { registerServerControlTools } = require('./tools/serverControl');
const { registerMigrationTools } = require('./tools/migration');

// Create MCP server with version info
const packageJson = require('../../package.json');
const server = new McpServer({
  name: 'TaskBoardAI',
  version: packageJson.version || '1.0.0',
});

// Set up error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  // Log but don't exit - let the MCP framework handle the situation
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason });
});

// Register MCP tools with dependencies injected
const toolDependencies = { 
  config, 
  checkRateLimit,
  logger
};

registerBoardTools(server, toolDependencies);
registerCardTools(server, toolDependencies);
registerServerControlTools(server, toolDependencies);
registerMigrationTools(server, toolDependencies);

/**
 * Performs startup checks to ensure the environment is properly configured
 * @async
 */
async function performStartupChecks() {
  try {
    logger.info('Starting MCP server', {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      workingDirectory: process.cwd(),
      environment: {
        USE_LOCAL_BOARDS: process.env.USE_LOCAL_BOARDS,
        BOARD_FILE: process.env.BOARD_FILE,
        NODE_ENV: process.env.NODE_ENV
      }
    });
    
    // Verify boards directory access
    logger.info('Checking filesystem access');
    const boardsDir = config.boardsDir;
    
    try {
      await fs.access(boardsDir);
      logger.info('Directory exists and is accessible', { path: boardsDir });
      
      // Create backups directory if it doesn't exist
      const backupsDir = path.join(boardsDir, 'backups');
      await fs.mkdir(backupsDir, { recursive: true });
      
      // Read directory contents
      const files = await fs.readdir(boardsDir);
      logger.info(`Found ${files.length} files/directories`, { 
        path: boardsDir,
        sampleFiles: files.slice(0, 5)
      });
      
      // Count board files
      const boardFiles = files.filter(f => 
        f.endsWith('.json') && !f.startsWith('_') && f !== 'config.json'
      );
      logger.info(`Found ${boardFiles.length} board files`);
      
    } catch (err) {
      logger.error('Filesystem access error', { path: boardsDir, error: err });
      // Don't throw - we want to start the server anyway and handle errors later
    }
    
    // Log initial rate limit configuration
    logger.info('Rate limiting configured', getRateLimitStats());
    
  } catch (error) {
    logger.error('Error during startup checks', error);
  }
}

// Run as standalone server when executed directly
if (require.main === module) {
  (async () => {
    // Perform environment checks
    await performStartupChecks();
    
    // Create transport and connect
    const transport = new StdioServerTransport();
    
    try {
      await server.connect(transport);
      logger.info('MCP server connected successfully');
    } catch (error) {
      logger.error('Failed to start MCP server', error);
      process.exit(1);
    }
  })();
}

// Export for testing and programmatic usage
module.exports = server;
