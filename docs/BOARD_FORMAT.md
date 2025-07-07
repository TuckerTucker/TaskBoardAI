# TaskBoardAI Board Format Reference

This document provides a comprehensive reference for the board data structure used by TaskBoardAI. It's important to maintain this format when working with the API to ensure compatibility with the UI.

## Board Structure

A board is the top-level container that holds columns and cards. Here's the complete structure:

```json
{
  "projectName": "My Kanban Board",
  "id": "unique-board-id-uuid",
  "columns": [
    {
      "id": "column-id-1",
      "name": "To Do"
    },
    {
      "id": "column-id-2",
      "name": "In Progress"
    },
    {
      "id": "column-id-3",
      "name": "Done"
    }
  ],
  "cards": [
    {
      "id": "card-id-1",
      "title": "Card Title",
      "content": "Card description with **markdown** support",
      "columnId": "column-id-1",
      "position": 0,
      "collapsed": false,
      "subtasks": [
        "✓ Completed subtask",
        "Pending subtask"
      ],
      "tags": [
        "feature",
        "frontend"
      ],
      "dependencies": [
        "card-id-2"
      ],
      "priority": "high",
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-02T00:00:00.000Z"
    }
  ],
  "next-steps": [
    "Complete feature X",
    "Review design for feature Y"
  ],
  "last_updated": "2023-01-02T00:00:00.000Z",
  "isDragging": false,
  "scrollToColumn": null
}
```

## Field Descriptions

### Board Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectName` | string | Yes | Display name of the board |
| `id` | string | Yes | Unique identifier for the board (UUID format) |
| `columns` | array | Yes | Array of column objects |
| `cards` | array | Yes | Array of card objects |
| `next-steps` | array | No | Array of strings with upcoming tasks |
| `last_updated` | string | Yes | ISO timestamp of last update |
| `isDragging` | boolean | No | Runtime state for drag operations |
| `scrollToColumn` | string | No | ID of column to auto-scroll to, or null |

### Column Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the column |
| `name` | string | Yes | Display name of the column |
| `position` | number | No | Position index for ordering columns |

### Card Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the card (UUID format) |
| `title` | string | Yes | Card title displayed in the header |
| `content` | string | No | Markdown content for card description |
| `columnId` | string | Yes | ID of the column this card belongs to |
| `position` | number | Yes | Position within the column (0-indexed) |
| `collapsed` | boolean | No | Whether the card is currently collapsed |
| `subtasks` | array | No | Array of subtask strings, prefix with ✓ to mark as complete |
| `tags` | array | No | Array of tag strings for categorization |
| `dependencies` | array | No | Array of card IDs that this card depends on |
| `priority` | string | No | Priority level: "high", "medium", or "low" |
| `created_at` | string | Yes | ISO timestamp when card was created |
| `updated_at` | string | Yes | ISO timestamp of last card update |
| `completed_at` | string | No | ISO timestamp when card was moved to Done column |
| `blocked_at` | string | No | ISO timestamp when card was moved to Blocked column |

## Common Operations

### Creating a New Card

When creating a new card using batch-cards, both `cardData` and `columnId` are optional but recommended:

```json
{
  "type": "create",
  "columnId": "column-id",  // OPTIONAL: Defaults to first column if omitted
  "cardData": {             // OPTIONAL: Defaults to card with auto-generated title if omitted
    "title": "New Card Title",
    "content": "Card description",
    "position": 0,            // Optional: defaults to last position
    // The following fields are set automatically:
    // - columnId (from the operation's columnId)
    // - id (auto-generated UUID)
    // - created_at and updated_at (current timestamp)
  }
}
```

If both `columnId` and `cardData` are omitted, a card with a default title will be created in the first column:

```json
{
  "type": "create"
  // Everything else will be auto-generated with defaults
}
```

### Updating a Card

When updating a card, you only need to include the fields you want to change:

```json
{
  "type": "update",
  "cardId": "card-id",
  "cardData": {
    "title": "Updated Title",
    "content": "Updated content"
  }
}
```

### Moving a Card

To move a card between columns:

```json
{
  "type": "move",
  "cardId": "card-id",
  "columnId": "target-column-id",
  "position": "last"
}
```

## Best Practices

1. **Always generate UUIDs for new cards and columns** - Use `crypto.randomUUID()` for consistent ID generation
2. **Maintain proper columnId references** - Ensure card.columnId exists in board.columns
3. **Set timestamps correctly** - Use ISO format, update timestamps when changing cards
4. **Handle dependencies carefully** - Ensure dependency IDs refer to existing cards
5. **Prefix completed subtasks with ✓** - Use "✓ " prefix for completed tasks

This reference should help you maintain the correct board format when working with the TaskBoardAI API.