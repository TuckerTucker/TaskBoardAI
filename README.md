# tkr-kanban

A lightweight, file-based kanban board for managing tasks and projects. Features drag-and-drop cards, markdown support, subtasks, tags, and dependencies.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/TuckerTucker/tkr-kanban.git
cd tkr-kanban
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Starting a Local Board

1. List available boards:
```bash
./_start_kanban --list
```

2. Create a new board using the start script:
```bash
./_start_kanban --new my-project
```

3. Or use an existing board:
```bash
./_start_kanban my-project.json
```

4. Access your board at `http://localhost:3000`

### Using an External Board Location

1. Create a new board directory anywhere on your system
2. Copy the example board:
```bash
cp /path/to/tkr-kanban/boards/_kanban_example.json /your/board/location/board_name.json
```

3. Start the server with your external board location:
```bash
./_start_kanban --external /your/board/location/board_name.json
```

## Board Structure

The kanban board is defined in a JSON file with the following structure:

```json
{
  "projectName": "Project Name",
  "columns": [
    {
      "id": "column-id",
      "name": "Column Name",
      "items": [
        {
          "id": "card-id",
          "title": "Card Title",
          "content": "Markdown supported content",
          "collapsed": false,
          "subtasks": [
            "✓ Completed task",
            "Pending task"
          ],
          "tags": ["feature", "frontend"],
          "dependencies": ["other-card-id"],
          "completed_at": "2025-01-19T18:12:35.604Z"
        }
      ]
    }
  ],
  "next-steps": [
    "Next priority task",
    "Future focus area"
  ],
  "last_updated": "2025-01-19T19:20:14.802Z",
  "isDragging": false,
  "scrollToColumn": null
}
```

### Key Features

- **Markdown Support**: Card content supports full markdown syntax
- **Subtasks**: Prefix with "✓" to mark as complete
- **Tags**: Categorize cards with custom tags
- **Dependencies**: Link cards to track dependencies
- **Collapsible Cards**: Toggle card content visibility
- **Drag and Drop**: Reorder cards and move between columns
- **Next Steps**: Track upcoming priorities at the board level
