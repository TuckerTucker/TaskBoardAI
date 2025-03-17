# Testing Documentation for TaskBoardAI

This directory contains test files for the TaskBoardAI project. The testing is organized into unit tests and integration tests.

> **Current Status**: Initial test infrastructure setup with some working tests. Additional work needed to complete comprehensive test coverage.

## Testing Structure

```
tests/
├── unit/               # Unit tests for individual components
│   ├── models/         # Tests for data models
│   ├── controllers/    # Tests for API controllers 
│   ├── utils/          # Tests for utility functions
│   ├── components/     # Tests for frontend components
│   └── mcp/            # Tests for Model Context Protocol server
└── integration/        # Integration tests
    ├── routes/         # Tests for API routes
    └── mcp/            # Integration tests for MCP server
```

## Test Technologies

- Jest - Testing framework
- Supertest - HTTP assertions for API testing
- JSDOM - Browser environment simulation for frontend tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npx jest path/to/test/file.test.js
```

## Test Coverage

The project aims for a minimum code coverage of 60% across all files. Critical paths should have higher coverage.

Coverage thresholds are configured in `jest.config.js`:
- Statements: 60%
- Branches: 60% 
- Functions: 60%
- Lines: 60%

> **Note**: Coverage thresholds are temporarily disabled during the initial setup phase. They will be re-enabled once a sufficient baseline of tests is established.

### Coverage Reports

Coverage reports are generated when running `npm run test:coverage` and saved to the `/coverage` directory:

1. **HTML Report**: `/coverage/lcov-report/index.html` - Interactive report showing covered and uncovered code
2. **JSON Report**: `/coverage/coverage-final.json` - Machine-readable coverage data
3. **LCOV Data**: `/coverage/lcov.info` - Standard format for CI tools
4. **XML Report**: `/coverage/clover.xml` - Alternative format for CI systems

To view the HTML report, open the `coverage/lcov-report/index.html` file in your browser.

## Test Guidelines

1. **Unit Tests**
   - Each module should have corresponding unit tests
   - Mock external dependencies
   - Test both success and error paths
   - Test edge cases and input validation

2. **Integration Tests**
   - Focus on testing API endpoints
   - Test request validation
   - Test response structure and status codes
   - Mock external dependencies when needed

3. **Frontend Tests**
   - Test component rendering
   - Test event handling
   - Test state updates
   - Use JSDOM environment

## Adding New Tests

When adding new features or fixing bugs:

1. Write tests before implementing the feature (TDD approach when possible)
2. Ensure tests cover both success and failure scenarios
3. Run the full test suite before submitting changes
4. Check code coverage reports to identify gaps

## TODO List

The following items need to be addressed to complete the test infrastructure:

1. **Fix Mocking Issues**:
   - Resolve mocking for the Board model and file system utilities
   - Fix JSDOM setup for frontend component tests

2. **Add Missing Unit Tests**:
   - Complete tests for server-side controllers
   - Add tests for state management and API services
   - Add tests for remaining frontend components
   - ✅ Add tests for MCP server functionality

3. **Add Integration Tests**:
   - Complete route tests with proper mocking
   - Add end-to-end API flow tests
   - ✅ Add integration tests for MCP server

4. **Setup CI/CD**:
   - Configure test runs in CI pipeline
   - Add status checks for PRs based on test results

5. **Re-enable Coverage Thresholds**:
   - Once sufficient test coverage is achieved, re-enable thresholds in jest.config.js

## Mocking Strategy

- External services and APIs should be mocked
- File system operations should be mocked
- Database operations should be mocked
- For frontend, global browser APIs should be mocked when needed