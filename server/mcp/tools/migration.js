/**
 * MCP tools related to board architecture migration
 * Provides tools to convert between different board data structures.
 */

const Board = require('../../models/Board');
const { z } = require('zod');
const logger = require('../utils/logger');
const { createBoardBackup } = require('../utils/boardUtils');
const { handleError, NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Register migration tools with the MCP server
 * @param {Object} server - MCP server instance 
 * @param {Object} options - Tool options
 * @param {Object} options.config - Application configuration
 * @param {Function} options.checkRateLimit - Rate limiting function
 */
function registerMigrationTools(server, { config, checkRateLimit }) {
  server.tool(
    'migrate-to-card-first',
    {
      boardId: z.string()
        .min(1, 'Board ID is required')
        .uuid('Board ID must be a valid UUID')
        .describe('Unique identifier of the board to migrate from legacy column-items architecture')
    },
    async ({ boardId }) => {
      try {
        // Apply rate limiting
        checkRateLimit({
          clientId: boardId,
          operationType: 'write'
        });
        
        // Set request context for logging
        logger.setRequestContext({
          tool: 'migrate-to-card-first',
          boardId
        });
        
        logger.info('Starting board migration', { boardId });
        
        // Load the board
        let board;
        try {
          board = await Board.load(boardId);
        } catch (error) {
          logger.error('Error loading board', { boardId, error: error.message });
          throw new NotFoundError(`Board with ID ${boardId} not found`);
        }
        
        // Check if already using card-first architecture
        if (board.data.cards && Array.isArray(board.data.cards)) {
          logger.info('Board already using card-first architecture', { boardId });
          return {
            content: [{ type: 'text', text: 'Board is already using card-first architecture.' }]
          };
        }
        
        // Validate the board has columns
        if (!board.data.columns || !Array.isArray(board.data.columns)) {
          throw new ValidationError('Invalid board structure: missing columns array');
        }
        
        // Create backup before migration
        const backupPath = await createBoardBackup(
          boardId, 
          board.data, 
          'pre_migration', 
          config
        );
        
        logger.info('Created backup before migration', { backupPath });
        
        // Initialize cards array
        const cards = [];
        let cardPosition = 0;
        let totalItemsMigrated = 0;
        
        // Convert items from each column to cards
        board.data.columns.forEach(column => {
          if (column.items && Array.isArray(column.items)) {
            const columnCards = column.items.map(item => {
              totalItemsMigrated++;
              return {
                ...item,
                columnId: column.id,
                position: cardPosition++,
                updated_at: new Date().toISOString()
              };
            });
            
            cards.push(...columnCards);
            
            // Remove items array from column
            delete column.items;
          }
        });
        
        if (totalItemsMigrated === 0) {
          logger.warn('No items found to migrate', { boardId });
        }
        
        // Update board data
        board.data.cards = cards;
        board.data.last_updated = new Date().toISOString();
        
        // Save migrated board
        await board.save();
        
        // Log the successful migration
        logger.audit('board-migration', {
          boardId,
          itemsCount: totalItemsMigrated,
          columns: board.data.columns.length,
          migrationResult: 'success'
        });
        
        logger.info('Board migration completed', { 
          boardId, 
          itemsMigrated: totalItemsMigrated 
        });
        
        return {
          content: [{ 
            type: 'text', 
            text: `Board ${boardId} successfully migrated to card-first architecture. Migrated ${totalItemsMigrated} items to cards.`
          }]
        };
      } catch (error) {
        return handleError(error, 'migrate-to-card-first');
      } finally {
        logger.clearRequestContext();
      }
    },
    `Migrate a board from legacy column-items architecture to modern card-first architecture.
     - Converts existing column items into individual cards
     - Preserves original item data during migration
     - Automatically creates a backup before migration
     - Maintains original column structure
     - Assigns sequential positions to migrated cards
     - Prevents migration of already card-first boards
     - Updates board's last updated timestamp
     - Provides detailed reporting of migration results`
  );
  
  // Add a new tool to verify board structure
  server.tool(
    'verify-board-structure',
    {
      boardId: z.string()
        .min(1, 'Board ID is required')
        .uuid('Board ID must be a valid UUID')
        .describe('Unique identifier of the board to verify')
    },
    async ({ boardId }) => {
      try {
        // Apply rate limiting (light read operation)
        checkRateLimit({
          clientId: boardId,
          operationType: 'read'
        });
        
        // Set request context for logging
        logger.setRequestContext({
          tool: 'verify-board-structure',
          boardId
        });
        
        logger.info('Verifying board structure', { boardId });
        
        // Load the board
        let board;
        try {
          board = await Board.load(boardId);
        } catch (error) {
          logger.error('Error loading board', { boardId, error: error.message });
          throw new NotFoundError(`Board with ID ${boardId} not found`);
        }
        
        // Analyze board structure
        const analysis = {
          architecture: board.data.cards && Array.isArray(board.data.cards) 
            ? 'card-first' 
            : 'column-items',
          totalColumns: board.data.columns?.length || 0,
          totalCards: board.data.cards?.length || 0,
          totalLegacyItems: 0,
          columnsWithNoItems: 0,
          columnsWithItems: 0,
          orphanedCards: 0,
          malformedEntities: 0
        };
        
        // Check columns
        if (board.data.columns && Array.isArray(board.data.columns)) {
          board.data.columns.forEach(column => {
            // Check for columns with legacy items
            if (column.items && Array.isArray(column.items)) {
              analysis.columnsWithItems++;
              analysis.totalLegacyItems += column.items.length;
            } else {
              analysis.columnsWithNoItems++;
            }
            
            // Check for malformed columns
            if (!column.id || typeof column.id !== 'string') {
              analysis.malformedEntities++;
            }
          });
        }
        
        // Check cards
        if (board.data.cards && Array.isArray(board.data.cards)) {
          // Count orphaned cards
          board.data.cards.forEach(card => {
            if (!card.columnId || !board.data.columns.some(col => col.id === card.columnId)) {
              analysis.orphanedCards++;
            }
            
            // Check for malformed cards
            if (!card.id || typeof card.id !== 'string') {
              analysis.malformedEntities++;
            }
          });
        }
        
        // Determine if migration is needed
        const needsMigration = analysis.architecture === 'column-items' && analysis.totalLegacyItems > 0;
        
        // Generate recommendations
        const recommendations = [];
        
        if (needsMigration) {
          recommendations.push('Board should be migrated to card-first architecture using migrate-to-card-first tool');
        }
        
        if (analysis.orphanedCards > 0) {
          recommendations.push(`${analysis.orphanedCards} orphaned cards should be assigned to valid columns`);
        }
        
        if (analysis.malformedEntities > 0) {
          recommendations.push(`${analysis.malformedEntities} malformed entities should be fixed`);
        }
        
        logger.info('Board structure verification completed', { boardId, analysis });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              boardId,
              analysis,
              recommendations,
              needsAction: recommendations.length > 0
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleError(error, 'verify-board-structure');
      } finally {
        logger.clearRequestContext();
      }
    },
    `Verifies the structure and integrity of a board.
     - Analyzes board architecture (card-first or column-items)
     - Identifies orphaned cards not associated with valid columns
     - Detects malformed entities with missing required fields
     - Provides recommendations for fixing issues
     - Helps diagnose problems before they cause application errors
     - Non-destructive read-only operation`
  );
}

module.exports = { registerMigrationTools };
