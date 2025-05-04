/**
 * Card template utility functions for creating properly structured cards
 */

const crypto = require('node:crypto');

/**
 * Creates a basic card object with the minimum required fields
 * @param {Object} options Card creation options
 * @param {string} options.title Title of the card
 * @param {string} options.columnId ID of the column to place the card in
 * @param {number} [options.position] Position in the column (will be calculated if not provided)
 * @param {string} [options.content] Markdown content for the card
 * @returns {Object} A properly structured card object
 */
function createBasicCard({ title, columnId, position = 0, content = "" }) {
  const now = new Date().toISOString();
  
  return {
    id: crypto.randomUUID(),
    title,
    columnId,
    position,
    content,
    collapsed: false,
    created_at: now,
    updated_at: now
  };
}

/**
 * Creates a task card with subtasks
 * @param {Object} options Card creation options
 * @param {string} options.title Title of the card
 * @param {string} options.columnId ID of the column to place the card in
 * @param {number} [options.position] Position in the column (will be calculated if not provided)
 * @param {string} [options.content] Markdown content for the card
 * @param {Array<string>} options.subtasks List of subtasks (prefix with "✓ " for completed)
 * @param {string} [options.priority] Priority level (high, medium, low)
 * @returns {Object} A properly structured task card with subtasks
 */
function createTaskCard({ title, columnId, position = 0, content = "", subtasks = [], priority }) {
  const baseCard = createBasicCard({ title, columnId, position, content });
  
  return {
    ...baseCard,
    subtasks,
    ...(priority ? { priority } : {})
  };
}

/**
 * Creates a feature card with tags and possibly dependencies
 * @param {Object} options Card creation options
 * @param {string} options.title Title of the card
 * @param {string} options.columnId ID of the column to place the card in
 * @param {number} [options.position] Position in the column (will be calculated if not provided)
 * @param {string} [options.content] Markdown content for the card
 * @param {Array<string>} [options.tags] List of tags to categorize the feature
 * @param {Array<string>} [options.dependencies] List of card IDs this feature depends on
 * @param {Array<string>} [options.subtasks] List of subtasks (prefix with "✓ " for completed)
 * @returns {Object} A properly structured feature card
 */
function createFeatureCard({ title, columnId, position = 0, content = "", tags = [], dependencies = [], subtasks = [] }) {
  const baseCard = createBasicCard({ title, columnId, position, content });
  
  return {
    ...baseCard,
    tags,
    dependencies,
    subtasks
  };
}

/**
 * Validates that a card has all required fields
 * @param {Object} card Card object to validate
 * @returns {Object} Validation result with success flag and any errors
 */
function validateCard(card) {
  const errors = [];
  const requiredFields = ['id', 'title', 'columnId', 'position', 'created_at', 'updated_at'];
  
  for (const field of requiredFields) {
    if (card[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Type validations
  if (typeof card.title !== 'string') {
    errors.push('title must be a string');
  }
  
  if (typeof card.columnId !== 'string') {
    errors.push('columnId must be a string');
  }
  
  if (typeof card.position !== 'number') {
    errors.push('position must be a number');
  }
  
  // Optional field type validations
  if (card.content !== undefined && typeof card.content !== 'string') {
    errors.push('content must be a string');
  }
  
  if (card.subtasks !== undefined && !Array.isArray(card.subtasks)) {
    errors.push('subtasks must be an array');
  }
  
  if (card.tags !== undefined && !Array.isArray(card.tags)) {
    errors.push('tags must be an array');
  }
  
  if (card.dependencies !== undefined && !Array.isArray(card.dependencies)) {
    errors.push('dependencies must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  createBasicCard,
  createTaskCard,
  createFeatureCard,
  validateCard
};