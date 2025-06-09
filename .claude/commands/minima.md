# Holistic Review (Minima)

Step back from local optimizations to consider system-wide improvements.

## Description
This command prompts a holistic review of the current approach, helping avoid getting stuck in local minima - situations where immediate fixes seem optimal but better global solutions exist. It encourages systems thinking for full-stack applications where components interact in complex ways.

## Usage
`minima [current_approach]`

## Variables
- CONTEXT: Current problem or solution being evaluated (default: current task)
- SCOPE: Level of analysis - component, feature, or system (default: system)

## Steps
1. Document the current approach and its limitations
2. Identify assumptions that constrain the solution space
3. Map out system-wide dependencies and interactions
4. Brainstorm alternative architectures or approaches
5. Evaluate trade-offs between local and global optimizations
6. Recommend whether to continue current path or pivot

## Examples
### Example 1: Performance optimization review
Instead of optimizing a slow database query, consider if caching, architecture changes, or data model redesign would be more effective.

### Example 2: Bug fix evaluation  
Before implementing a complex workaround, assess if refactoring the component or changing the approach would prevent similar issues.

## Notes
- Local optimizations can lead to technical debt
- Consider both immediate needs and long-term maintainability
- Full-stack applications require thinking across all layers
- Sometimes the best solution requires changing the problem
- Break/fix mentality can miss opportunities for systematic improvements