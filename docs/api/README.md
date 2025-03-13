# TaskBoardAI API Documentation

This directory contains automatically generated API documentation for TaskBoardAI.

## Generating Documentation

To generate the documentation:

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

TaskBoardAI provides a RESTful API for managing kanban boards:

- **Board Operations**: Create, read, update, and delete boards
- **Configuration**: Manage application settings
- **Webhooks**: Configure external integrations

For detailed API endpoint documentation, see the Controllers section.