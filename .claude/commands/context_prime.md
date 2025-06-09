# Context Prime

Establish comprehensive understanding of the project before making changes.

## Description
This command initiates a thorough review of the project structure, documentation, and existing implementation to build context. It ensures informed decision-making by understanding the project's architecture, conventions, and current state before writing any code.

## Usage
`context_prime [focus_area]`

## Variables
- PROJECT_ROOT: Starting directory for review (default: current directory)
- FOCUS_AREA: Specific aspect to prioritize (default: general overview)
- DEPTH: How deep to analyze (default: comprehensive)

## Steps
1. Review project documentation:
   - Check `@project` or `_project` directory for specifications
   - Read README files and architectural docs
   - Identify project goals and constraints
2. Analyze codebase structure:
   - Map directory organization
   - Identify key components and their relationships
   - Note naming conventions and patterns
3. Understand implementation details:
   - Review core modules and entry points
   - Identify frameworks and dependencies
   - Note coding standards and practices
4. Document findings:
   - Project purpose and scope
   - Technology stack
   - Key architectural decisions
   - Current state and progress
5. Identify areas needing attention or clarification

## Examples
### Example 1: New project onboarding
Complete review of an unfamiliar codebase to understand its purpose, structure, and implementation approach.

### Example 2: Feature-specific context
Focused review of authentication system before implementing new security features.

## Notes
- No coding during context priming - only observation and understanding
- Pay attention to both explicit documentation and implicit patterns
- Look for TODOs, FIXMEs, and other developer notes
- Understanding comes before implementation
- Consider both technical and business context