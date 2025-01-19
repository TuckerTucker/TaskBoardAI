const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');

// Board routes
router.get('/boardinfo', boardController.getBoardInfo);
router.get('/kanban', boardController.getBoard);
router.post('/kanban', boardController.updateBoard);

module.exports = router;
