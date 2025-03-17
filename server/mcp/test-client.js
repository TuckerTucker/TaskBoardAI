#!/usr/bin/env node

// Import MCP client classes
const { McpClient } = require('@modelcontextprotocol/sdk/client/mcp.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// Import the server for direct testing
const server = require('./kanbanMcpServer');

// Create client and transport instances for testing
const transport = new StdioClientTransport();
const client = new McpClient();

async function main() {
  try {
    const command = process.argv[2] || 'get-boards';
    
    console.log(`Testing ${command} functionality directly...`);
    
    // Parse parameters if provided
    const params = {};
    for (let i = 3; i < process.argv.length; i += 2) {
      const key = process.argv[i];
      const value = process.argv[i + 1];
      
      if (key && value && key.startsWith('--')) {
        params[key.substring(2)] = value;
      }
    }
    
    let result;
    
    // Test directly using the server handlers
    switch (command) {
      case 'get-boards':
        // Direct call to the server function
        result = await server.tools['get-boards'].handler({});
        break;
      case 'get-board':
        if (!params.boardId) {
          console.error('Error: boardId parameter is required (--boardId <board-id>)');
          process.exit(1);
        }
        result = await server.tools['get-board'].handler(params);
        break;
      case 'create-board':
        if (!params.name) {
          console.error('Error: name parameter is required (--name <board-name>)');
          process.exit(1);
        }
        result = await server.tools['create-board'].handler(params);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
    // Print the result
    if (result && result.content && result.content.length > 0) {
      console.log(result.content[0].text);
    } else {
      console.log('No content returned');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();