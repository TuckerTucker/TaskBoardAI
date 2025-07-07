/**
 * @fileoverview Error handling middleware for the application
 * @module middleware/errorHandler
 */

/**
 * Express error handling middleware
 * @function errorHandler
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    // Handle specific error types
    if (err.type === 'validation') {
        return res.status(400).json({ error: err.message });
    }
    
    // Default error response
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

module.exports = errorHandler;
