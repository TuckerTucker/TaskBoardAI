# OSS Public Release Branch Plan

This document outlines the detailed plan for creating and maintaining the `public-release` branch for the TaskBoardAI open-source project.

## Repository Setup

- **Origin Repository**: Private repository at `https://github.com/TuckerTucker/tkr-kanban.git`
- **Public Repository**: Public repository at `git@github.com:TuckerTucker/TaskBoardAI.git`
- **Branch Strategy**: Maintain a `public-release` branch in the private repository that will be pushed to the main branch of the public repository

## Content Selection

### Include in OSS Branch:

1. **Core Application Code:**
   - All frontend components in `app/`
   - Server implementation in `server/`
   - MCP server implementation in `server/mcp/`
   - Webhooks functionality in `server/models/Webhook.js` and related files

2. **Documentation:**
   - README.md (updated for OSS release)
   - README_MCP.md
   - New LICENSE file (Apache 2.0)
   - New CONTRIBUTING.md file
   - New CODE_OF_CONDUCT.md file

3. **Configuration:**
   - Template/example configuration files (with sensitive info removed)
   - Example board template: `boards/_kanban_example.json`

4. **Scripts:**
   - Start scripts: `start_kanban`, `start_mcp`, `start_all`

### Exclude from OSS Branch:

1. **Personal/Private Data:**
   - All personal board files in `boards/` (except the example template)
   - Any config files with credentials or sensitive information

2. **Development Files:**
   - Archive directory (`_archive/`)
   - OSS plan files (`_oss_plan/`)
   - Any files with internal documentation or notes

3. **Proprietary Integrations:**
   - Any code that integrates with proprietary systems or includes API keys

## Implementation Steps

1. **Clean Repository Structure:**
   ```bash
   # Ensure we're on the public-release branch
   git checkout public-release
   
   # Clean the branch for fresh start
   git rm -rf .
   git commit -m "Clear branch for public release"
   ```

2. **Copy Core Files:**
   ```bash
   # Copy application code
   git checkout main -- app/
   git checkout main -- server/
   git checkout main -- package.json
   git checkout main -- start_*
   
   # Copy basic configuration
   git checkout main -- config/config.json
   
   # Copy example board template
   mkdir -p boards
   git checkout main -- boards/_kanban_example.json
   
   # Create empty directories with .gitkeep files
   mkdir -p webhooks
   touch webhooks/.gitkeep
   
   # Copy existing documentation
   git checkout main -- README.md
   git checkout main -- README_MCP.md
   
   # Commit the core files
   git add .
   git commit -m "Add core application files for public release"
   ```

3. **Create/Update Documentation:**
   ```bash
   # Create LICENSE file (Apache 2.0)
   # Create CONTRIBUTING.md
   # Create CODE_OF_CONDUCT.md
   # Update README.md for TaskBoardAI
   
   git add LICENSE CONTRIBUTING.md CODE_OF_CONDUCT.md README.md
   git commit -m "Add open source documentation files"
   ```

4. **Sanitize Configuration:**
   ```bash
   # Review and update config files to remove any sensitive information
   # Create example configuration templates
   
   git add config/
   git commit -m "Update configuration files for public release"
   ```

5. **Create Public .gitignore:**
   ```bash
   # Create a .gitignore file specific to the public repository
   cat > .gitignore << EOF
   # Node modules
   node_modules/
   
   # Personal boards
   boards/*.json
   !boards/_kanban_example.json
   
   # Webhook configurations
   webhooks/*.json
   
   # Environment variables
   .env
   .env.*
   
   # IDE files
   .vscode/
   .idea/
   *.sublime-*
   
   # OS files
   .DS_Store
   Thumbs.db
   
   # Logs
   logs/
   *.log
   npm-debug.log*
   
   # Build artifacts
   dist/
   build/
   EOF
   
   git add .gitignore
   git commit -m "Add public branch gitignore"
   ```

6. **Update Package Info:**
   ```bash
   # Update package.json for the public repository
   # - Change name to "taskboardai"
   # - Update repository URL
   # - Add proper license field
   # - Add keywords, author, etc.
   
   git add package.json
   git commit -m "Update package.json for public release"
   ```

## Maintenance Workflow

1. **Regular Updates:**
   ```bash
   # On the main branch, make your changes and commit them
   
   # When ready to update the public repository:
   git checkout public-release
   
   # Update specific files or directories:
   git checkout main -- app/
   git checkout main -- server/
   
   # Review changes to ensure no private data is included
   git diff --cached
   
   # Commit the changes
   git commit -m "Update public release with latest changes"
   
   # Push to the public repository
   git push public public-release:main
   ```

2. **Version Releases:**
   ```bash
   # Tag your release in the public branch
   git checkout public-release
   git tag -a v1.0.0 -m "Version 1.0.0 release"
   git push public v1.0.0
   ```

## Pre-Release Checklist

Before pushing to the public repository, verify:

- [ ] No personal board data is included
- [ ] No API keys, tokens, or credentials are present
- [ ] All documentation is updated for public consumption
- [ ] Example configuration and board templates are present
- [ ] LICENSE, CONTRIBUTING, and CODE_OF_CONDUCT files are included
- [ ] Package.json is updated with proper metadata
- [ ] All code is functional and follows best practices
- [ ] .gitignore is properly configured

This workflow provides a structured approach to maintaining separation between private and public code while enabling controlled releases to the open-source community.