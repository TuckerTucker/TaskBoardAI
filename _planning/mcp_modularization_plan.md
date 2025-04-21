# Modularization of `kanbanMcpServer.js` — Implementation Plan

## 1. Prepare Planning Artifacts
- Create a new file `_planning/mcp_modularization_plan.md` to track this plan and progress.

## 2. Create New Module Files
- `server/mcp/config.js`
- `server/mcp/rateLimiter.js`
- `server/mcp/tools/boards.js`
- `server/mcp/tools/cards.js`
- `server/mcp/tools/serverControl.js`
- (Optional) `server/mcp/utils.js` for shared helpers

## 3. Extract Configuration Logic
- Move all environment variable handling and config loading from `kanbanMcpServer.js` into `config.js`.
- Export a single `config` object from `config.js`.

## 4. Extract Rate Limiting
- Move the `rateLimits` object and `checkRateLimit()` function into `rateLimiter.js`.
- Export `checkRateLimit()`.

## 5. Extract Board-Related Tools
- From `kanbanMcpServer.js`, move the following MCP tools into `tools/boards.js`:
  - `get-boards`
  - `create-board`
  - `get-board`
  - `update-board`
  - `delete-board`
- Import `config` and `checkRateLimit` as needed.
- Remove the migration tool (`migrate-to-card-first`) entirely.

## 6. Extract Card-Related Tools
- Move the following MCP tools into `tools/cards.js`:
  - `get-card`
  - `update-card`
  - `move-card`
  - `batch-cards`
- Import `config` and `checkRateLimit` as needed.

## 7. Extract Server Control Tool
- Move the `start-webserver` tool into `tools/serverControl.js`.
- Import `config` as needed.

## 8. Refactor Tool Modules
- Each tool module should export a function, e.g., `registerBoardTools(server)`, that takes the MCP server instance and registers all related tools.
- This enables clean registration from the main file.

## 9. Refactor Main MCP Server File
- In `kanbanMcpServer.js`:
  - Import `config.js` and `rateLimiter.js`.
  - Initialize the MCP server instance.
  - Import and invoke `registerBoardTools(server)`, `registerCardTools(server)`, and `registerServerControlTools(server)`.
  - Setup stdio transport and startup logic.
  - Export the server instance.
  - Remove all tool definitions from this file.

## 10. Remove Migration Tool
- Delete the `migrate-to-card-first` tool code.
- Do not include it in any module.

## 11. Test Modularized Server
- Verify the MCP server starts correctly.
- Test all tools for correct registration and functionality.
- Confirm the migration tool is no longer available.

## 12. Update Documentation
- Document the new module structure in `_planning/technical_documentation.md`.
- Add notes about the removal of migration support.
