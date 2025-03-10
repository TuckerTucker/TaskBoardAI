const Webhook = require('../models/Webhook');

// Get all webhooks
exports.getWebhooks = async (req, res) => {
    try {
        const webhooks = await Webhook.getAll();
        res.json(webhooks);
    } catch (error) {
        console.error('Error listing webhooks:', error);
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
};

// Get webhook by ID
exports.getWebhookById = async (req, res) => {
    try {
        const webhookId = req.params.id;
        const webhook = await Webhook.getById(webhookId);
        res.json(webhook.data);
    } catch (error) {
        console.error(`Error reading webhook ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Webhook not found' });
    }
};

// Create a new webhook
exports.createWebhook = async (req, res) => {
    try {
        const { name, url, event } = req.body;
        
        if (!name || !url || !event) {
            return res.status(400).json({ error: 'Webhook name, URL, and event are required' });
        }
        
        const webhook = await Webhook.create({
            name: name.trim(),
            url: url.trim(),
            event: event.trim()
        });
        
        res.status(201).json(webhook);
    } catch (error) {
        console.error('Error creating webhook:', error);
        res.status(500).json({ error: 'Failed to create webhook' });
    }
};

// Delete a webhook
exports.deleteWebhook = async (req, res) => {
    try {
        const webhookId = req.params.id;
        const result = await Webhook.delete(webhookId);
        res.json(result);
    } catch (error) {
        console.error(`Error deleting webhook ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Failed to delete webhook' });
    }
};

// Test a webhook
exports.testWebhook = async (req, res) => {
    try {
        const webhookId = req.params.id;
        const result = await Webhook.test(webhookId);
        res.json(result);
    } catch (error) {
        console.error(`Error testing webhook ${req.params.id}:`, error);
        res.status(404).json({ error: error.message || 'Failed to test webhook' });
    }
};

// Test a webhook connection without saving
exports.testConnection = async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        const result = await Webhook.testConnection(url.trim());
        res.json(result);
    } catch (error) {
        console.error('Error testing webhook connection:', error);
        res.status(500).json({ error: 'Failed to test webhook connection' });
    }
};
