# Test Suite Refactoring Notes

## Background

We've refactored the application to support a card-first architecture, where cards are stored in a top-level array rather than nested inside columns. While the application functionality is working correctly, several tests are currently disabled in the Jest configuration because they need to be updated to work with both the legacy and new data formats.

## Progress Report (March 15, 2025)

### Completed Tasks ✅

#### 1. Filesystem Mocking ✅

- Created dedicated mock setup for fs module in `tests/mocks/fs-mock.js`
- Implemented mockResolvedValueOnce and mockRejectedValueOnce
- Added proper tracking for mock.calls
- Implemented reset functionality in beforeEach

#### 2. Board.test.js Updates ✅

- Updated tests to support both legacy and card-first formats
- Fixed beforeEach setup for proper mock reset
- Using jest.spyOn instead of direct mocking where appropriate
- Added helpers for test data setup in both formats in `tests/utils/test-data-factory.js`

#### 3. Card.test.js Module Format ✅

- Fixed module format compatibility issues
- Implemented proper babel configuration to support ES modules
- Updated tests to use CommonJS-style requires

#### 4. MCP Server Tests ✅

- Created MCP handler mocks for proper test isolation
- Added board-mock.js implementation with proper tracking
- Fixed circular dependencies between test modules
- Implemented proper reset between tests
- Added files:
  - `tests/mocks/board-mock.js`
  - `tests/mocks/mcp-handlers-mock.js`

### Remaining Tasks 🔄

#### 5. Dependency Injection (Next Priority)

For better testability:
- Refactor Board class to accept fs/path as dependencies
- Will make mocking much easier and more reliable
- Update initialization points throughout codebase
- Update tests to leverage new DI pattern

#### 6. boardController.test.js Updates

- Update mocks to handle the updated Board class
- Support both data formats in tests
- Fix mock reset between tests

#### 7. Integration Tests Updates

- Fix route tests to work with both data formats
- Update mock data creation
- Ensure proper test isolation

#### 8. Test Isolation

- Ensure tests don't affect each other through shared state
- Use temporary directories for file operations
- Mock time-dependent functions for deterministic tests

#### 9. Jest Configuration

- Update jest.config.js to handle ES modules
- Configure setupFilesAfterEnv for global test setup
- Remove test exclusions once fixed

## Token Optimization Test Failures

Current failures in token optimization tests need to be addressed:

- Fix token-optimization-integration.test.js failures related to cards-only format
- Address token-optimization.test.js failures regarding token reduction percentages
- Fix remaining issues with token count comparisons

## Files Needing Updates

- ✅ `/tests/unit/models/Board.test.js`
- ✅ `/tests/unit/components/Card.test.js`
- ✅ `/tests/unit/mcp/kanbanMcpServer.test.js`
- 🔄 `/tests/unit/controllers/boardController.test.js`
- ✅ `/tests/unit/utils/fileSystem.test.js`
- 🔄 `/tests/integration/routes/boardRoutes.test.js`
- 🔄 `/tests/integration/mcp/token-optimization-integration.test.js`
- 🔄 `/tests/unit/models/token-optimization.test.js`

## Updated Priority Order

1. ✅ Fix mock infrastructure (fs mocking)
2. ✅ Update Board.test.js for dual-format testing 
3. ✅ Fix Card.test.js module compatibility
4. ✅ Update MCP Server Tests
5. 🔄 Fix token optimization test failures
6. 🔄 Implement dependency injection for Board class
7. 🔄 Update boardController.test.js
8. 🔄 Update integration tests
9. 🔄 Improve test isolation
10. 🔄 Update Jest configuration and re-enable tests