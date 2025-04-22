#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const config = require('./config');
const { checkRateLimit } = require('./rateLimiter');

const { registerBoardTools } = require('./tools/boards');
const { registerCardTools } = require('./tools/cards');
const { registerServerControlTools } = require('./tools/serverControl');
const { registerMigrationTools } = require('./tools/migration');

const server = new McpServer({
  name: 'TaskBoardAI',
  version: '1.0.0',
});

// Register MCP tools
registerBoardTools(server, { config, checkRateLimit });
registerCardTools(server, { config, checkRateLimit });
registerServerControlTools(server, { config });
registerMigrationTools(server, { config, checkRateLimit });

if (require.main === module) {
  console.log('\nEnvironment Information:');
  console.log('- Process ID:', process.pid);
  console.log('- Node Version:', process.version);
  console.log('- Working Directory:', process.cwd());
  console.log('- Platform:', process.platform);
  console.log('- Environment Variables:');
  console.log('  USE_LOCAL_BOARDS:', process.env.USE_LOCAL_BOARDS);
  console.log('  BOARD_FILE:', process.env.BOARD_FILE);

  (async () => {
    const fs = require('node:fs').promises;
    try {
      console.log('\nFile system access check:');
      const boardsDir = config.boardsDir;
      console.log('- Checking access to boardsDir:', boardsDir);
      await fs.access(boardsDir).then(() => console.log('  ✅ Directory exists and is accessible'));

      console.log('- Listing files in directory:');
      const files = await fs.readdir(boardsDir);
      console.log(`  ✅ Found ${files.length} files/directories`);
      console.log('  First 5 entries:', files.slice(0, 5));
    } catch (err) {
      console.error('❌ Filesystem access error:', err);
    }
  })();

  const transport = new StdioServerTransport();

  server.connect(transport).catch(error => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

module.exports = server;
