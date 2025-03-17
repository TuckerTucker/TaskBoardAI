#!/usr/bin/env node

// A simplified test script that directly calls the server handlers
const server = require('./kanbanMcpServer');

async function main() {
  try {
    console.log('Testing get-boards directly...');
    
    // Find the get-boards tool
    console.log('Server structure:', Object.keys(server));
    
    if (server._tools && Array.isArray(server._tools)) {
      const getBoardsTool = server._tools.find(tool => tool.name === 'get-boards');
      if (getBoardsTool && getBoardsTool.handler) {
        const result = await getBoardsTool.handler({});
        console.log('Result:');
        console.log(result.content[0].text);
      } else {
        console.error('Could not find get-boards tool');
      }
    } else {
      console.error('Unexpected server structure');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();