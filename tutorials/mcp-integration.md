# AI Integration with Claude

This tutorial explains how to use TaskBoardAI's Model Context Protocol (MCP) integration with Claude for Desktop.

## What is MCP Integration?

TaskBoardAI includes an MCP server that allows Claude to directly interact with your kanban boards. This enables:

- Creating and managing boards through natural language
- Analyzing board data and providing insights
- Automating board operations via AI assistance

## Requirements

- TaskBoardAI installed
- Claude for Desktop application
- Node.js environment

## Setup

### 1. Start the MCP Server

First, start the MCP server:

```bash
./_start_mcp
```

Or start both the web interface and MCP server:

```bash
./_start_all
```

### 2. Configure Claude for Desktop

Edit your Claude Desktop configuration file:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

Add the following configuration (adjust the path to match your installation):

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

### 3. Restart Claude for Desktop

Close and reopen Claude for Desktop to load the new configuration.

## Using Claude with TaskBoardAI

### Basic Commands

Ask Claude to manage your boards using natural language:

- **Create a board**: "Create a new kanban board called 'Project X'"
- **List boards**: "Show me all my kanban boards"
- **View board details**: "Show me the board with ID [board-id]"
- **Update a board**: "Update this board with the following data: [board data in JSON format]"
- **Delete a board**: "Delete the board with ID [board-id]"
- **Start the web server**: "Start the TaskBoardAI web server on port 3001"

### Advanced Usage Examples

#### Creating a Board with Custom Structure

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

#### Data Migration and Conversion

```
I have a list of tasks in CSV format. Please convert this to a TaskBoardAI board:

Task,Status,Priority,Assigned To
Implement login,In Progress,High,Alex
Fix homepage CSS,To Do,Medium,Sam
Deploy to staging,To Do,High,Alex
```

#### Token-Optimized Card Operations

TaskBoardAI now supports token-optimized operations for more efficient integration with Claude:

```
Get just the card with ID a1b2c3d4 from board 5ec8b002
```

```
Update the title and tags of card a1b2c3d4 on board 5ec8b002 to "Implement OAuth login" with tags "security", "frontend"
```

```
Move card a1b2c3d4 from the "In Progress" column to the top of the "Testing" column
```

#### Batch Operations for Efficiency

```
Perform the following operations on board 5ec8b002 in a single transaction:
1. Update card a1b2c3 to add "High" priority tag
2. Move card b2c3d4 to "In Progress" column
3. Update card c3d4e5 title to "Revised feature specification"
```

#### Format-Specific Queries

```
Give me a summary view of board 5ec8b002 showing just the project progress statistics
```

```
Show me only the cards in the "Blocked" column of board 5ec8b002
```

#### Board Analysis and Insights

```
Analyze my board with ID 53f0aa65-635e-4b5c-852f-dba9c36c767b and suggest ways to improve task distribution.
```

## How it Works

The MCP integration uses Claude's Model Context Protocol to establish a bidirectional connection between Claude and TaskBoardAI:

1. **Tool Registration**: The MCP server registers tools with Claude
2. **Tool Invocation**: Claude can invoke these tools when you ask relevant questions
3. **API Communication**: The tools communicate with the TaskBoardAI API
4. **Response Processing**: Results are formatted and returned to Claude
5. **Natural Language Interface**: Claude translates between your natural language and the structured API calls

## Token Optimization Features

The latest version includes token-optimized operations for more efficient Claude integration:

### Card-First Architecture

TaskBoardAI now uses a "card-first" architecture that enables direct operations on individual cards without loading the entire board context. This results in:

- **Reduced token usage**: 60-95% fewer tokens for common operations
- **Faster processing**: Less data to parse means quicker responses
- **Improved scalability**: More efficient handling of large boards

### Token-Optimized Tools

The following token-optimized MCP tools are available:

- **get-card**: Retrieve a single card by ID
- **update-card**: Update specific properties of a card
- **move-card**: Change a card's column or position
- **batch-cards**: Process multiple card operations in one transaction

### Format Parameter Options

The `get-board` tool now supports format options to control response size:

- **full**: Complete board data (default)
- **summary**: Board metadata and statistics
- **compact**: Abbreviated property names for smaller response
- **cards-only**: Only returns the cards array, optionally filtered by column

For detailed documentation, see the [MCP Tools Documentation](/docs/api/mcp-tools.md) and [Migration Guide](/docs/api/migration-guide.md).

## Advanced Configuration

### Rate Limiting

The MCP server includes rate limiting to prevent abuse. The default is 60 operations per minute.

### Security Considerations

- The MCP server only accepts connections from localhost by default
- Claude must have access to the file system where TaskBoardAI is installed
- The MCP server has the same filesystem access as the user running it

## Troubleshooting

### Claude doesn't recognize the MCP server

1. Check that the MCP server is running (`ps aux | grep kanbanMcpServer.js`)
2. Verify the configuration path is correct in claude_desktop_config.json
3. Make sure the path uses the correct syntax for your operating system

### Unable to create or update boards

1. Check that the board data structure matches the expected format
2. Verify that Claude has filesystem permissions to access the boards directory
3. Check that any board IDs referenced are valid

## Example Conversations

Here's a sample conversation with Claude:

```
You: Hi Claude, I'd like to create a new kanban board for my marketing campaign.

Claude: I'd be happy to help you create a new kanban board for your marketing campaign. Let me do that for you.

[Claude uses the create-board tool]

Claude: I've created a new kanban board named "Marketing Campaign" for you. The board has been initialized with default columns (To Do, In Progress, and Done).

You can access it through the TaskBoardAI web interface, or I can help you make modifications to it right now. Would you like to add any specific columns or tasks to this board?
```