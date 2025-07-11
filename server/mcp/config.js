/**
 * Configuration loader and environment variable handler for MCP server
 */

const config = require('../config/config');

// Handle environment variables for configuration
if (process.env.USE_LOCAL_BOARDS === 'true') {
  // Using local boards directory (from environment variable)
}

if (process.env.MCP_PORT) {
  config.mcpPort = parseInt(process.env.MCP_PORT, 10);
  // Using port from environment variable
}

module.exports = config;
