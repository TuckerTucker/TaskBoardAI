/**
 * Tests for board schema validation in MCP tools
 */

const { validateCreateBoardResponse, validateErrorResponse } = require('../../../utils/schema-validator');

// Mock the MCP tools response
const mockSuccessResponse = {
  success: true,
  operation: "create-board",
  board: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Test Board",
    lastUpdated: "2025-04-01T12:00:00.000Z",
    structure: {
      columnsCount: 4,
      cardsCount: 3,
      columns: [
        { id: "col-1", name: "To Do" },
        { id: "col-2", name: "In Progress" },
        { id: "col-3", name: "Done" },
        { id: "col-4", name: "Blocked" }
      ]
    }
  },
  examples: {
    getBoard: 'Use get-board with ID "f47ac10b-58cc-4372-a567-0e02b2c3d479" to retrieve the full board',
    getCards: 'Use get-board with ID "f47ac10b-58cc-4372-a567-0e02b2c3d479" and format "cards-only" to get just the cards',
    getBoardSummary: 'Use get-board with ID "f47ac10b-58cc-4372-a567-0e02b2c3d479" and format "summary" for statistics'
  }
};

const mockErrorResponse = {
  success: false,
  operation: "create-board",
  error: {
    message: "Failed to create board: Invalid board data",
    code: "VALIDATION_ERROR"
  }
};

describe('Board Schema Validation', () => {
  test('Success response validates against schema', () => {
    const validation = validateCreateBoardResponse(mockSuccessResponse);
    expect(validation.success).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Error response validates against schema', () => {
    const validation = validateErrorResponse(mockErrorResponse);
    expect(validation.success).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Detects missing required fields in success response', () => {
    const invalidResponse = {
      ...mockSuccessResponse,
      board: {
        ...mockSuccessResponse.board,
        // Remove required structure property
        structure: {
          columnsCount: 4,
          cardsCount: 3
          // Missing columns array
        }
      }
    };

    const validation = validateCreateBoardResponse(invalidResponse);
    expect(validation.success).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0]).toMatch(/Missing required structure property: columns/);
  });

  test('Detects missing required fields in error response', () => {
    const invalidResponse = {
      success: false,
      operation: "create-board",
      // Missing error object
    };

    const validation = validateErrorResponse(invalidResponse);
    expect(validation.success).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0]).toMatch(/Missing required property: error/);
  });
});