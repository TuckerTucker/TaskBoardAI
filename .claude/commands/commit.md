# Git Commit Message

Generate a well-structured commit message based on staged changes.

## Description
This command analyzes staged git changes and creates a clear, concise commit message following conventional commit standards. It reviews the changes, categorizes them, and suggests an appropriate commit message without actually committing.

## Usage
`commit`

## Variables
- COMMIT_STYLE: Commit message format (default: conventional)
- INCLUDE_BODY: Add detailed body to message (default: true for complex changes)

## Steps
1. Stage all changes with `git add .`
2. Run `git status` to see staged files
3. Review changes with `git diff --cached` if needed
4. Analyze the nature of changes:
   - Feature additions (feat:)
   - Bug fixes (fix:)
   - Documentation (docs:)
   - Style changes (style:)
   - Refactoring (refactor:)
   - Tests (test:)
   - Chores (chore:)
5. Write a commit message with:
   - Type and scope in subject line
   - Clear, imperative mood description
   - Body with "why" and "what" if needed
   - Footer with references if applicable

## Examples
### Example 1: Simple feature commit
```
feat(auth): add password reset functionality

- Implement forgot password flow
- Add email notification service
- Create password reset tokens with 24h expiry
```

### Example 2: Bug fix commit
```
fix(api): resolve null pointer in user validation

Validation was failing when optional fields were undefined.
Added null checks before accessing nested properties.

Fixes #123
```

## Notes
- Do not actually run `git commit` - only prepare the message
- Follow project's commit conventions if they differ
- Keep subject line under 50 characters
- Use present tense ("add" not "added")
- Reference issues/PRs when relevant