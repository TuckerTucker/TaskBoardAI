# Contributing to TaskBoardAI

Thank you for your interest in contributing to TaskBoardAI! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

- **Check Existing Issues** to see if the problem has already been reported
- **Use the Bug Report Template** when creating an issue
- **Include Detailed Information** about your environment and steps to reproduce
- **Attach Screenshots** if applicable

### Suggesting Enhancements

- **Check Existing Issues** for similar suggestions
- **Describe the Enhancement** in detail, including the use case
- **Explain Why** this enhancement would be useful to most TaskBoardAI users

### Pull Requests

1. **Fork the Repository** and create your branch from `main`
2. **Install Dependencies** with `npm install`
3. **Make Your Changes** following the coding standards
4. **Test Your Changes** thoroughly
5. **Commit Your Changes** with clear commit messages
6. **Submit a Pull Request** referencing any related issues

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR-USERNAME/TaskBoardAI.git
cd TaskBoardAI
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Project Structure

- `/app` - Frontend components
  - `/css` - Stylesheets
  - `/js` - JavaScript components
- `/server` - Backend API and services
  - `/controllers` - Request handlers
  - `/models` - Data models
  - `/routes` - API endpoints
  - `/mcp` - Model Context Protocol server

## Coding Standards

- Use ES6+ features when possible
- Follow the existing code style for consistency
- Keep components small and focused on a single responsibility
- Include comments for complex logic
- Write clear commit messages

## Testing

Before submitting a PR, test your changes:

1. Ensure the application runs without errors
2. Test any UI changes across different browsers
3. Verify API endpoints return expected responses

## Documentation

Update documentation to reflect your changes:

- Update README.md for feature changes
- Add JSDoc comments to functions and classes
- Update API documentation for new or modified endpoints

## Submitting Changes

1. Push your changes to your fork of the repository
2. Submit a pull request to the main repository
3. The maintainers will review your PR and provide feedback
4. Address any requested changes
5. Once approved, your PR will be merged

## Questions?

If you have any questions about contributing, feel free to open an issue with the "question" label or reach out to the maintainers directly.

Thank you for contributing to TaskBoardAI!