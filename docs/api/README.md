# TaskBoardAI API Documentation

This directory contains API documentation for TaskBoardAI.

## Documentation Files

- [MCP Tools Documentation](./mcp-tools.md) - Detailed information about token-optimized MCP tools
- [MCP Code Examples](./mcp-examples.md) - Practical examples of using MCP tools with token optimization
- [Migration Guide](./migration-guide.md) - Guide to migrating existing code to token-optimized tools

## Generating JSDoc Documentation

To generate the JSDoc documentation:

```bash
npm run docs
```

## Viewing Documentation

After generating the documentation, you can view it by:

1. Running the doc server:
   ```bash
   npm run docs:serve
   ```

2. Or opening the `index.html` file in this directory

## Documentation Structure

The API documentation is organized into the following sections:

- **Models**: Data structures and database interaction
- **Controllers**: API endpoint handlers
- **Routes**: API route definitions
- **Utils**: Utility functions and helpers
- **MCP**: Model Context Protocol server implementation

## API Overview

TaskBoardAI provides both a RESTful API and MCP tools for managing kanban boards:

### REST API
- **Board Operations**: Create, read, update, and delete boards
- **Configuration**: Manage application settings
- **Webhooks**: Configure external integrations

### MCP Tools (Token-Optimized)
- **Board Management**: Create, read, update, and delete boards
- **Card Operations**: Get, update, and move individual cards
- **Batch Operations**: Process multiple card updates and moves in a single transaction
- **Format Controls**: Request data in different formats for token optimization

For detailed REST API endpoint documentation, see the Controllers section.

For detailed MCP tools documentation, see the [MCP Tools Documentation](./mcp-tools.md).