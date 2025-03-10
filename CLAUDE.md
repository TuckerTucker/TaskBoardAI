# CLAUDE.md - TKR-Kanban Project Guide

## Build & Run Commands
- Start server: `npm start` or `./_start_kanban`
- Start specific board: `./_start_kanban <board_name>`
- Create new board: `./_start_kanban --new <board_name>`
- List available boards: `./_start_kanban --list`
- Stop running instances: `./_start_kanban --stop`

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