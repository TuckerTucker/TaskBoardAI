/**
 * @fileoverview Board API routes
 * @module routes/boardRoutes
 * @requires express
 * @requires ../controllers/boardController
 */

const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');

/**
 * @name GET-/boardinfo
 * @description Get information about the current board configuration
 * @memberof module:routes/boardRoutes
 */
router.get('/boardinfo', boardController.getBoardInfo);

/**
 * @name GET-/kanban
 * @description Get the default board data (legacy route)
 * @memberof module:routes/boardRoutes
 */
router.get('/kanban', boardController.getBoard);

/**
 * @name POST-/kanban
 * @description Update the default board data (legacy route)
 * @memberof module:routes/boardRoutes
 */
router.post('/kanban', boardController.updateBoard);

/**
 * @name GET-/boards
 * @description Get a list of all available boards
 * @memberof module:routes/boardRoutes
 */
router.get('/boards', boardController.getBoards);

/**
 * @name POST-/boards
 * @description Create a new board
 * @memberof module:routes/boardRoutes
 */
router.post('/boards', boardController.createBoard);

/**
 * @name POST-/boards/import
 * @description Import a board from provided data
 * @memberof module:routes/boardRoutes
 */
router.post('/boards/import', boardController.importBoard);

/**
 * @name GET-/boards/:id
 * @description Get a specific board by ID
 * @memberof module:routes/boardRoutes
 */
router.get('/boards/:id', boardController.getBoardById);

/**
 * @name DELETE-/boards/:id
 * @description Delete a board by ID
 * @memberof module:routes/boardRoutes
 */
router.delete('/boards/:id', boardController.deleteBoard);

/**
 * @name POST-/boards/:id/archive
 * @description Archive a board
 * @memberof module:routes/boardRoutes
 */
router.post('/boards/:id/archive', boardController.archiveBoard);

/**
 * @name GET-/archives
 * @description Get list of archived boards
 * @memberof module:routes/boardRoutes
 */
router.get('/archives', boardController.getArchivedBoards);

/**
 * @name POST-/archives/:id/restore
 * @description Restore a board from archive
 * @memberof module:routes/boardRoutes
 */
router.post('/archives/:id/restore', boardController.restoreArchivedBoard);

/**
 * @name GET-/boards/query
 * @description Query boards with filtering, sorting, and pagination
 * @memberof module:routes/boardRoutes
 */
router.get('/boards/query', boardController.queryBoards);

/**
 * @name GET-/boards/:boardId/cards/query
 * @description Query cards within a board with filtering, sorting, and pagination
 * @memberof module:routes/boardRoutes
 */
router.get('/boards/:boardId/cards/query', boardController.queryCards);

module.exports = router;
