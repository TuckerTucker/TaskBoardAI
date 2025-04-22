/**
 * MCP tools related to board architecture migration
 */

const Board = require('../../models/Board');
const { z } = require('zod');
const fs = require('node:fs').promises;
const path = require('node:path');

function registerMigrationTools(server, { config, checkRateLimit }) {
  server.tool(
    'migrate-to-card-first',
    {
      boardId: z.string().min(1, 'Board ID is required')
    },
    async ({ boardId }) => {
      try {
        checkRateLimit();

        const board = await Board.load(boardId);

        // Check if already using card-first architecture
        if (board.data.cards && Array.isArray(board.data.cards)) {
          return {
            content: [{ type: 'text', text: 'Board is already using card-first architecture.' }]
          };
        }

        // Create backup
        const backupDir = path.join(config.boardsDir, 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${boardId}_${timestamp}_pre_migration.json`);
        await fs.writeFile(backupPath, JSON.stringify(board.data, null, 2));

        // Initialize cards array
        const cards = [];
        let cardPosition = 0;

        // Convert items from each column to cards
        board.data.columns.forEach(column => {
          if (column.items && Array.isArray(column.items)) {
            column.items.forEach(item => {
              const card = {
                ...item,
                columnId: column.id,
                position: cardPosition++
              };
              cards.push(card);
            });
            // Remove items array from column
            delete column.items;
          }
        });

        // Update board data
        board.data.cards = cards;
        board.data.last_updated = new Date().toISOString();

        // Save migrated board
        await board.save();

        return {
          content: [{ type: 'text', text: `Board ${boardId} successfully migrated to card-first architecture.` }]
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error migrating board: ${error.message}` }],
          isError: true
        };
      }
    },
    'Migrate a board from legacy column-items architecture to card-first architecture.'
  );
}

module.exports = { registerMigrationTools };
