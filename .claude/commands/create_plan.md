# Create Implementation Plan

Design an optimally ordered task list for implementing features or fixes.

## Description
This command creates a strategic implementation plan that focuses on the most efficient order of operations. It avoids artificial phases or time estimates, instead emphasizing logical dependencies and optimal workflow to minimize rework and maximize progress.

## Usage
`create_plan [feature_or_goal]`

## Variables
- GOAL: The feature or objective to plan for (default: current task)
- CONSTRAINTS: Technical or business limitations (default: none)
- PRIORITY: What to optimize for - speed, quality, or learning (default: quality)

## Steps
1. Define the end goal clearly and measurably
2. Identify all required components and tasks
3. Map dependencies between tasks
4. Order tasks by:
   - Hard dependencies (what must come first)
   - Risk reduction (tackle unknowns early)
   - Value delivery (working features ASAP)
   - Efficiency (minimize context switching)
5. Create a linear task list with:
   - Clear, actionable items
   - Logical progression
   - No artificial groupings or phases
   - Focus on "what" not "when"

## Examples
### Example 1: API endpoint implementation
```
1. Define data model and schema
2. Set up database migrations
3. Create repository layer with CRUD operations
4. Implement business logic service
5. Build API route handler
6. Add input validation
7. Write integration tests
8. Add API documentation
9. Implement error handling
10. Add logging and monitoring
```

### Example 2: Frontend feature plan
Ordered list focusing on getting a working prototype quickly, then iterating on quality and polish.

## Notes
- No phases like "Phase 1: Planning" - just ordered tasks
- No time estimates that create false precision
- Focus on dependencies and optimal ordering
- Each task should be independently valuable when possible
- Plans should be adaptable as understanding improves