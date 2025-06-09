# Categorize Errors

Analyze log files and categorize issues by type, severity, and frequency.

## Description
This command reviews application logs, error reports, or debug output to identify patterns and categorize issues systematically. It helps prioritize which problems to address first based on their impact and frequency.

## Usage
`categorize_errors [log_file_or_directory]`

## Variables
- LOG_PATH: Path to log files or directory (default: current directory)
- OUTPUT_FORMAT: Format for categorization report (default: markdown)

## Steps
1. Identify and read all relevant log files
2. Extract error messages, warnings, and issues
3. Group similar errors together
4. Categorize by:
   - **Type**: Syntax, Runtime, Logic, Configuration, etc.
   - **Severity**: Critical, High, Medium, Low
   - **Frequency**: Number of occurrences
5. Generate a summary report with actionable insights

## Examples
### Example 1: Basic error categorization
Review logs in current directory and categorize all issues found.

### Example 2: Specific log analysis
Analyze a specific log file or directory of logs to identify recurring patterns.

## Notes
- Focus on patterns rather than individual occurrences
- Consider the context and impact of each error type
- Prioritize critical errors that affect core functionality
- Look for root causes when multiple related errors appear