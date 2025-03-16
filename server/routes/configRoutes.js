const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// Configuration routes
router.get('/config', configController.getConfig);
router.post('/config', configController.updateConfig);

module.exports = router;
