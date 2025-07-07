# TaskBoardAI MCP Server

This documentation covers the Model Context Protocol (MCP) server included with TaskBoardAI that enables AI-powered board management through Claude for Desktop.

## Overview

The MCP server allows you to use Claude to:
- Create and manage kanban boards through natural language
- Automate board updates and maintenance
- Query board information conversationally

## Features

- Create new boards using natural language
- Update existing boards via AI
- List all available boards
- Get detailed board information by ID
- Delete boards
- Start the web server directly from Claude

## Setup Instructions

### 1. Install Dependencies

Dependencies are installed automatically when you run the `_start_mcp` script, but you can also install them manually:

```bash
npm install
```

### 2. Start the Servers

You can start just the MCP server:

```bash
./_start_mcp
```

Or start both the TaskBoardAI web server and MCP server simultaneously:

```bash
./_start_all
```

Using npm scripts:

```bash
# Start just the MCP server
npm run start:mcp

# Start both servers simultaneously
npm run start:all
```

### 3. Configure Claude for Desktop

To connect Claude for Desktop to the TaskBoardAI MCP server:

1. Edit your Claude Desktop configuration file at:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%AppData%\Claude\claude_desktop_config.json`

2. Add the following configuration (adjust the path to match your installation):

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": [
        "/path/to/TaskBoardAI/server/mcp/kanbanMcpServer.js"
      ]
    }
  }
}
```

3. Restart Claude for Desktop

### 4. Using the MCP Server with Claude

Once configured, you can interact with Claude using natural language:

- **Create a board**: "Create a new kanban board called 'Project X'"
- **List boards**: "Show me all my kanban boards"
- **View board details**: "Show me the board with ID [board-id]"
- **Update a board**: "Update this board with the following data: [board data in JSON format]"
- **Delete a board**: "Delete the board with ID [board-id]"
- **Start the web server**: "Start the TaskBoardAI web server on port 3001"

## Available MCP Tools

The server provides these specific tools:

1. `get-boards`: Lists all available kanban boards
2. `create-board`: Creates a new kanban board with a specified name, based on the `_kanban_example.json` template.
3. `get-board`: Gets a specific board by ID
4. `update-board`: Updates an existing board with new data. Accepts `boardData` as a JSON string or object.
5. `delete-board`: Deletes a board by ID
6. `update-card`: Updates properties of a specific card by ID. Requires `boardId`, `cardId`, and `cardData` (JSON string or object).
7. `move-card`: Moves a card to a different column or position. Requires `boardId`, `cardId`, `columnId`, and `position` ('first', 'last', 'up', 'down', or index).
8. `batch-cards`: Batch create, update, and move multiple cards atomically. Requires `boardId` and an array of `operations`.
   - For 'create': Omit `cardId`, provide `type='create'`, `cardData` (JSON string or object), `columnId`, and optional `position` ('first', 'last', or index).
   - For 'update': Provide `cardId`, `type='update'`, and `cardData` (JSON string or object).
   - For 'move': Provide `cardId`, `type='move'`, `columnId`, and `position` ('first', 'last', 'up', 'down', or index).
9. `start-webserver`: Starts the TaskBoardAI web server on a specified port

## Example Prompts

Here are some example prompts for working with Claude:

```
Create a new board for my personal project with three columns: "To Do", "In Progress", and "Done"
```

```
Show me all of my kanban boards
```

```
Start the TaskBoardAI web server on port 3001
```

```
Update my Project X board to add a new column for "Testing"
```

## Advanced Usage

### Board Creation with Custom Structure

Claude can help you create boards with custom structure:

```
Create a new board named "Software Development" with these columns:
- Backlog
- Design
- Development
- Testing
- Done

And add these initial tasks to the Backlog:
- Set up development environment
- Create user authentication
- Design database schema
```

### Data Migration

Claude can help migrate data from other formats:

```
I have a list of tasks in CSV format. Please convert this to a TaskBoardAI board:

Task,Status,Priority,Assigned To
Implement login,In Progress,High,Alex
Fix homepage CSS,To Do,Medium,Sam
Deploy to staging,To Do,High,Alex
```

## Note

The MCP server writes board data directly to JSON files in your TaskBoardAI installation. All board operations are performed on these files, making them accessible to both the web interface and the MCP server.
