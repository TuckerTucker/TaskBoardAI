#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

// Function to ensure MCP dependencies are installed
function ensureDependencies() {
  try {
    // Check if we're in the project directory or in node_modules
    let packageDir;
    if (fs.existsSync(path.resolve('package.json'))) {
      packageDir = path.resolve('.');
    } else {
      packageDir = path.join(__dirname, '..');
    }

    const packageJsonPath = path.join(packageDir, 'package.json');
    const nodeModulesPath = path.join(packageDir, 'node_modules', '@modelcontextprotocol');

    // Check if MCP SDK is installed
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('Installing MCP SDK dependencies...');
      execSync('npm install', { cwd: packageDir, stdio: 'inherit' });
    }
  } catch (error) {
    console.error(`Error ensuring dependencies: ${error.message}`);
    process.exit(1);
  }
}

// Ensure dependencies are installed
ensureDependencies();

// Determine the MCP server script path
let serverScriptPath;
if (fs.existsSync(path.resolve('server', 'mcp', 'kanbanMcpServer.js'))) {
  // Running from project directory
  serverScriptPath = path.resolve('server', 'mcp', 'kanbanMcpServer.js');
} else {
  // Running from installed package
  serverScriptPath = path.join(__dirname, '..', 'server', 'mcp', 'kanbanMcpServer.js');
}

// Start the MCP server
console.log('Starting Kanban MCP server...');
const serverProcess = spawn('node', [serverScriptPath], {
  stdio: 'inherit',
  shell: true
});

serverProcess.on('error', (error) => {
  console.error(`Failed to start MCP server: ${error.message}`);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});