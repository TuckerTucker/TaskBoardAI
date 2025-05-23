#!/bin/bash

# Public Release Script for TaskBoardAI
# This script automates the creation and maintenance of the public-release branch
# based on the OSS workflow documented in _oss_plan/

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not a git repository"
        exit 1
    fi
}

# Function to check if public remote exists
check_public_remote() {
    if ! git remote get-url public > /dev/null 2>&1; then
        print_warning "Public remote not found"
        echo "Add public remote with: git remote add public git@github.com:TuckerTucker/TaskBoardAI.git"
        read -p "Continue without pushing to public? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        return 1
    fi
    return 0
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  init                Initialize public-release branch"
    echo "  update              Update public-release branch with latest changes"
    echo "  push                Push public-release branch to public repository"
    echo "  release [VERSION]   Create a tagged release (e.g., v1.0.0)"
    echo "  status              Show status of public-release branch"
    echo ""
    echo "Options:"
    echo "  -f, --force         Force operations (use with caution)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 init             # Initialize the public-release branch"
    echo "  $0 update           # Update with latest changes from main"
    echo "  $0 release v1.0.0   # Create and push a tagged release"
}

# Function to initialize public-release branch
init_public_branch() {
    print_info "Initializing public-release branch..."
    
    # Ensure we're on main and up to date
    git checkout main
    git pull origin main
    
    # Check if public-release branch exists
    if git show-ref --verify --quiet refs/heads/public-release; then
        if [[ "$FORCE" == "true" ]]; then
            print_warning "Deleting existing public-release branch"
            git branch -D public-release
        else
            print_error "public-release branch already exists. Use --force to recreate"
            exit 1
        fi
    fi
    
    # Create and switch to public-release branch
    git checkout -b public-release
    
    # Clear the branch for fresh start
    git rm -rf . > /dev/null 2>&1 || true
    git commit -m "Clear branch for public release" --allow-empty
    
    # Copy core application files
    print_info "Copying core application files..."
    git checkout main -- app/
    git checkout main -- server/
    git checkout main -- package.json
    git checkout main -- package-lock.json
    git checkout main -- start_*
    git checkout main -- tsconfig.json
    git checkout main -- babel.config.js
    git checkout main -- jest.config.js
    git checkout main -- jsdoc.json
    
    # Copy configuration (will be sanitized later)
    git checkout main -- config/config.json
    
    # Copy example board template
    mkdir -p boards
    git checkout main -- boards/_kanban_example.json
    
    # Create empty directories with .gitkeep files
    mkdir -p webhooks
    touch webhooks/.gitkeep
    
    # Copy documentation
    git checkout main -- README.md
    git checkout main -- README_MCP.md
    git checkout main -- README_CLI.md
    
    # Copy license and contribution files if they exist
    git checkout main -- LICENSE.md || true
    git checkout main -- CONTRIBUTING.md || true
    git checkout main -- CODE_OF_CONDUCT.md || true
    
    # Copy docs directory (excluding internal docs)
    mkdir -p docs
    git checkout main -- docs/
    
    # Copy tutorials
    git checkout main -- tutorials/ || true
    
    # Create public-specific .gitignore
    create_public_gitignore
    
    # Update package.json for public release
    update_package_json
    
    # Add all files and commit
    git add .
    git commit -m "Add core application files for public release"
    
    print_success "Public-release branch initialized successfully"
}

