#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Function to ensure dependencies are installed
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
    const mcpPath = path.join(packageDir, 'node_modules', '@modelcontextprotocol');
    const concurrentlyPath = path.join(packageDir, 'node_modules', 'concurrently');

    // Check if dependencies are installed
    if (!fs.existsSync(mcpPath) || !fs.existsSync(concurrentlyPath)) {
      console.log('Installing dependencies...');
      execSync('npm install', { cwd: packageDir, stdio: 'inherit' });
    }
  } catch (error) {
    console.error(`Error ensuring dependencies: ${error.message}`);
    process.exit(1);
  }
}

// Ensure dependencies are installed
ensureDependencies();

// Start both servers using npm script
console.log('Starting Kanban server and MCP server...');

// Determine the proper npm script execution method
let npmCmd;
if (process.platform === 'win32') {
  npmCmd = 'npm.cmd';
} else {
  npmCmd = 'npm';
}

try {
  // Check if we're in the project directory
  if (fs.existsSync(path.resolve('package.json'))) {
    // Run directly
    const serverProcess = spawn(npmCmd, ['run', 'start:all'], {
      stdio: 'inherit',
      shell: true
    });

    serverProcess.on('error', (error) => {
      console.error(`Failed to start servers: ${error.message}`);
      process.exit(1);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      serverProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      serverProcess.kill('SIGTERM');
    });
  } else {
    // We're in node_modules, run scripts directly
    const packageDir = path.join(__dirname, '..');
    
    // Determine script paths
    const serverScriptPath = path.join(packageDir, 'server', 'server.js');
    const mcpScriptPath = path.join(packageDir, 'server', 'mcp', 'kanbanMcpServer.js');
    
    // Check for concurrently
    const concurrentlyPath = path.join(packageDir, 'node_modules', '.bin', 'concurrently');
    
    if (fs.existsSync(concurrentlyPath)) {
      // Use concurrently if available
      const serverProcess = spawn(concurrentlyPath, [
        `node "${serverScriptPath}"`,
        `node "${mcpScriptPath}"`
      ], {
        stdio: 'inherit',
        shell: true
      });
      
      serverProcess.on('error', (error) => {
        console.error(`Failed to start servers: ${error.message}`);
        process.exit(1);
      });
      
      // Handle process termination
      process.on('SIGINT', () => {
        serverProcess.kill('SIGINT');
      });
      
      process.on('SIGTERM', () => {
        serverProcess.kill('SIGTERM');
      });
    } else {
      console.error('Error: concurrently package is required but not found');
      console.error('Please install it with: npm install concurrently');
      process.exit(1);
    }
  }
} catch (error) {
  console.error(`Error starting servers: ${error.message}`);
  process.exit(1);
}