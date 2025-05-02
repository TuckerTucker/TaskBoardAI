/**
 * Structured logging utility for MCP server
 * 
 * Provides consistent logging with support for different log levels,
 * formatted output, and contextual information.
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level - can be set via environment variable
const currentLevel = process.env.LOG_LEVEL 
  ? (LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO)
  : LOG_LEVELS.INFO;

// Track operation context and request data
let currentRequestData = null;

/**
 * Sets context data for the current request or operation
 * @param {Object} data - Request context data
 */
function setRequestContext(data) {
  currentRequestData = {
    ...data,
    timestamp: new Date().toISOString(),
    requestId: data.requestId || generateRequestId()
  };
}

/**
 * Clears the current request context
 */
function clearRequestContext() {
  currentRequestData = null;
}

/**
 * Generates a unique request ID
 * @returns {string} Unique request identifier
 * @private
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Formats a log message with timestamp and request context
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [data={}] - Additional data to log
 * @returns {Object} Formatted log entry
 * @private
 */
function formatLogEntry(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  
  return {
    timestamp,
    level,
    message,
    ...data,
    request: currentRequestData || undefined
  };
}

/**
 * Logs a message at the specified level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} [data={}] - Additional data to log
 * @private
 */
function log(level, message, data = {}) {
  // Check if this log level should be displayed
  if (LOG_LEVELS[level] > currentLevel) {
    return;
  }
  
  const entry = formatLogEntry(level, message, data);
  const serialized = JSON.stringify(entry);
  
  switch (level) {
    case 'ERROR':
      console.error(serialized);
      break;
    case 'WARN':
      console.warn(serialized);
      break;
    case 'DEBUG':
      console.debug(serialized);
      break;
    case 'INFO':
    default:
      console.log(serialized);
  }
}

/**
 * Logs an error message
 * @param {string} message - Error message
 * @param {Object|Error} [data={}] - Error object or additional data
 */
function error(message, data = {}) {
  // If data is an Error object, extract useful properties
  if (data instanceof Error) {
    const { message: errMessage, stack, name, code, ...rest } = data;
    log('ERROR', message, {
      error: {
        message: errMessage,
        name,
        code,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined,
        ...rest
      }
    });
  } else {
    log('ERROR', message, data);
  }
}

/**
 * Logs a warning message
 * @param {string} message - Warning message
 * @param {Object} [data={}] - Additional data
 */
function warn(message, data = {}) {
  log('WARN', message, data);
}

/**
 * Logs an info message
 * @param {string} message - Info message
 * @param {Object} [data={}] - Additional data
 */
function info(message, data = {}) {
  log('INFO', message, data);
}

/**
 * Logs a debug message
 * @param {string} message - Debug message
 * @param {Object} [data={}] - Additional data
 */
function debug(message, data = {}) {
  log('DEBUG', message, data);
}

/**
 * Records an audit log entry for security-sensitive operations
 * @param {string} action - The action being performed
 * @param {Object} details - Details about the action
 */
function audit(action, details = {}) {
  // Always log audit entries regardless of log level
  const entry = formatLogEntry('AUDIT', action, {
    audit: true,
    ...details
  });
  
  console.log(JSON.stringify(entry));
  
  // In a production system, you might want to write audit logs
  // to a separate file or database for compliance purposes
}

module.exports = {
  setRequestContext,
  clearRequestContext,
  error,
  warn,
  info,
  debug,
  audit,
  LOG_LEVELS
};