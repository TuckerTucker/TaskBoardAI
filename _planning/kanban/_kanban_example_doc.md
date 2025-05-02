{
  "projectName": "Project Example", // Name displayed at the top of the board
  "id": "4fb7b001-0f86-4987-af0d-575ee975d11c", // board uuid 
  "columns": [ // Array of column definitions
    {
      "id": "to-do", // Unique identifier for the column
      "name": "To Do" // Display name of the column
    },
    {
      "id": "in-progress",
      "name": "In Progress"
    },
    {
      "id": "done",
      "name": "Done"
    },
    {
      "id": "blocked",
      "name": "Blocked"
    }
  ],
  "cards": [ // Array of all cards in the board
    {
      "id": "feature-one", // Unique identifier for the card
      "title": "Feature One", // Card title displayed in the header
      "content": "## Feature Description\n\n- Point 1\n- Point 2\n\nAdditional details here.", // markdown is supported
      "columnId": "to-do", // ID of the column this card belongs to
      "collapsed": false, // Whether the card is currently collapsed (boolean)
      "position": 0, // Position within the column (0-indexed)
      "subtasks": [ // Array of subtask strings, prefix with ✓ to mark as complete
        "✓ Task One", // completed subtask
        "Task Two" // task in progress
      ],
      "tags": [ // Array of tag strings for categorization
        "feature",
        "frontend"
      ],
      "dependencies": [ // Array of card IDs that this card depends on
        "feature-two"
      ],
      "created_at": "2025-01-18T10:00:00.000Z", // ISO timestamp when card was created
      "updated_at": "2025-01-19T12:30:00.000Z" // ISO timestamp of last card update
    },
    {
      "id": "feature-two",
      "title": "Feature Two",
      "content": "A basic feature description",
      "columnId": "in-progress",
      "position": 0,
      "collapsed": true,
      "subtasks": [],
      "tags": ["backend", "another tag", "exmaple of a tag"],
      "dependencies": [],
      "created_at": "2025-01-18T11:15:00.000Z",
      "updated_at": "2025-01-19T14:45:00.000Z"
    },
    {
      "id": "completed-feature",
      "title": "Completed Feature",
      "content": "This feature is done",
      "columnId": "done",
      "position": 0,
      "collapsed": false,
      "subtasks": [
        "✓ Task One",
        "✓ Task Two",
        "✓ Task Three"
      ],
      "tags": ["complete"], 
      "dependencies": [],
      "created_at": "2025-01-17T09:30:00.000Z",
      "updated_at": "2025-01-19T18:12:35.604Z",
      "completed_at": "2025-01-19T18:12:35.604Z" // ISO timestamp when moved to Done
    },
    {
      "id": "example-blocked-feature",
      "title": "Example Blocked Feature",
      "content": "the card description.",
      "columnId": "blocked",
      "position": 0,
      "collapsed": false,
      "subtasks": [
        "✓ Task One",
        "✓ Task Two",
        "✓ Task Three"
      ],
      "tags": ["blocked", "backend"],
      "dependencies": ["feature-two"],
      "created_at": "2025-01-18T13:45:00.000Z",
      "updated_at": "2025-01-19T16:20:00.000Z",
      "blocked_at": "2025-01-19T16:20:00.000Z" // ISO timestamp when moved to Blocked
    }
  ],
  "next-steps": [ // Array of next priority tasks and focus areas
    "Complete user-info feature slice",
    "Review completed features for proper types, structures, and architecture"
  ],
  "last_updated": "2025-01-19T19:20:14.802Z", // ISO timestamp of last board update
  "isDragging": false, // Internal state for drag operations
  "scrollToColumn": null // ID of column to auto-scroll to, or null
}