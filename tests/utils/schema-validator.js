/**
 * Schema validation utilities for testing board data structures
 */

/**
 * Validates a board object against the expected schema
 * @param {Object} board - Board object to validate
 * @returns {Object} Validation result with success flag and errors array
 */
function validateBoardSchema(board) {
  const errors = [];

  // Check required top-level properties
  const requiredProps = ['id', 'projectName', 'columns', 'cards', 'last_updated'];
  for (const prop of requiredProps) {
    if (board[prop] === undefined) {
      errors.push(`Missing required property: ${prop}`);
    }
  }
  
  // Validate ID is a string
  if (typeof board.id !== 'string') {
    errors.push('Board ID must be a string');
  }
  
  // Validate projectName is a string
  if (typeof board.projectName !== 'string') {
    errors.push('projectName must be a string');
  }
  
  // Validate columns array
  if (Array.isArray(board.columns)) {
    board.columns.forEach((column, index) => {
      const columnErrors = validateColumnSchema(column);
      errors.push(...columnErrors.map(err => `Column at index ${index}: ${err}`));
    });
  } else {
    errors.push('columns must be an array');
  }
  
  // Validate cards array
  if (Array.isArray(board.cards)) {
    board.cards.forEach((card, index) => {
      const cardErrors = validateCardSchema(card);
      errors.push(...cardErrors.map(err => `Card at index ${index}: ${err}`));
    });
  } else {
    errors.push('cards must be an array');
  }
  
  // Validate timestamp format
  if (board.last_updated) {
    if (isNaN(Date.parse(board.last_updated))) {
      errors.push('last_updated must be a valid ISO date string');
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Validates a column object against the expected schema
 * @param {Object} column - Column object to validate
 * @returns {Array} Array of validation error messages
 */
function validateColumnSchema(column) {
  const errors = [];
  
  // Check required properties
  if (!column.id) {
    errors.push('Missing required property: id');
  }
  
  if (!column.name) {
    errors.push('Missing required property: name');
  }
  
  // Validate types
  if (typeof column.id !== 'string') {
    errors.push('id must be a string');
  }
  
  if (typeof column.name !== 'string') {
    errors.push('name must be a string');
  }
  
  if (column.position !== undefined && typeof column.position !== 'number') {
    errors.push('position must be a number');
  }
  
  return errors;
}

/**
 * Validates a card object against the expected schema
 * @param {Object} card - Card object to validate
 * @returns {Array} Array of validation error messages
 */
function validateCardSchema(card) {
  const errors = [];
  
  // Check required properties
  const requiredProps = ['id', 'title', 'columnId', 'position'];
  for (const prop of requiredProps) {
    if (card[prop] === undefined) {
      errors.push(`Missing required property: ${prop}`);
    }
  }
  
  // Validate types
  if (typeof card.id !== 'string') {
    errors.push('id must be a string');
  }
  
  if (typeof card.title !== 'string') {
    errors.push('title must be a string');
  }
  
  if (typeof card.columnId !== 'string') {
    errors.push('columnId must be a string');
  }
  
  if (typeof card.position !== 'number') {
    errors.push('position must be a number');
  }
  
  // Validate optional array properties
  ['subtasks', 'tags', 'dependencies'].forEach(arrayProp => {
    if (card[arrayProp] !== undefined && !Array.isArray(card[arrayProp])) {
      errors.push(`${arrayProp} must be an array`);
    }
  });
  
  // Validate timestamps
  ['created_at', 'updated_at', 'completed_at', 'blocked_at'].forEach(timestamp => {
    if (card[timestamp] && isNaN(Date.parse(card[timestamp]))) {
      errors.push(`${timestamp} must be a valid ISO date string`);
    }
  });
  
  // Validate content is a string if present
  if (card.content !== undefined && typeof card.content !== 'string') {
    errors.push('content must be a string');
  }
  
  // Validate collapsed is a boolean if present
  if (card.collapsed !== undefined && typeof card.collapsed !== 'boolean') {
    errors.push('collapsed must be a boolean');
  }
  
  return errors;
}

/**
 * Validates a create-board response object against the expected schema
 * @param {Object} response - Create board response to validate
 * @returns {Object} Validation result with success flag and errors array
 */
function validateCreateBoardResponse(response) {
  const errors = [];
  
  // Check required top-level properties
  const requiredProps = ['success', 'operation', 'board', 'examples'];
  for (const prop of requiredProps) {
    if (response[prop] === undefined) {
      errors.push(`Missing required property: ${prop}`);
    }
  }
  
  // Validate operation type
  if (response.operation !== 'create-board') {
    errors.push(`Expected operation to be 'create-board', got '${response.operation}'`);
  }
  
  // Validate success flag
  if (typeof response.success !== 'boolean') {
    errors.push('success must be a boolean');
  }
  
  // Validate board object
  if (response.board) {
    // Check required board properties
    const requiredBoardProps = ['id', 'name', 'lastUpdated', 'structure'];
    for (const prop of requiredBoardProps) {
      if (response.board[prop] === undefined) {
        errors.push(`Missing required board property: ${prop}`);
      }
    }
    
    // Validate structure object
    if (response.board.structure) {
      const requiredStructureProps = ['columnsCount', 'cardsCount', 'columns'];
      for (const prop of requiredStructureProps) {
        if (response.board.structure[prop] === undefined) {
          errors.push(`Missing required structure property: ${prop}`);
        }
      }
      
      // Validate column structure
      if (Array.isArray(response.board.structure.columns)) {
        response.board.structure.columns.forEach((column, index) => {
          if (!column.id || !column.name) {
            errors.push(`Column at index ${index} in structure is missing id or name`);
          }
        });
      } else {
        errors.push('structure.columns must be an array');
      }
    }
  }
  
  // Validate examples
  if (response.examples) {
    const requiredExamples = ['getBoard', 'getCards', 'getBoardSummary'];
    for (const example of requiredExamples) {
      if (typeof response.examples[example] !== 'string') {
        errors.push(`Missing or invalid example: ${example}`);
      }
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Validates an error response object against the expected schema
 * @param {Object} response - Error response to validate
 * @returns {Object} Validation result with success flag and errors array
 */
function validateErrorResponse(response) {
  const errors = [];
  
  // Check required top-level properties
  const requiredProps = ['success', 'operation', 'error'];
  for (const prop of requiredProps) {
    if (response[prop] === undefined) {
      errors.push(`Missing required property: ${prop}`);
    }
  }
  
  // Validate success flag is false
  if (response.success !== false) {
    errors.push('success must be false in error responses');
  }
  
  // Validate error object
  if (response.error) {
    if (!response.error.message) {
      errors.push('error.message is required');
    }
    
    if (!response.error.code) {
      errors.push('error.code is required');
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

module.exports = {
  validateBoardSchema,
  validateColumnSchema,
  validateCardSchema,
  validateCreateBoardResponse,
  validateErrorResponse
};