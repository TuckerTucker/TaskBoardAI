import { v4 as uuidv4 } from 'uuid';
import { observableLogger, performanceTracker } from '../../core/utils/observability.js';

/**
 * Enhanced MCP logging and monitoring utilities
 */

/**
 * Log MCP request with comprehensive context
 */
export function logMcpRequest(toolName, params, context = {}) {
  const requestId = uuidv4();
  
  // Set logging context for MCP operations
  observableLogger.setContext({
    requestId,
    userId: context?.user?.id || 'anonymous',
    action: toolName,
    source: 'mcp',
    toolName
  });
  
  // Log the request
  observableLogger.logRequest('MCP', toolName, {
    params: sanitizeMcpParams(params),
    context: {
      user: context?.user ? {
        id: context.user.id,
        username: context.user.username,
        role: context.user.role
      } : null,
      clientInfo: context?.clientInfo
    }
  });
  
  return requestId;
}

/**
 * Log MCP response with performance metrics
 */
export function logMcpResponse(toolName, result, startTime, requestId, context = {}) {
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  
  // Determine success status
  const success = result.success !== false;
  const statusCode = success ? 200 : 500;
  
  // Log the response
  observableLogger.logResponse('MCP', toolName, statusCode, durationMs, {
    requestId,
    success,
    resultType: typeof result,
    hasError: !!result.error,
    errorType: result.error?.type
  });
  
  // Log errors with full details
  if (!success && result.error) {
    observableLogger.error(`MCP tool error: ${toolName}`, {
      requestId,
      error: result.error,
      params: sanitizeMcpParams(context.params),
      durationMs
    });
  }
  
  // Log performance warnings for slow operations
  if (durationMs > 2000) { // MCP operations should generally be fast
    observableLogger.warn(`Slow MCP operation: ${toolName}`, {
      requestId,
      durationMs,
      toolName,
      success
    });
  }
  
  // Clear logging context
  observableLogger.clearContext();
  
  return { success, durationMs, requestId };
}

/**
 * Wrap MCP tool handlers with comprehensive observability
 */
export function withMcpObservability(toolName, handler) {
  return async function wrappedHandler(params, context = {}) {
    const startTime = Date.now();
    const requestId = logMcpRequest(toolName, params, context);
    const operationId = `mcp-${requestId}`;
    
    // Start performance tracking
    performanceTracker.startOperation(operationId, `MCP ${toolName}`, {
      tool: toolName,
      userId: context?.user?.id,
      source: 'mcp'
    });
    
    try {
      // Execute the original handler
      const result = await handler(params, context);
      
      // Log successful completion
      logMcpResponse(toolName, result, startTime, requestId, { params, context });
      
      // End performance tracking
      performanceTracker.endOperation(operationId, result.success !== false);
      
      return result;
    } catch (error) {
      // Create error result for failed operations
      const errorResult = {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name,
          stack: error.stack
        }
      };
      
      // Log error response
      logMcpResponse(toolName, errorResult, startTime, requestId, { params, context });
      
      // End performance tracking with failure
      performanceTracker.endOperation(operationId, false);
      
      return errorResult;
    }
  };
}

/**
 * Log MCP server lifecycle events
 */
export function logMcpServerEvent(event, data = {}) {
  observableLogger.setContext({
    source: 'mcp',
    event
  });
  
  switch (event) {
    case 'server-start':
      observableLogger.info('MCP server starting', {
        port: data.port,
        tools: data.toolCount,
        version: data.version
      });
      break;
      
    case 'server-ready':
      observableLogger.info('MCP server ready', {
        port: data.port,
        uptime: data.uptime
      });
      break;
      
    case 'server-stop':
      observableLogger.info('MCP server stopping', {
        uptime: data.uptime,
        reason: data.reason
      });
      break;
      
    case 'client-connect':
      observableLogger.info('MCP client connected', {
        clientId: data.clientId,
        clientInfo: data.clientInfo
      });
      break;
      
    case 'client-disconnect':
      observableLogger.info('MCP client disconnected', {
        clientId: data.clientId,
        duration: data.duration
      });
      break;
      
    case 'tool-register':
      observableLogger.debug('MCP tool registered', {
        toolName: data.toolName,
        description: data.description
      });
      break;
      
    case 'error':
      observableLogger.error('MCP server error', {
        error: data.error,
        context: data.context
      });
      break;
      
    default:
      observableLogger.debug(`MCP server event: ${event}`, data);
  }
  
  observableLogger.clearContext();
}

/**
 * Create MCP metrics collector for tool usage statistics
 */
export class McpMetricsCollector {
  constructor() {
    this.toolUsage = new Map(); // toolName -> { count, totalDuration, errors }
    this.clientSessions = new Map(); // clientId -> { startTime, requestCount, lastActivity }
  }
  
  recordToolUsage(toolName, durationMs, success = true) {
    const stats = this.toolUsage.get(toolName) || {
      count: 0,
      totalDuration: 0,
      errors: 0,
      lastUsed: null
    };
    
    stats.count += 1;
    stats.totalDuration += durationMs;
    stats.lastUsed = Date.now();
    
    if (!success) {
      stats.errors += 1;
    }
    
    this.toolUsage.set(toolName, stats);
  }
  
  recordClientSession(clientId, event, data = {}) {
    switch (event) {
      case 'connect':
        this.clientSessions.set(clientId, {
          startTime: Date.now(),
          requestCount: 0,
          lastActivity: Date.now(),
          clientInfo: data.clientInfo
        });
        break;
        
      case 'request':
        const session = this.clientSessions.get(clientId);
        if (session) {
          session.requestCount += 1;
          session.lastActivity = Date.now();
        }
        break;
        
      case 'disconnect':
        this.clientSessions.delete(clientId);
        break;
    }
  }
  
  getToolUsageStats() {
    const stats = {};
    
    for (const [toolName, data] of this.toolUsage) {
      stats[toolName] = {
        ...data,
        averageDuration: data.count > 0 ? data.totalDuration / data.count : 0,
        errorRate: data.count > 0 ? data.errors / data.count : 0
      };
    }
    
    return stats;
  }
  
  getClientSessionStats() {
    const activeSessions = Array.from(this.clientSessions.values());
    const now = Date.now();
    
    return {
      activeClients: activeSessions.length,
      totalRequests: activeSessions.reduce((sum, session) => sum + session.requestCount, 0),
      averageSessionDuration: activeSessions.length > 0 
        ? activeSessions.reduce((sum, session) => sum + (now - session.startTime), 0) / activeSessions.length
        : 0
    };
  }
}

/**
 * Global MCP metrics collector instance
 */
export const mcpMetrics = new McpMetricsCollector();

/**
 * Sanitize sensitive information from MCP parameters
 */
function sanitizeMcpParams(params) {
  if (!params) return params;
  
  const sanitized = { ...params };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
  
  function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        result[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return sanitizeObject(sanitized);
}

/**
 * Enhanced error formatter for MCP responses
 */
export function formatMcpError(error, context = {}) {
  const errorResponse = {
    success: false,
    error: {
      message: error.message || 'Unknown error',
      type: error.constructor.name || 'Error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  };
  
  // Log the error for debugging
  observableLogger.error('MCP operation failed', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context
  });
  
  return errorResponse;
}