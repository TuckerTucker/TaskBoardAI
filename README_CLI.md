# TaskBoardAI CLI Guide

This document outlines the command-line interface options for working with the TKR-Kanban application.

## Basic Commands

- **Start server**: 
  ```
  npm start
  ```
  or
  ```
  ./_start_kanban
  ```

- **Start specific board**:
  ```
  ./_start_kanban <board_name>
  ```

- **Create new board**:
  ```
  ./_start_kanban --new <board_name>
  ```

- **List available boards**:
  ```
  ./_start_kanban --list
  ```

- **Stop running instances**:
  ```
  ./_start_kanban --stop
  ```

## Advanced Options

- **Start with custom port**:
  ```
  ./_start_kanban --port <port_number>
  ```

- **Start in development mode**:
  ```
  ./_start_kanban --dev
  ```

## Examples

```
# Start the default board
./_start_kanban

# Start a specific board named "project-alpha"
./_start_kanban project-alpha

# Create a new board named "new-project"
./_start_kanban --new new-project

# List all available boards
./_start_kanban --list

# Start board "dev-board" on port 4000
./_start_kanban dev-board --port 4000
```