# Function to create public-specific .gitignore
create_public_gitignore() {
    print_info "Creating public .gitignore..."
    
    cat > .gitignore << 'EOF'
# Node modules
node_modules/

# Personal boards (keep only example)
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

# Coverage reports
coverage/

# Test artifacts
.nyc_output

# Private configuration
config/private-*
config/*.private.*

# Internal documentation
docs/internal/
_oss_plan/
_archive/
_planning/

# Release files (keep in private repo only)
releases/
EOF
}

# Function to update package.json for public release
update_package_json() {
    print_info "Updating package.json for public release..."
    
    if which jq >/dev/null 2>&1; then
        # Use jq to update package.json
        TMP_FILE=$(mktemp)
        jq '
        .name = "taskboardai" |
        .repository.url = "https://github.com/TuckerTucker/TaskBoardAI.git" |
        .bugs.url = "https://github.com/TuckerTucker/TaskBoardAI/issues" |
        .homepage = "https://github.com/TuckerTucker/TaskBoardAI#readme" |
        .keywords = ["kanban", "task-management", "board", "productivity", "mcp", "claude"] |
        .publishConfig = {"access": "public"}
        ' package.json > "$TMP_FILE" && mv "$TMP_FILE" package.json
        print_success "Updated package.json with public repository information"
    else
        print_warning "jq not found. Please manually update package.json with public repository information"
    fi
}

# Function to update public-release branch
update_public_branch() {
    print_info "Updating public-release branch with latest changes..."
    
    # Ensure we're on main and up to date
    git checkout main
    git pull origin main
    
    # Switch to public-release branch
    git checkout public-release
    
    # Update core application files
    print_info "Updating core files from main branch..."
    git checkout main -- app/
    git checkout main -- server/
    git checkout main -- package.json
    git checkout main -- package-lock.json
    git checkout main -- README.md
    git checkout main -- README_MCP.md
    git checkout main -- README_CLI.md
    
    # Update documentation
    git checkout main -- docs/ || true
    git checkout main -- tutorials/ || true
    
    # Re-apply public-specific changes
    update_package_json
    
    # Check if there are changes to commit
    if git diff --staged --quiet && git diff --quiet; then
        print_info "No changes to commit"
        return
    fi
    
    # Show changes
    print_info "Changes to be committed:"
    git diff --name-only
    
    # Commit changes
    git add .
    git commit -m "Update public release with latest changes from main ($(date +%Y-%m-%d))"
    
    print_success "Public-release branch updated successfully"
}

# Function to push to public repository
push_to_public() {
    if ! check_public_remote; then
        print_warning "Skipping push to public repository"
        return
    fi
    
    print_info "Pushing public-release branch to public repository..."
    
    # Ensure we're on public-release branch
    git checkout public-release
    
    # Push to public repository (public-release branch to main)
    git push public public-release:main
    
    print_success "Successfully pushed to public repository"
}

# Function to create a release
create_release() {
    local version="$1"
    
    if [ -z "$version" ]; then
        print_error "Version is required for release"
        echo "Usage: $0 release <version>"
        echo "Example: $0 release v1.0.0"
        exit 1
    fi
    
    # Normalize version (add v prefix if not present)
    if [[ ! "$version" =~ ^v ]]; then
        version="v$version"
    fi
    
    print_info "Creating release $version..."
    
    # Ensure we're on public-release branch
    git checkout public-release
    
    # Update the branch first
    update_public_branch
    
    # Create tag
    git tag -a "$version" -m "TaskBoardAI $version release"
    
    # Push tag to public repository if remote exists
    if check_public_remote; then
        git push public "$version"
        print_success "Release $version created and pushed to public repository"
    else
        print_success "Release $version created locally"
    fi
}

# Function to show status
show_status() {
    print_info "Public-release branch status:"
    
    # Check if public-release branch exists
    if ! git show-ref --verify --quiet refs/heads/public-release; then
        print_warning "public-release branch does not exist. Run '$0 init' to create it."
        return
    fi
    
    # Current branch
    current_branch=$(git branch --show-current)
    echo "Current branch: $current_branch"
    
    # Switch to public-release branch temporarily
    git checkout public-release > /dev/null 2>&1
    
    # Show last commit
    echo "Last commit on public-release:"
    git log -1 --oneline
    
    # Show status
    echo ""
    echo "Working directory status:"
    git status --porcelain
    
    # Check if there are unpushed commits
    if check_public_remote; then
        unpushed=$(git log public/main..public-release --oneline 2>/dev/null | wc -l)
        if [ "$unpushed" -gt 0 ]; then
            print_warning "$unpushed unpushed commit(s) to public repository"
        else
            print_success "All commits pushed to public repository"
        fi
    fi
    
    # Return to original branch
    git checkout "$current_branch" > /dev/null 2>&1
}

# Main script logic
main() {
    check_git_repo
    
    # Parse command line arguments
    COMMAND=""
    FORCE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            init|update|push|status)
                COMMAND="$1"
                shift
                ;;
            release)
                COMMAND="$1"
                VERSION="$2"
                shift 2
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Execute command
    case "$COMMAND" in
        init)
            init_public_branch
            ;;
        update)
            update_public_branch
            ;;
        push)
            push_to_public
            ;;
        release)
            create_release "$VERSION"
            ;;
        status)
            show_status
            ;;
        "")
            print_error "No command specified"
            show_usage
            exit 1
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"