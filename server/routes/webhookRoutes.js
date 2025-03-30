const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Webhook routes
router.get('/webhooks', webhookController.getWebhooks);
router.post('/webhooks', webhookController.createWebhook);
router.get('/webhooks/:id', webhookController.getWebhookById);
router.delete('/webhooks/:id', webhookController.deleteWebhook);
router.post('/webhooks/:id/test', webhookController.testWebhook);
router.post('/webhooks/test-connection', webhookController.testConnection);

module.exports = router;
