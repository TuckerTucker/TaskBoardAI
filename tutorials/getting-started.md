# Getting Started with TaskBoardAI

This tutorial will guide you through the basic setup and usage of TaskBoardAI.

## Installation

First, make sure you have Node.js installed on your system. Then:

1. Clone the repository:
   ```bash
   git clone https://github.com/TuckerTucker/TaskBoardAI.git
   cd TaskBoardAI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Creating Your First Board

1. Create a new board using the start script:
   ```bash
   ./_start_kanban --new my-project
   ```

2. The server will start and you can access your board at http://localhost:3001

## Board Interface

The TaskBoardAI interface consists of several components:

- **Header**: Contains the project name and action buttons
- **Columns**: Vertical sections representing workflow stages
- **Cards**: Individual items within columns
- **NextSteps**: Panel for tracking upcoming priorities

## Adding and Managing Cards

1. **Create a new card**:
   - Click the "+" button at the top of any column
   - Enter a title and content (supports Markdown)
   - Add optional subtasks, tags, and dependencies

2. **Edit a card**:
   - Click on a card to open it
   - Make your changes and click "Save"

3. **Move a card**:
   - Drag and drop cards between columns
   - The board state automatically saves

## Working with Markdown

Cards support full Markdown syntax:

```markdown
## Card Heading

- Bullet point list
- Another point

**Bold text** and *italic text*

[Links](https://example.com)

```

## Using Subtasks

Subtasks allow you to break down cards into smaller actionable items:

1. Add subtasks when creating or editing a card
2. Mark subtasks as complete by prefixing them with "✓" (will be done automatically when you click on them)

## Working with Tags

Tags help categorize and filter your cards:

1. Add tags to cards when creating or editing
2. Use consistent tag names to make filtering easier

## Using the AI Features

If you have Claude for Desktop, you can use the AI features:

1. Start the MCP server:
   ```bash
   ./_start_mcp
   ```

2. Configure Claude (see README_MCP.md for details)

3. Ask Claude to help you manage your boards:
   ```
   Create a new board called "Marketing Campaign"
   ```

## Next Steps

After mastering the basics, explore:

- Webhook integration for external service connectivity
- Custom board configurations
- Multi-board management