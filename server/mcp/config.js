/**
 * Configuration loader and environment variable handler for MCP server
 */

const config = require('../config/config');

// Handle environment variables for configuration
if (process.env.USE_LOCAL_BOARDS === 'true') {
  console.log('Using local boards directory (from environment variable)');
}

if (process.env.MCP_PORT) {
  config.mcpPort = parseInt(process.env.MCP_PORT, 10);
  console.log('Using port from environment variable:', config.mcpPort);
}

console.log('Configuration loaded from environment variables and config.js');
console.log('MCP Server using boards directory:', config.boardsDir);

module.exports = config;
