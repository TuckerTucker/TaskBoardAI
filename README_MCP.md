# Kanban MCP Server

This is an MCP (Model Context Protocol) server for the Kanban app that allows you to create new boards and update existing boards using Claude for Desktop.

## Features

- Create new kanban boards
- Update existing boards
- List all available boards
- Get board details by ID
- Delete boards

## Setup Instructions

### 1. Install Dependencies

The dependencies are installed automatically when you run the `start_mcp` script, but you can also install them manually:

```bash
npm install
```

### 2. Start the Servers

You can start just the MCP server:

```bash
./start_mcp
```

Or you can start both the Kanban server and MCP server simultaneously:

```bash
./start_all
```

Alternatively, you can use npm scripts:

```bash
# Start just the MCP server
npm run start:mcp

# Start both servers simultaneously
npm run start:all
```

### 3. Configure Claude for Desktop

To use the MCP server with Claude for Desktop, you need to configure Claude to connect to the server:

1. Create or edit the Claude Desktop configuration file at:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%AppData%\Claude\claude_desktop_config.json`

2. Add the following configuration (adjust the path to match your system):

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": [
        "/Volumes/tkr-riffic/tucker-home-folder/kanban/tkr-kanban/server/mcp/kanbanMcpServer.js"
      ]
    }
  }
}
```

3. Restart Claude for Desktop

### 4. Using the MCP Server with Claude

Once configured, you can ask Claude to perform the following actions:

- Create a new board: "Create a new kanban board called 'Project X'"
- List all boards: "Show me all my kanban boards"
- Get a specific board: "Show me the details of board with ID [board-id]"
- Update a board: "Update this board with the following data: [board data in JSON format]"
- Delete a board: "Delete the board with ID [board-id]"

## Available Tools

The MCP server provides the following tools:

1. `get-boards`: Lists all available kanban boards
2. `create-board`: Creates a new kanban board with a specified name
3. `get-board`: Gets a specific board by ID
4. `update-board`: Updates an existing board with new data
5. `delete-board`: Deletes a board by ID

## Note

This MCP server updates the project's JSON files directly and does not use local storage, in accordance with the project requirements.
