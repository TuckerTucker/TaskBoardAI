# NPM Packaging Checklist

This document outlines the necessary changes to ensure that TaskBoardAI works correctly when published to npm.

## Required Changes

### 1. Package Entry Points
- Add a `bin` field in package.json for CLI scripts:
  ```json
  "bin": {
    "taskboard": "./bin/taskboard.js",
    "taskboard-mcp": "./bin/taskboard-mcp.js" 
  }
  ```
- Create executable JS scripts in a `bin` directory that handle both Windows and Unix environments

### 2. Path Resolution
- Update file path handling in `server/config/config.js` to:
  - Use `__dirname` for package installation paths
  - Support running from node_modules
  - Resolve relative paths correctly regardless of working directory
- Use `os.homedir()` for storing board data in user's home directory
- Create an app data directory for storing boards and config files

### 3. File Inclusions
- Create an `.npmignore` file to:
  - Exclude development files (tests, CI configs, docs source)
  - Ensure required directories are included (boards templates, app)
- Include example boards and templates in the package

### 4. Script Portability
- Replace shell scripts with cross-platform JavaScript equivalents
- Add Node.js versions of `start_kanban` and `start_mcp` scripts
- Ensure Windows compatibility for all commands

### 5. Installation Documentation
- Update README.md with npm installation instructions:
  ```
  npm install -g taskboardai
  ```
- Document global vs local installation options
- Provide clear usage examples for npm-installed version

### 6. Data Directory Management
- Add logic to create and initialize data directories:
  - Default to `~/.taskboardai/boards` for storing board data
  - Include config directory for settings
  - Provide fallback if home directory isn't available
- Include migration tool for existing board data

### 7. Dependencies
- Review dependencies to ensure they're all properly specified
- Remove any dev dependencies from runtime code
- Add appropriate `engines` field in package.json for Node.js version requirements

### 8. Asset Organization
- Move favicon and other static assets to standard directories:
  - Relocate favicon to `/app/public/favicon.png`
  - Update HTML references to use the new paths
  - Configure Express to serve from the new locations
- Ensure assets are properly included in the npm package

## Implementation Plan

1. Create the `bin` directory with cross-platform JavaScript CLI scripts
2. Update the config file to handle npm installation paths
3. Create data directory initialization logic
4. Update the README with npm installation instructions
5. Relocate static assets to their proper locations
6. Test the package locally with `npm link`
7. Publish to npm when ready