# Test Suite Refactoring Notes

## Background

We've refactored the application to support a card-first architecture, where cards are stored in a top-level array rather than nested inside columns. While the application functionality is working correctly, several tests are currently disabled in the Jest configuration because they need to be updated to work with both the legacy and new data formats.

## Required Changes

### 1. Filesystem Mocking

The current mocking approach for the filesystem has issues:
- Missing mock implementations for Promise-based methods
- Incomplete mock for tracking function calls
- Lack of proper reset between tests

**Solution:**
- Create dedicated mock setup for fs module
- Implement mockResolvedValueOnce and mockRejectedValueOnce
- Ensure mock.calls is properly tracked

### 2. Board.test.js Updates

- Update to support testing both legacy and card-first formats
- Fix beforeEach setup for proper mock reset
- Use jest.spyOn instead of direct mocking where appropriate
- Add helpers for test data setup in both formats

### 3. Card.test.js Module Format

Card.test.js uses ES modules but Jest is configured for CommonJS:
- Add proper transform configuration for ES modules
- Or convert to CommonJS format

### 4. MCP Server Tests

- Add complete Board mock implementation including the import method
- Create data factories for consistent test data
- Add proper reset between tests

### 5. Dependency Injection

For better testability:
- Refactor Board class to accept fs/path as dependencies
- Will make mocking much easier and more reliable

### 6. Test Configuration

- Update jest.config.js to handle ES modules
- Configure setupFilesAfterEnv for global test setup
- Remove test exclusions once fixed

### 7. Test Isolation

- Ensure tests don't affect each other through shared state
- Use temporary directories for file operations
- Mock time-dependent functions for deterministic tests

## Files Needing Updates

- `/tests/unit/models/Board.test.js`
- `/tests/unit/components/Card.test.js`
- `/tests/unit/controllers/boardController.test.js`
- `/tests/unit/utils/fileSystem.test.js`
- `/tests/integration/routes/boardRoutes.test.js`

## Jest Configuration

These tests are currently excluded in jest.config.js and need to be re-enabled once fixed:

```javascript
testPathIgnorePatterns: [
  '/node_modules/',
  '/_archive/',
  'tests/unit/controllers/boardController.test.js',
  'tests/unit/utils/fileSystem.test.js',
  'tests/unit/models/Board.test.js',
  'tests/integration/routes/boardRoutes.test.js',
  'tests/unit/components/Card.test.js'
]
```

## Priority Order

1. Fix mock infrastructure first (fs mocking)
2. Update Board.test.js for dual-format testing
3. Fix Card.test.js module compatibility
4. Update integration tests
5. Re-enable tests in jest configuration