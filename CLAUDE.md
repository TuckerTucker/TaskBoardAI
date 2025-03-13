# CLAUDE.md - TKR-Kanban Project Guide

## Build & Run Commands
- Start server: `npm start` or `./_start_kanban`
- Start specific board: `./_start_kanban <board_name>`
- Create new board: `./_start_kanban --new <board_name>`
- List available boards: `./_start_kanban --list`
- Stop running instances: `./_start_kanban --stop`

## Testing Commands
- Run all tests: `npm test`
- Run tests with coverage: `npm run test:coverage`
- Run tests in watch mode: `npm run test:watch`
- Run specific test: `npx jest path/to/test.js`

## Code Style Guidelines

### File Structure
- Frontend: `app/` - Contains HTML, CSS, JS using component-based architecture
- Backend: `server/` - Express-based API with MVC pattern
- Board data: `boards/` - JSON files for kanban boards

### JavaScript Standards
- Use ES modules for frontend (`import/export`)
- Use CommonJS for backend (`require/module.exports`)
- Class-based components with clear responsibility boundaries
- Singleton pattern for services and managers

### Naming Conventions
- Classes: PascalCase (e.g., `StateManager`, `Card`)
- Functions/variables: camelCase (e.g., `saveState`, `isDragging`)
- Constants: UPPER_CASE or camelCase based on scope
- Files: Component files match class names (e.g., `Card.js`)

### Error Handling
- Use try/catch blocks for async operations
- Log errors to console with descriptive messages
- Provide user-friendly error messages via UI
- Return appropriate HTTP status codes from API

### Testing
- use a Testing Pyramid process
- use jest
- generate test coverage when test writing is complete

## Slash Actions
Slash actions may appear in the user's message.

/commit = "Write a succinct commit message"

/chat_start = "
Review @_planning for project details | Review codebase for current implementation. No coding. Just understanding."

/proceed = "proceed in optimal order. Complete only the required changes. Do not try to optimize or streamline the code along the way. Do not Change any variable/module/import names without first checking the impact."

/five = "use the five why's process to evaluate this issue"

/step = "Think through this step-by-step"

/minima = " Keep in mind we are building full-stack applications. A break/fix approach to problem solving isn't always appropriate.  You might get stuck in "local minima" or over-index on immediate, obvious problems. Sometimes you'll need to step back and think differently or review the process holistically."