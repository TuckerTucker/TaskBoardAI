const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');

// Board info routes
router.get('/boardinfo', boardController.getBoardInfo);

// Legacy board routes
router.get('/kanban', boardController.getBoard);
router.post('/kanban', boardController.updateBoard);

// Board management routes
router.get('/boards', boardController.getBoards);
router.post('/boards', boardController.createBoard);
router.post('/boards/import', boardController.importBoard);
router.get('/boards/:id', boardController.getBoardById);
router.delete('/boards/:id', boardController.deleteBoard);

module.exports = router;
