const fs = require('node:fs').promises;
const path = require('node:path');

async function directBoardListing() {
  try {
    const boardsDir = '/Volumes/tkr-riffic/tucker-home-folder/kanban/tkr-kanban/boards';
    console.log('Listing boards directly from:', boardsDir);
    
    // Get all files in the directory
    const files = await fs.readdir(boardsDir);
    console.log('Found files:', files);
    
    // Filter for JSON files that don't start with underscore
    const boardFiles = files.filter(file => 
      file.endsWith('.json') && 
      !file.startsWith('_') && 
      file !== 'config.json'
    );
    
    console.log('Filtered to board files:', boardFiles);
    
    // Read and parse each board file
    const boards = [];
    
    for (const file of boardFiles) {
      try {
        // Skip directories
        const filePath = path.join(boardsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${file}`);
          continue;
        }
        
        // Read the file
        const data = await fs.readFile(filePath, 'utf8');
        const boardData = JSON.parse(data);
        
        // Use file modification time if no last_updated
        let lastUpdated = boardData.last_updated;
        if (!lastUpdated) {
          lastUpdated = stats.mtime.toISOString();
        }
        
        boards.push({
          id: boardData.id || path.basename(file, '.json'),
          name: boardData.projectName || 'Unnamed Board',
          lastUpdated: lastUpdated || new Date().toISOString()
        });
      } catch (err) {
        console.error(`Error reading board file ${file}:`, err);
      }
    }
    
    // Sort boards by name
    boards.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('Successfully loaded boards:', boards.length);
    boards.forEach((board, index) => {
      console.log(`${index + 1}. ${board.name} (${board.id}) - ${board.lastUpdated}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

directBoardListing();