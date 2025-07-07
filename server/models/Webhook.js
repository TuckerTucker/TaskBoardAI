const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config/config');
const { ensureWebhooksDir } = require('../utils/fileSystem');
const axios = require('axios');

/**
 * @fileoverview Webhook model for managing external integrations.
 * @module models/Webhook
 * @requires node:fs
 * @requires node:path
 * @requires node:crypto
 * @requires axios
 * @requires ../config/config
 * @requires ../utils/fileSystem
 */

/**
 * @typedef {Object} WebhookData
 * @property {string} id - Unique identifier for the webhook
 * @property {string} name - Display name of the webhook
 * @property {string} url - URL endpoint to send webhook data to
 * @property {string} event - Event type that triggers this webhook
 * @property {string} created_at - ISO timestamp when webhook was created
 */

/**
 * @typedef {Object} WebhookResponse
 * @property {boolean} success - Whether the webhook request was successful
 * @property {number} [status] - HTTP status code if successful
 * @property {string} message - Response message
 * @property {string} [error] - Error message if unsuccessful
 */

/**
 * Class representing a webhook for external integrations
 * @class
 * @category Models
 */
class Webhook {
    /**
     * Create a Webhook instance
     * @param {WebhookData} [data=null] - Webhook data
     * @param {string} [filePath=null] - Path to the webhook's JSON file
     */
    constructor(data = null, filePath = null) {
        this.data = data || {
            id: crypto.randomUUID(),
            name: '',
            url: '',
            event: '',
            created_at: new Date().toISOString()
        };
        this.filePath = filePath;
    }

    /**
     * Get all webhooks
     * @static
     * @async
     * @returns {Promise<Array<WebhookData>>} Array of webhook data objects
     */
    static async getAll() {
        await ensureWebhooksDir();
        
        try {
            const files = await fs.readdir(config.webhooksDir);
            const webhookFiles = files.filter(file => file.endsWith('.json'));
            
            const webhooks = [];
            
            for (const file of webhookFiles) {
                try {
                    const filePath = path.join(config.webhooksDir, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const webhookData = JSON.parse(data);
                    
                    webhooks.push({
                        id: webhookData.id || path.basename(file, '.json'),
                        name: webhookData.name || 'Unnamed Webhook',
                        url: webhookData.url,
                        event: webhookData.event,
                        created_at: webhookData.created_at || null
                    });
                } catch (err) {
                    console.error(`Error reading webhook file ${file}:`, err);
                    // Skip this file and continue
                }
            }
            
            return webhooks;
        } catch (error) {
            console.error('Error listing webhooks:', error);
            return [];
        }
    }
    
    /**
     * Get a specific webhook by ID
     * @static
     * @async
     * @param {string} webhookId - ID of the webhook to retrieve
     * @returns {Promise<Webhook>} The webhook instance
     * @throws {Error} If webhook ID is not provided or webhook is not found
     */
    static async getById(webhookId) {
        if (!webhookId) {
            throw new Error('Webhook ID is required');
        }
        
        const filePath = path.join(config.webhooksDir, `${webhookId}.json`);
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return new Webhook(JSON.parse(data), filePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Webhook with ID ${webhookId} not found`);
            }
            throw error;
        }
    }
    
    /**
     * Create a new webhook
     * @static
     * @async
     * @param {Object} webhookData - Data for the new webhook
     * @param {string} webhookData.name - Name for the webhook
     * @param {string} webhookData.url - URL endpoint
     * @param {string} webhookData.event - Event type
     * @returns {Promise<WebhookData>} Data of the created webhook
     * @throws {Error} If required fields are missing
     */
    static async create(webhookData) {
        await ensureWebhooksDir();
        
        if (!webhookData.name || !webhookData.url || !webhookData.event) {
            throw new Error('Webhook name, URL, and event are required');
        }
        
        const webhookId = crypto.randomUUID();
        const webhook = new Webhook({
            id: webhookId,
            name: webhookData.name,
            url: webhookData.url,
            event: webhookData.event,
            created_at: new Date().toISOString()
        }, path.join(config.webhooksDir, `${webhookId}.json`));
        
        await webhook.save();
        
        return webhook.data;
    }
    
    /**
     * Save webhook to file
     * @async
     * @returns {Promise<void>}
     */
    async save() {
        // Ensure webhook has an ID
        if (!this.data.id) {
            this.data.id = crypto.randomUUID();
        }
        
        // Determine file path
        const filePath = this.filePath || path.join(config.webhooksDir, `${this.data.id}.json`);
        
        // Ensure the directory exists
        await ensureWebhooksDir();
        
        // Write file
        await fs.writeFile(filePath, JSON.stringify(this.data, null, 2));
    }
    
    /**
     * Delete a webhook
     * @static
     * @async
     * @param {string} webhookId - ID of the webhook to delete
     * @returns {Promise<Object>} Result of the delete operation
     * @throws {Error} If webhook ID is not provided or webhook is not found
     */
    static async delete(webhookId) {
        if (!webhookId) {
            throw new Error('Webhook ID is required');
        }
        
        const filePath = path.join(config.webhooksDir, `${webhookId}.json`);
        
        try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            return { success: true, message: 'Webhook deleted successfully' };
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Webhook with ID ${webhookId} not found`);
            }
            throw error;
        }
    }
    
    /**
     * Test a webhook by sending a test payload
     * @static
     * @async
     * @param {string} webhookId - ID of the webhook to test
     * @returns {Promise<WebhookResponse>} Result of the test
     */
    static async test(webhookId) {
        const webhook = await Webhook.getById(webhookId);
        
        try {
            // Create a test payload based on the event type
            const payload = {
                event: webhook.data.event,
                test: true,
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a test webhook from the Kanban board application'
                }
            };
            
            // Send the test request
            const response = await axios.post(webhook.data.url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Test': 'true'
                },
                timeout: 5000 // 5 second timeout
            });
            
            return {
                success: true,
                status: response.status,
                message: 'Webhook test successful'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Webhook test failed'
            };
        }
    }
    
    /**
     * Test a webhook connection without saving the webhook
     * @static
     * @async
     * @param {string} url - URL to test
     * @returns {Promise<WebhookResponse>} Result of the connection test
     * @throws {Error} If URL is not provided
     */
    static async testConnection(url) {
        if (!url) {
            throw new Error('URL is required');
        }
        
        try {
            // Create a test payload
            const payload = {
                event: 'connection.test',
                test: true,
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a connection test from the Kanban board application'
                }
            };
            
            // Send the test request
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Test': 'true'
                },
                timeout: 5000 // 5 second timeout
            });
            
            return {
                success: true,
                status: response.status,
                message: 'Connection test successful'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Connection test failed'
            };
        }
    }
    
    /**
     * Validate webhook data structure
     * @returns {boolean} True if the webhook data is valid
     */
    validate() {
        return (
            this.data &&
            typeof this.data === 'object' &&
            typeof this.data.name === 'string' &&
            typeof this.data.url === 'string' &&
            typeof this.data.event === 'string' &&
            (this.data.id === undefined || typeof this.data.id === 'string') &&
            (this.data.created_at === undefined || !Number.isNaN(new Date(this.data.created_at).getTime()))
        );
    }
}

module.exports = Webhook;
