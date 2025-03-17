#!/usr/bin/env node

/**
 * Utility script to restart the MCP Kanban server
 * 
 * This script is intended to be run from the command line to restart
 * the MCP server process after code changes have been made.
 */

const { exec } = require('child_process');
const path = require('path');

function findServerProcess() {
  return new Promise((resolve, reject) => {
    exec('ps aux | grep "kanbanMcpServer\\.js" | grep -v grep', (error, stdout, stderr) => {
      if (error) {
        // No process found, or error running command
        console.log('No running MCP server process found');
        resolve(null);
        return;
      }

      const lines = stdout.trim().split('\n');
      if (lines.length === 0) {
        console.log('No running MCP server process found');
        resolve(null);
        return;
      }

      // Extract PIDs from process list
      const pids = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          pids.push(parts[1]);
        }
      }

      resolve(pids);
    });
  });
}

function stopServer(pids) {
  return new Promise((resolve, reject) => {
    if (!pids || pids.length === 0) {
      resolve();
      return;
    }

    const killCommand = `kill ${pids.join(' ')}`;
    exec(killCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Error stopping MCP server:', stderr);
        reject(error);
        return;
      }

      console.log(`Stopped ${pids.length} MCP server processes`);
      resolve();
    });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.resolve(__dirname, 'kanbanMcpServer.js');
    const child = exec(`node ${serverPath} &`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error starting MCP server:', stderr);
        reject(error);
        return;
      }
    });

    // Don't wait for process to exit
    child.unref();
    
    console.log('Started new MCP server process');
    resolve();
  });
}

async function main() {
  try {
    console.log('Restarting MCP Kanban server...');
    
    // Find and stop existing server
    const pids = await findServerProcess();
    await stopServer(pids);
    
    // Start new server
    await startServer();
    
    console.log('MCP Kanban server restart complete');
    console.log('You can now use the get-boards tool to see the updated format');
    
  } catch (error) {
    console.error('Error restarting server:', error);
    process.exit(1);
  }
}

main();