#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const { execSync } = require('child_process');

// Default board file
let boardFile = 'kanban.json';
let createNew = false;
let external = false;

// Get the home directory for the user
const homeDir = os.homedir();
const dataDir = path.join(homeDir, '.taskboardai');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Function to stop running instances
function stopInstances() {
  console.log('Stopping running Kanban instances...');
  try {
    if (process.platform === 'win32') {
      // Windows
      execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq server.js*"', { stdio: 'ignore' });
    } else {
      // Unix-like
      execSync('pkill -f "node server/server.js"', { stdio: 'ignore' });
    }
    console.log('Stopped all running instances.');
  } catch (error) {
    console.log('No running instances found.');
  }
}

// Function to clean board name
function cleanBoardName(name) {
  if (path.isAbsolute(name)) {
    const dir = path.dirname(name);
    let file = path.basename(name);
    // Only remove .json if it exists
    if (file.endsWith('.json')) {
      file = file.substring(0, file.length - 5);
    }
    return path.join(dir, file);
  } else {
    // Remove .json extension (if present) for relative paths
    return name.replace(/\.json$/, '');
  }
}

// Function to create a new board file
function createNewBoard(name) {
  // Clean the board name
  const cleanName = cleanBoardName(name);
  
  let file;
  
  // Handle absolute paths
  if (path.isAbsolute(cleanName)) {
    file = `${cleanName}.json`;
    const dir = path.dirname(file);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } else {
    // Check if we're in the project directory or running from node_modules
    const boardsDir = fs.existsSync(path.resolve('boards'))
      ? path.resolve('boards')
      : path.join(dataDir, 'boards');
    
    // Create boards directory if needed
    if (!fs.existsSync(boardsDir)) {
      fs.mkdirSync(boardsDir, { recursive: true });
    }
    
    file = path.join(boardsDir, `${cleanName}.json`);
  }
  
  if (fs.existsSync(file)) {
    console.error(`Error: Board '${file}' already exists`);
    process.exit(1);
  }
  
  // Get path to example template
  let templatePath;
  if (fs.existsSync(path.resolve('boards', '_kanban_example.json'))) {
    // Running from project directory
    templatePath = path.resolve('boards', '_kanban_example.json');
  } else {
    // Running from installed package
    templatePath = path.join(__dirname, '..', 'boards', '_kanban_example.json');
    
    // Create the dataDir/boards directory if it doesn't exist
    const targetDir = path.dirname(file);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  }
  
  // Copy from example template
  fs.copyFileSync(templatePath, file);
  console.log(`Created new board from template: ${file}`);
  boardFile = file;
}

// Function to list available boards
function listBoards() {
  console.log('\nAvailable boards');
  console.log('---------------');
  
  // Determine where to look for boards
  let boardsDir;
  if (fs.existsSync(path.resolve('boards'))) {
    // Look in project directory
    boardsDir = path.resolve('boards');
  } else {
    // Look in user's data directory
    boardsDir = path.join(dataDir, 'boards');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(boardsDir)) {
      fs.mkdirSync(boardsDir, { recursive: true });
      console.log('• No boards found. Create one with: taskboard --new <board_name>');
      console.log('\nTo use a board: taskboard <board_name>');
      console.log('To create new: taskboard --new <board_name>');
      return;
    }
  }
  
  // List all .json files in boards directory except _kanban_example.json
  try {
    const files = fs.readdirSync(boardsDir)
      .filter(file => file.endsWith('.json') && file !== '_kanban_example.json');
    
    if (files.length === 0) {
      console.log('• No boards found. Create one with: taskboard --new <board_name>');
    } else {
      files.forEach(file => {
        console.log(`• ${file.replace(/\.json$/, '')}`);
      });
    }
    
    console.log('\nTo use a board: taskboard <board_name>');
    console.log('To create new: taskboard --new <board_name>');
  } catch (error) {
    console.error(`Error listing boards: ${error.message}`);
  }
}

// Parse arguments
const args = process.argv.slice(2);
let index = 0;

while (index < args.length) {
  const arg = args[index];
  
  switch (arg) {
    case '--stop':
      stopInstances();
      process.exit(0);
      break;
    
    case '--list':
      listBoards();
      process.exit(0);
      break;
    
    case '--new':
      if (index + 1 >= args.length) {
        console.error('Error: --new requires a board name');
        console.error('Usage: taskboard --new board_name');
        process.exit(1);
      }
      createNewBoard(args[index + 1]);
      index += 2;
      break;
    
    case '--external':
      external = true;
      index += 1;
      break;
    
    default:
      // Clean the board name if it's not a flag
      boardFile = cleanBoardName(arg);
      
      // For absolute or external paths, check if file exists at the specified path
      if (path.isAbsolute(boardFile) || external) {
        if (external && !path.isAbsolute(boardFile)) {
          // Convert relative path to absolute for external boards
          boardFile = path.resolve(boardFile);
        }
        
        // Check both with and without .json extension
        if (!fs.existsSync(boardFile) && !fs.existsSync(`${boardFile}.json`)) {
          console.error(`Error: Board file not found at '${boardFile}' or '${boardFile}.json'`);
          console.error('Usage: taskboard [board_file]');
          console.error('       taskboard --external [board_file]');
          console.error('       taskboard --new board_name');
          console.error('The board file must exist at the specified path');
          process.exit(1);
        }
        
        // Use .json extension if the file exists with it
        if (fs.existsSync(`${boardFile}.json`)) {
          boardFile = `${boardFile}.json`;
        }
      } else {
        // For relative paths, check in boards directory
        // Determine which boards directory to use
        let boardsDir;
        if (fs.existsSync(path.resolve('boards'))) {
          // Running from project directory
          boardsDir = path.resolve('boards');
        } else {
          // Running from installed package
          boardsDir = path.join(dataDir, 'boards');
          if (!fs.existsSync(boardsDir)) {
            fs.mkdirSync(boardsDir, { recursive: true });
          }
        }
        
        if (!fs.existsSync(path.join(boardsDir, `${boardFile}.json`))) {
          console.error(`Error: Board file '${path.join(boardsDir, boardFile)}.json' not found`);
          console.error('Usage: taskboard [board_file]');
          console.error('       taskboard --external [board_file]');
          console.error('       taskboard --new board_name');
          console.error('The board file should exist in the boards directory');
          process.exit(1);
        }
        
        boardFile = path.join(boardsDir, `${boardFile}.json`);
      }
      
      index += 1;
      break;
  }
}

// If no board file specified, use default
if (!boardFile) {
  boardFile = path.join(dataDir, 'boards', 'kanban.json');
  
  // Check if default exists, if not create boards directory and warn user
  if (!fs.existsSync(boardFile)) {
    if (!fs.existsSync(path.dirname(boardFile))) {
      fs.mkdirSync(path.dirname(boardFile), { recursive: true });
    }
    console.warn(`Warning: Default board '${boardFile}' not found. You may want to create one with --new.`);
  }
}

// Determine the server script path
let serverScriptPath;
if (fs.existsSync(path.resolve('server', 'server.js'))) {
  // Running from project directory
  serverScriptPath = path.resolve('server', 'server.js');
} else {
  // Running from installed package
  serverScriptPath = path.join(__dirname, '..', 'server', 'server.js');
}

// Start the server
const env = Object.assign({}, process.env, { BOARD_FILE: boardFile });
const serverProcess = spawn('node', [serverScriptPath], {
  env,
  stdio: 'inherit',
  shell: true
});

serverProcess.on('error', (error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});