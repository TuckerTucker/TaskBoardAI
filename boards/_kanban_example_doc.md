{
  "projectName": "Project Example", // Name displayed at the top of the board
  "columns": [ // Array of columns in the board. New columns can be added if required. 
    {
      "id": "to-do", // Unique identifier for the column, auto-generated from name
      "name": "To Do", // Display name of the column
      "items": [ // Array of cards in this column
        {
          "id": "feature-one", // Unique identifier for the card, auto-generated from name
          "title": "Feature One", // Card title displayed in the header
          "content": "## Feature Description\n\n- Point 1\n- Point 2\n\nAdditional details here.", // markdown is supported
          "collapsed": false, // Whether the card is currently collapsed (boolean)
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
          ]
        }
      ]
    },
    {
      "id": "in-progress",
      "name": "In Progress",
      "items": [
        {
          "id": "feature-two",
          "title": "Feature Two",
          "content": "A basic feature description",
          "collapsed": true,
          "subtasks": [],
          "tags": ["backend", "another tag", "exmaple of a tag"],
          "dependencies": []
        }
      ]
    },
    {
      "id": "done",
      "name": "Done",
      "items": [
        {
          "id": "completed-feature",
          "title": "Completed Feature",
          "content": "This feature is done",
          "collapsed": false,
          "subtasks": [
            "✓ Task One",
            "✓ Task Two",
            "✓ Task Three",
          ],
          "tags": ["complete"], // add the completed tag. Don't remove the others. 
          "dependencies": [],
          "completed_at": "2025-01-19T18:12:35.604Z" // ISO timestamp when moved to Done
        }
      ]
    },
    {
      "id": "blocked",
      "name": "Blocked",
      "items": [
        {
          "id": "example-blocked-feature",
          "title": "Example Blocked Feature",
          "content": "the card description.",
          "collapsed": false,
          "subtasks": [
            "✓ Task One",
            "✓ Task Two",
            "✓ Task Three",
          ],
          "tags": ["blocked","backend"], // add the completed tag. Don't remove the others. 
          "dependencies": ["feature-two"],
          "completed_at": "2025-01-19T18:12:35.604Z" // ISO timestamp when moved to Done
        }
      ]
    }

  ],
  "next-steps": [ // Array of next priority tasks and focus areas
    "Complete user-info feature slice",
    "Review completed features for proper types, structures, and architecture",
  ],
  "last_updated": "2025-01-19T19:20:14.802Z", // ISO timestamp of last board update
  "isDragging": false, // Internal state for drag operations
  "scrollToColumn": null // ID of column to auto-scroll to, or null
}