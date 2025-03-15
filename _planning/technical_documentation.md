# TaskBoardAI Kanban Application: Technical Documentation

## Overview

TaskBoardAI is a sophisticated Kanban board application featuring a modular, component-based architecture. The application employs a card-first architecture where cards are the primary data entities, associated with columns through column IDs rather than being nested within column objects.

## Application Architecture

### Frontend Structure

The frontend is organized in a component-based architecture using ES modules:

```
app/
├── css/               # Styling
│   ├── base/          # Base styles (variables, reset)
│   ├── components/    # Component-specific styles
│   ├── layout/        # Layout styles
│   └── main.css       # CSS entry point
├── js/
│   ├── app.js         # Application entry point
│   ├── components/    # UI components
│   ├── core/          # Core functionality
│   ├── services/      # Service layers
│   └── utils/         # Utility functions
├── index.html         # Main HTML structure
└── public/            # Static assets
```

### Core Components

1. **Card** - Represents a task with:
   - Title and markdown content
   - Subtasks with completion status
   - Tags for categorization
   - Dependencies on other cards
   - Collapsible display
   - Drag-and-drop capability

2. **Column** - Represents a workflow stage with:
   - Title
   - Cards container
   - Column-specific type styling
   - Expand/collapse all functionality
   - Drag-and-drop capability

3. **Settings** - Manages application configuration:
   - Board management (create, load, delete boards)
   - Import/export functionality
   - UI theme configuration
   - Webhook integration management

4. **NextSteps** - Sidebar showing prioritized next actions

### State Management

The application uses a centralized state management pattern:

- **StateManager** (Singleton):
  - Maintains the application state
  - Handles state modifications
  - Manages persistence through API
  - Provides a pub/sub system for state changes
  - Handles board operations (add/remove columns, cards)

### Data Structure

The application uses a card-first architecture:

```json
{
  "projectName": "Project Name",
  "columns": [
    { "id": "column-id", "name": "Column Name" }
  ],
  "cards": [
    {
      "id": "card-id",
      "title": "Card Title",
      "content": "Markdown content",
      "columnId": "column-id",
      "position": 0,
      "collapsed": false,
      "subtasks": ["Task 1", "✓ Completed Task"],
      "tags": ["feature", "backend"],
      "dependencies": ["dependency-card-id"],
      "created_at": "ISO date",
      "updated_at": "ISO date"
    }
  ],
  "next-steps": ["Step 1", "Step 2"]
}
```

## Visual Design & Layout

### Layout Structure

1. **Header**
   - Project name (editable)
   - Board selector dropdown
   - Add column button
   - Settings button

2. **Main Content**
   - Next Steps sidebar (left)
   - Horizontally scrollable board with columns

3. **Columns**
   - Column header with name and actions
   - Vertically scrollable cards container

4. **Cards**
   - Header with title and actions (collapse, delete)
   - Content section with markdown support
   - Subtasks with completion status
   - Dependencies with links to referenced cards
   - Tags

5. **Modals**
   - Settings modal with tabs
   - Board management interface
   - Webhook configuration

### Visual Styling

The application uses a CSS variables system for theming:

1. **Color Scheme**
   - Dark theme foundation
   - Color-coded columns (blue, green, orange, gray)
   - Card headers visually differentiating workflow stages

2. **Typography**
   - Inter font family
   - Hierarchical sizing
   - Markdown rendering for card descriptions

3. **Spacing & Layout**
   - Consistent spacing variables
   - Responsive column sizing
   - Mobile responsiveness (partial)

4. **Visual Effects**
   - Subtle hover effects on interactive elements
   - Smooth animations for collapsing/expanding
   - Highlight animations for dependencies
   - Subtle shadows for depth

## Interaction Model

### Drag and Drop

The application features a sophisticated drag-and-drop system:

1. **Card Dragging**
   - Drag cards within and between columns
   - Visual feedback during drag
   - Position calculation for accurate placement

2. **Column Dragging**
   - Reorder columns in the board
   - Visual feedback during drag
   - Automatic state update on drop

### State Persistence

The application manages state through:

1. **API Service**
   - RESTful API for board operations
   - Data saving and loading
   - Error handling with fallbacks
   - Webhook integration

2. **Local Storage**
   - Fallback for offline operation
   - Board selection persistence

### User Interactions

Key interactions include:

1. **Board Management**
   - Create new boards
   - Switch between boards
   - Import/export boards
   - Delete boards

2. **Card Operations**
   - Create/edit/delete cards
   - Move cards between columns
   - Collapse/expand cards
   - View and navigate dependencies

3. **Column Management**
   - Add/rename/delete columns
   - Reorder columns
   - Collapse/expand all cards in column

## Functionality Details

### Markdown Support

Cards support full Markdown rendering:
- Headers, lists, emphasis
- Code blocks
- Links
- Custom styling of rendered Markdown

### Card Dependencies

The application supports card dependencies:
- Reference other cards as dependencies
- Click to highlight and navigate to dependency
- Visual indication of dependency relationships

### Subtasks

Cards include subtask tracking:
- List of subtasks with completion status
- Visual indication of completion
- Toggling completion status

### Next Steps Feature

A prioritized sidebar shows important next actions:
- Ordered list of next steps
- Persistent across board views
- Automatically updated from state

### Settings & Configuration

Comprehensive settings management:
- Theme configuration
- Server connection options
- Board creation and management
- Webhook integration for external services

## Development Patterns

1. **Component-Based Architecture**
   - Self-contained components with rendering and event handling
   - Clear responsibility boundaries
   - DOM-based rendering without framework dependencies

2. **Singleton Services**
   - State manager
   - API service
   - Drag-drop manager

3. **Publisher-Subscriber Pattern**
   - State changes notify subscribers
   - Components react to state updates
   - Decoupled communication

4. **Error Handling**
   - Graceful degradation
   - Error messages with timeouts
   - Fallbacks for API failures

## Opportunities for Enhancement

1. **Visual Design**
   - Enhanced card visualization options
   - Additional themes
   - Customizable column colors

2. **Functionality**
   - Card filtering and search
   - Advanced reporting and metrics
   - Time tracking integration
   - User assignments and collaboration

3. **UI/UX Improvements**
   - More intuitive card editing
   - Contextual menus for advanced operations
   - Improved mobile support
   - Keyboard shortcuts

4. **Integration**
   - Integration with additional external services
   - Expanded webhook capabilities
   - Authentication and user management

## Data Models

### Card

```
{
  id: string,                  // Unique identifier
  title: string,               // Card title
  content: string,             // Markdown content
  columnId: string,            // Parent column ID
  position: number,            // Position in column
  collapsed: boolean,          // UI state
  subtasks: string[],          // Subtasks (prefixed with ✓ if completed)
  tags: string[],              // Tag labels
  dependencies: string[],      // IDs of cards this card depends on
  created_at: string,          // ISO date string
  updated_at: string,          // ISO date string
  completed_at?: string        // ISO date when moved to "Done"
}
```

### Column

```
{
  id: string,                  // Unique identifier
  name: string                 // Column name
}
```

### Board

```
{
  projectName: string,         // Board title
  id: string,                  // Unique identifier
  columns: Column[],           // Columns array
  cards: Card[],               // Cards array
  next-steps: string[],        // Prioritized next actions
  last_updated: string         // ISO date string
}
```