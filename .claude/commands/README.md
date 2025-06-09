# Claude Commands Documentation

This directory contains standardized command documents for AI agents to execute specific tasks efficiently and consistently.

## Command Structure

All commands follow a standardized template with these sections:
- **Title**: Command name and brief purpose
- **Description**: Detailed explanation of functionality
- **Usage**: How to invoke the command
- **Variables**: Configurable parameters with defaults
- **Steps**: Sequential actions to perform
- **Examples**: Practical use cases
- **Notes**: Important considerations and tips

## Available Commands

### Analysis & Review
- **categorize_errors.md** - Analyze and categorize issues from logs by type, severity, and frequency
- **five.md** - Apply Five Whys root cause analysis to investigate problems systematically
- **minima.md** - Step back from local optimizations to consider holistic improvements

### Development Workflow
- **commit.md** - Generate well-structured git commit messages based on staged changes
- **context_prime.md** - Build comprehensive project understanding before making changes
- **create_plan.md** - Design optimally ordered implementation plans without artificial phases

### Repository Review System
- **rr_init-review.md** - Initialize parallel git worktrees for multi-agent analysis
- **rr_execute-review.md** - Run six specialized agents concurrently for comprehensive analysis
- **rr_merge-findings.md** - Consolidate parallel analysis results into unified reports

## Usage Guidelines

1. Commands are designed for AI agents but can guide human developers
2. Each command is self-contained with all necessary context
3. Variables allow customization while maintaining sensible defaults
4. Examples demonstrate both simple and complex scenarios
5. Notes sections contain wisdom from practical experience

## Repository Review Workflow

For comprehensive repository analysis:
```bash
# 1. Initialize analysis infrastructure
rr_init-review

# 2. Execute parallel analysis
rr_execute-review

# 3. Merge and review findings
rr_merge-findings
```

## Contributing

When adding new commands:
1. Use the standardized template structure
2. Provide clear, actionable steps
3. Include practical examples
4. Document all variables and defaults
5. Add the command to this README

## Design Principles

- **Clarity**: Unambiguous instructions for consistent execution
- **Completeness**: All necessary information in one document
- **Flexibility**: Variables for customization without complexity
- **Practicality**: Real-world focused with actionable outcomes