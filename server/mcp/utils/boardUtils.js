/**
 * Common utility functions for board operations
 * 
 * This module contains shared functionality used across MCP tools to eliminate
 * code duplication and ensure consistent behavior.
 */

const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Creates a backup of a board before making changes
 * @async
 * @param {string} boardId - ID of the board to backup
 * @param {Object} boardData - Board data to backup
 * @param {string} backupType - Type of operation for the backup name (e.g., 'pre_update', 'pre_migration')
 * @param {Object} config - Application configuration containing boardsDir
 * @returns {Promise<string>} Path to the created backup file
 */
async function createBoardBackup(boardId, boardData, backupType, config) {
  try {
    // Ensure the backups directory exists
    const backupDir = path.join(config.boardsDir, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    // Create unique backup filename with timestamp and operation type
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${boardId}_${timestamp}_${backupType}.json`);
    
    // Write the backup file
    await fs.writeFile(backupPath, JSON.stringify(boardData, null, 2));
    
    // Clean up old backups (keep only the most recent 10 per board)
    await rotateBackups(boardId, backupDir);
    
    return backupPath;
  } catch (error) {
    console.error(`Error creating backup for board ${boardId}:`, error);
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Rotates backups to prevent disk space issues, keeping only recent backups
 * @async
 * @param {string} boardId - ID of the board to rotate backups for
 * @param {string} backupDir - Directory containing backups
 * @param {number} [maxBackups=10] - Maximum number of backups to keep per board
 */
async function rotateBackups(boardId, backupDir, maxBackups = 10) {
  try {
    // Get all files in the backup directory
    const files = await fs.readdir(backupDir);
    
    // Filter for backups related to this board
    const boardBackups = files.filter(file => 
      file.startsWith(`${boardId}_`) && file.endsWith('.json')
    );
    
    // Sort by timestamp (descending) to keep most recent
    boardBackups.sort().reverse();
    
    // Delete older backups beyond the limit
    if (boardBackups.length > maxBackups) {
      for (let i = maxBackups; i < boardBackups.length; i++) {
        try {
          await fs.unlink(path.join(backupDir, boardBackups[i]));
        } catch (err) {
          console.error(`Error deleting old backup ${boardBackups[i]}:`, err);
        }
      }
    }
  } catch (error) {
    console.error(`Error rotating backups for board ${boardId}:`, error);
    // Don't throw, this is a best-effort operation
  }
}

/**
 * Parse card data from string or object format consistently
 * @param {string|Object} cardData - Card data as a JSON string or object
 * @param {string} [context=''] - Context for error messages
 * @returns {Object} Parsed card data as an object
 * @throws {Error} If the card data is invalid
 */
function parseCardData(cardData, context = '') {
  if (typeof cardData === 'string') {
    try {
      return JSON.parse(cardData);
    } catch (error) {
      throw new Error(`Invalid JSON format for card data${context ? ` in ${context}` : ''}`);
    }
  } else if (typeof cardData === 'object' && cardData !== null) {
    return cardData;
  }
  
  throw new Error(`Invalid card data type${context ? ` in ${context}` : ''}. Must be a JSON string or an object.`);
}

/**
 * Validates that a column exists in a board
 * @param {Object} board - Board data containing columns
 * @param {string} columnId - ID of the column to validate
 * @param {string} [context=''] - Context for error messages
 * @throws {Error} If the column does not exist
 */
function validateColumn(board, columnId, context = '') {
  const colExists = board.data.columns.some(c => c.id === columnId);
  if (!colExists) {
    throw new Error(`Column ${columnId} does not exist${context ? ` in ${context}` : ''}`);
  }
}

/**
 * Calculate the new position for a card in a column
 * @param {Object} board - Board data
 * @param {string} columnId - Target column ID
 * @param {string|number} requestedPosition - Position specifier ('first', 'last', 'up', 'down', or number)
 * @param {Object} [currentCard=null] - Current card data (for relative positioning)
 * @param {Array} [newCards=[]] - Newly created cards not yet in the board.data.cards
 * @returns {number} Calculated position index
 */
function calculatePosition(board, columnId, requestedPosition, currentCard = null, newCards = []) {
  const cardsInColumn = [
    ...board.data.cards.filter(c => c.columnId === columnId && (!currentCard || c.id !== currentCard.id)),
    ...newCards.filter(nc => nc.columnId === columnId && (!currentCard || nc.id !== currentCard.id))
  ].sort((a, b) => a.position - b.position);
  
  if (typeof requestedPosition === 'number') {
    return Math.min(Math.max(0, requestedPosition), cardsInColumn.length);
  }
  
  switch (requestedPosition) {
    case 'first':
      return 0;
    case 'last':
      return cardsInColumn.length;
    case 'up':
      if (!currentCard || currentCard.columnId !== columnId) {
        throw new Error("Cannot use 'up' when moving to a different column");
      }
      return Math.max(0, currentCard.position - 1);
    case 'down':
      if (!currentCard || currentCard.columnId !== columnId) {
        throw new Error("Cannot use 'down' when moving to a different column");
      }
      return currentCard.position + 1;
    default:
      return cardsInColumn.length;
  }
}

/**
 * Generates a UUID for new entities
 * @returns {string} A new UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Sanitizes error messages to avoid leaking sensitive information
 * @param {Error} error - The original error
 * @param {string} [context=''] - Operation context for the error
 * @returns {Object} Sanitized error object
 */
function sanitizeError(error, context = '') {
  // Determine if this is a known error type we want to expose details for
  const isKnownError = error.message && (
    error.message.includes('not found') ||
    error.message.includes('Invalid') ||
    error.message.includes('Required') ||
    error.message.includes('already exists') ||
    error.message.includes('Rate limit')
  );
  
  const baseError = {
    error: true,
    code: error.code || 'UNKNOWN_ERROR'
  };
  
  if (isKnownError) {
    // For known errors, we can expose the message
    return {
      ...baseError,
      message: error.message,
      context: context || undefined
    };
  } else {
    // For unknown errors, use a generic message and log the details
    console.error(`Error in ${context}:`, error);
    return {
      ...baseError,
      message: 'An unexpected error occurred',
      context: context || undefined
    };
  }
}

module.exports = {
  createBoardBackup,
  rotateBackups,
  parseCardData,
  validateColumn,
  calculatePosition,
  generateUUID,
  sanitizeError
};