# 13 - Observability

This document outlines the implementation of observability features for the TaskBoardAI application. Observability includes logging, monitoring, metrics, and tracing to provide insights into the application's behavior, performance, and health.

## Overview

Observability is essential for understanding how the application behaves in production, troubleshooting issues, and optimizing performance. This implementation will provide comprehensive observability capabilities across all interfaces:

- MCP (Model Context Protocol)
- REST API 
- CLI

## Implementation Steps

### 1. Logging System

First, we'll implement a robust logging system using Winston.

```typescript
// src/utils/logger.ts
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/config';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create file transport with daily rotation
const fileTransport = new DailyRotateFile({
  filename: path.join(logsDir, '%DATE%-app.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat
});

// Create error file transport with daily rotation
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, '%DATE%-error.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  format: fileFormat
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'tkr-kanban' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    // File transports
    fileTransport,
    errorFileTransport
  ],
  exitOnError: false
});

// Add request context to logs
export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  [key: string]: any;
}

let contextData: LogContext = {};

export function setLogContext(context: LogContext): void {
  contextData = { ...contextData, ...context };
}

export function clearLogContext(): void {
  contextData = {};
}

// Wrapper functions to include context
export function info(message: string, meta: object = {}): void {
  logger.info(message, { ...contextData, ...meta });
}

export function warn(message: string, meta: object = {}): void {
  logger.warn(message, { ...contextData, ...meta });
}

export function error(message: string, meta: object = {}): void {
  logger.error(message, { ...contextData, ...meta });
}

export function debug(message: string, meta: object = {}): void {
  logger.debug(message, { ...contextData, ...meta });
}

export function verbose(message: string, meta: object = {}): void {
  logger.verbose(message, { ...contextData, ...meta });
}

export default {
  info,
  warn,
  error,
  debug,
  verbose,
  setLogContext,
  clearLogContext
};
```

### 2. Request Logging Middleware

Implement middleware for logging HTTP requests and responses.

```typescript
// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { setLogContext, clearLogContext } from '../utils/logger';
import onFinished from 'on-finished';

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Generate a unique request ID
  const requestId = uuidv4();
  
  // Set request ID in response header
  res.setHeader('X-Request-ID', requestId);
  
  // Get user ID if available
  const userId = req.user?.id || 'anonymous';
  
  // Set log context with request details
  setLogContext({
    requestId,
    userId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown'
  });
  
  // Log request
  logger.info(`REQUEST ${req.method} ${req.originalUrl}`, {
    query: req.query,
    body: sanitizeBody(req.body)
  });
  
  // Record start time
  const startTime = Date.now();
  
  // Log response when finished
  onFinished(res, (err, res) => {
    const responseTime = Date.now() - startTime;
    
    logger.info(`RESPONSE ${req.method} ${req.originalUrl} ${res.statusCode}`, {
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.getHeader('content-length')
    });
    
    // Clear log context after request is complete
    clearLogContext();
  });
  
  next();
}

// Sanitize sensitive information from request body
function sanitizeBody(body: any): any {
  if (!body) return body;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}
```

### 3. Error Logging Enhancement

Update the error handling middleware to include better error logging.

```typescript
// src/middleware/errorHandler.ts - update existing error handler
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  FileSystemError,
  DuplicateResourceError,
  AppError
} from '../utils/errors';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Determine error type and corresponding status code
  let statusCode = 500;
  let errorType = 'ServerError';
  
  if (err instanceof ValidationError) {
    statusCode = 400;
    errorType = 'ValidationError';
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    errorType = 'NotFoundError';
  } else if (err instanceof AuthenticationError) {
    statusCode = 401;
    errorType = 'AuthenticationError';
  } else if (err instanceof AuthorizationError) {
    statusCode = 403;
    errorType = 'AuthorizationError';
  } else if (err instanceof DuplicateResourceError) {
    statusCode = 400;
    errorType = 'DuplicateResourceError';
  } else if (err instanceof FileSystemError) {
    statusCode = 500;
    errorType = 'FileSystemError';
  } else if (err instanceof AppError) {
    statusCode = err.statusCode || 500;
    errorType = err.constructor.name;
  }
  
  // Log the error with contextual information
  const logData = {
    errorType,
    statusCode,
    stack: err.stack,
    originalUrl: req.originalUrl,
    method: req.method,
    userId: req.user?.id || 'anonymous',
    query: req.query
  };
  
  if (statusCode >= 500) {
    logger.error(`Server Error: ${err.message}`, logData);
  } else {
    logger.warn(`Client Error: ${err.message}`, logData);
  }
  
  // Send response to client
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      type: errorType,
      // Include validation details if available
      ...(err instanceof ValidationError && err.details ? { details: err.details } : {})
    }
  });
}
```

### 4. Performance Monitoring

Implement middleware for monitoring performance metrics.

```typescript
// src/middleware/performanceMonitor.ts
import { Request, Response, NextFunction } from 'express';
import onHeaders from 'on-headers';
import onFinished from 'on-finished';
import logger from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

// Initialize metrics collector
const metrics = new MetricsCollector();

// Performance monitoring middleware
export function performanceMonitor(req: Request, res: Response, next: NextFunction) {
  // Skip monitoring for non-API requests
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }
  
  // Record start time
  const startTime = process.hrtime();
  
  // Track when headers are sent
  onHeaders(res, () => {
    const headersSentTime = process.hrtime(startTime);
    const headersTimeMs = headersSentTime[0] * 1000 + headersSentTime[1] / 1000000;
    
    // Record time to first byte
    metrics.recordTimeToFirstByte(req.method, req.route?.path || req.path, headersTimeMs);
  });
  
  // Track when response finishes
  onFinished(res, () => {
    const endTime = process.hrtime(startTime);
    const durationMs = endTime[0] * 1000 + endTime[1] / 1000000;
    
    // Get route pattern if available, or use path
    const route = req.route?.path || 'unknown';
    
    // Record response time
    metrics.recordResponseTime(req.method, route, durationMs);
    
    // Record status code
    metrics.recordStatusCode(res.statusCode);
    
    // Log slow requests
    if (durationMs > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.originalUrl}`, {
        durationMs,
        method: req.method,
        route,
        query: req.query,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
}
```

### 5. Metrics Collection

Implement a metrics collector for tracking application metrics.

```typescript
// src/utils/metrics.ts
import os from 'os';
import { EventEmitter } from 'events';

interface ResponseTimeMetric {
  method: string;
  route: string;
  durationMs: number;
  timestamp: number;
}

interface StatusCodeMetric {
  statusCode: number;
  count: number;
}

interface ResourceMetric {
  cpu: number;
  memory: number;
  timestamp: number;
}

interface TimeToFirstByteMetric {
  method: string;
  route: string;
  timeMs: number;
  timestamp: number;
}

export class MetricsCollector extends EventEmitter {
  private responseTimeMetrics: ResponseTimeMetric[] = [];
  private statusCodeCounts: Map<number, number> = new Map();
  private resourceMetrics: ResourceMetric[] = [];
  private ttfbMetrics: TimeToFirstByteMetric[] = [];
  private lastGcMetrics = { minorGc: 0, majorGc: 0 };
  
  constructor() {
    super();
    
    // Start collecting resource metrics periodically
    setInterval(() => this.collectResourceMetrics(), 60000); // Every minute
  }
  
  recordResponseTime(method: string, route: string, durationMs: number): void {
    const metric: ResponseTimeMetric = {
      method,
      route,
      durationMs,
      timestamp: Date.now()
    };
    
    this.responseTimeMetrics.push(metric);
    
    // Keep only the last 1000 records
    if (this.responseTimeMetrics.length > 1000) {
      this.responseTimeMetrics.shift();
    }
    
    this.emit('responseTime', metric);
  }
  
  recordStatusCode(statusCode: number): void {
    const currentCount = this.statusCodeCounts.get(statusCode) || 0;
    this.statusCodeCounts.set(statusCode, currentCount + 1);
    
    const metric: StatusCodeMetric = {
      statusCode,
      count: currentCount + 1
    };
    
    this.emit('statusCode', metric);
  }
  
  recordTimeToFirstByte(method: string, route: string, timeMs: number): void {
    const metric: TimeToFirstByteMetric = {
      method,
      route,
      timeMs,
      timestamp: Date.now()
    };
    
    this.ttfbMetrics.push(metric);
    
    // Keep only the last 1000 records
    if (this.ttfbMetrics.length > 1000) {
      this.ttfbMetrics.shift();
    }
    
    this.emit('ttfb', metric);
  }
  
  private collectResourceMetrics(): void {
    const metric: ResourceMetric = {
      cpu: process.cpuUsage().user / 1000, // Microseconds to milliseconds
      memory: process.memoryUsage().heapUsed,
      timestamp: Date.now()
    };
    
    this.resourceMetrics.push(metric);
    
    // Keep only the last 1440 records (1 day at 1 minute intervals)
    if (this.resourceMetrics.length > 1440) {
      this.resourceMetrics.shift();
    }
    
    this.emit('resource', metric);
  }
  
  // Get metrics for expose endpoints
  getMetrics(): any {
    // Calculate response time statistics
    const responseTimeMean = this.calculateMean(this.responseTimeMetrics.map(m => m.durationMs));
    const responseTimeP95 = this.calculatePercentile(this.responseTimeMetrics.map(m => m.durationMs), 95);
    const responseTimeP99 = this.calculatePercentile(this.responseTimeMetrics.map(m => m.durationMs), 99);
    
    // Calculate time to first byte statistics
    const ttfbMean = this.calculateMean(this.ttfbMetrics.map(m => m.timeMs));
    const ttfbP95 = this.calculatePercentile(this.ttfbMetrics.map(m => m.timeMs), 95);
    
    // Get latest resource metrics
    const latestResource = this.resourceMetrics.length > 0 
      ? this.resourceMetrics[this.resourceMetrics.length - 1] 
      : { cpu: 0, memory: 0, timestamp: 0 };
    
    // Count status codes by category
    let status2xx = 0, status3xx = 0, status4xx = 0, status5xx = 0;
    
    this.statusCodeCounts.forEach((count, statusCode) => {
      if (statusCode >= 200 && statusCode < 300) status2xx += count;
      else if (statusCode >= 300 && statusCode < 400) status3xx += count;
      else if (statusCode >= 400 && statusCode < 500) status4xx += count;
      else if (statusCode >= 500) status5xx += count;
    });
    
    // Get process info
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    return {
      timestamp: Date.now(),
      process: {
        uptime,
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external
        },
        versions: process.versions
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        loadAvg: os.loadavg(),
        totalmem: os.totalmem(),
        freemem: os.freemem()
      },
      performance: {
        responseTime: {
          mean: responseTimeMean,
          p95: responseTimeP95,
          p99: responseTimeP99
        },
        ttfb: {
          mean: ttfbMean,
          p95: ttfbP95
        },
        resource: {
          cpu: latestResource.cpu,
          memory: latestResource.memory
        }
      },
      requests: {
        status2xx,
        status3xx,
        status4xx,
        status5xx
      }
    };
  }
  
  // Get response times by route
  getResponseTimesByRoute(): any {
    const routeMap = new Map<string, number[]>();
    
    this.responseTimeMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.route}`;
      const times = routeMap.get(key) || [];
      times.push(metric.durationMs);
      routeMap.set(key, times);
    });
    
    const result: any = {};
    
    routeMap.forEach((times, route) => {
      result[route] = {
        count: times.length,
        mean: this.calculateMean(times),
        p95: this.calculatePercentile(times, 95),
        max: Math.max(...times)
      };
    });
    
    return result;
  }
  
  // Helper methods for calculating statistics
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
```

### 6. Metrics API Endpoint

Create an API endpoint for exposing metrics.

```typescript
// src/controllers/metricsController.ts
import { Request, Response, NextFunction } from 'express';
import { MetricsCollector } from '../utils/metrics';

// Get metrics collector instance
const metricsCollector = new MetricsCollector();

export class MetricsController {
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = metricsCollector.getMetrics();
      
      return res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getResponseTimesByRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const responseTimesByRoute = metricsCollector.getResponseTimesByRoute();
      
      return res.status(200).json({
        success: true,
        data: responseTimesByRoute
      });
    } catch (error) {
      next(error);
    }
  }
}

// src/routes/metricsRoutes.ts
import { Router } from 'express';
import { MetricsController } from '../controllers/metricsController';
import { authenticate } from '../middleware/authMiddleware';
import { requirePermission } from '../utils/auth';
import { ServiceFactory } from '../services/ServiceFactory';

const router = Router();
const metricsController = new MetricsController();
const serviceFactory = new ServiceFactory();
const authService = serviceFactory.createAuthService();

// Protected routes - require admin permissions
router.get('/', authenticate(authService), requirePermission('config', 'admin'), metricsController.getMetrics);
router.get('/response-times', authenticate(authService), requirePermission('config', 'admin'), metricsController.getResponseTimesByRoute);

export default router;

// Update app.js to include the metrics routes
app.use('/api/metrics', metricsRoutes);
```

### 7. Health Check Endpoint

Implement a health check endpoint for monitoring application health.

```typescript
// src/controllers/healthController.ts
import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ServiceFactory } from '../services/ServiceFactory';

export class HealthController {
  async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const serviceFactory = new ServiceFactory();
      const boardRepository = serviceFactory.createBoardRepository();
      
      // Check database access
      let dbStatus;
      try {
        await boardRepository.getAllBoards();
        dbStatus = 'ok';
      } catch (error) {
        dbStatus = 'error';
      }
      
      // Check file system access
      let fileSystemStatus;
      try {
        const testPath = path.join(process.cwd(), 'logs', 'health-check.txt');
        await fs.writeFile(testPath, `Health check at ${new Date().toISOString()}`);
        await fs.unlink(testPath);
        fileSystemStatus = 'ok';
      } catch (error) {
        fileSystemStatus = 'error';
      }
      
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryThreshold = 1024 * 1024 * 1024; // 1GB
      const memoryStatus = memoryUsage.heapUsed < memoryThreshold ? 'ok' : 'warning';
      
      // Overall status
      const overallStatus = dbStatus === 'ok' && fileSystemStatus === 'ok' 
        ? (memoryStatus === 'ok' ? 'ok' : 'warning') 
        : 'error';
      
      return res.status(200).json({
        success: true,
        data: {
          status: overallStatus,
          uptime: process.uptime(),
          services: {
            database: dbStatus,
            fileSystem: fileSystemStatus,
            memory: memoryStatus
          },
          details: {
            memory: {
              rss: memoryUsage.rss,
              heapTotal: memoryUsage.heapTotal,
              heapUsed: memoryUsage.heapUsed,
              external: memoryUsage.external
            }
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

// src/routes/healthRoutes.ts
import { Router } from 'express';
import { HealthController } from '../controllers/healthController';

const router = Router();
const healthController = new HealthController();

// Public health check endpoint
router.get('/', healthController.getHealth);

export default router;

// Update app.js to include the health routes
app.use('/api/health', healthRoutes);
```

### 8. MCP Logging and Tracking

Enhance the MCP server with logging and performance tracking.

```typescript
// src/mcp/utils/mcpLogger.js
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Log MCP request
export function logMcpRequest(toolName, params, context) {
  const requestId = uuidv4();
  
  // Set log context
  logger.setLogContext({
    requestId,
    userId: context?.user?.id || 'anonymous',
    action: toolName,
    source: 'mcp'
  });
  
  // Log the request
  logger.info(`MCP REQUEST: ${toolName}`, {
    params: sanitizeParams(params)
  });
  
  return requestId;
}

// Log MCP response
export function logMcpResponse(toolName, result, startTime, requestId) {
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  
  // Log the response
  logger.info(`MCP RESPONSE: ${toolName}`, {
    requestId,
    success: result.success,
    durationMs
  });
  
  // Log error if request failed
  if (!result.success) {
    logger.error(`MCP ERROR: ${toolName}`, {
      requestId,
      error: result.error
    });
  }
  
  // Log slow requests
  if (durationMs > 1000) {
    logger.warn(`Slow MCP request: ${toolName}`, {
      requestId,
      durationMs
    });
  }
  
  // Clear log context
  logger.clearLogContext();
}

// Sanitize sensitive information from request params
function sanitizeParams(params) {
  if (!params) return params;
  
  const sanitized = { ...params };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// Update the MCP server to use logging
// src/mcp/kanbanMcpServer.js - modify the tool handler
function registerTool(name, description, parameters, handler) {
  // ... existing code
  
  // Wrap the handler with logging
  const wrappedHandler = async (params, context) => {
    const startTime = Date.now();
    const requestId = logMcpRequest(name, params, context);
    
    try {
      const result = await handler(params, context);
      logMcpResponse(name, result, startTime, requestId);
      return result;
    } catch (error) {
      const errorResult = {
        success: false,
        error: {
          message: error.message,
          type: error.constructor.name
        }
      };
      logMcpResponse(name, errorResult, startTime, requestId);
      return errorResult;
    }
  };
  
  // Register the tool with the wrapped handler
  this.tools[name] = {
    description,
    parameters,
    handler: wrappedHandler
  };
}
```

### 9. CLI Logging

Implement logging for the CLI interface.

```typescript
// src/cli/utils/cliLogger.ts
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Log CLI command
export function logCliCommand(command: string, args: any): string {
  const commandId = uuidv4();
  
  // Set log context
  logger.setLogContext({
    commandId,
    source: 'cli'
  });
  
  // Log the command
  logger.info(`CLI COMMAND: ${command}`, {
    args: sanitizeArgs(args)
  });
  
  return commandId;
}

// Log CLI command result
export function logCliResult(command: string, result: any, error: Error | null, startTime: number, commandId: string): void {
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  
  if (error) {
    // Log error
    logger.error(`CLI ERROR: ${command}`, {
      commandId,
      error: {
        message: error.message,
        stack: error.stack
      },
      durationMs
    });
  } else {
    // Log success
    logger.info(`CLI RESULT: ${command}`, {
      commandId,
      durationMs
    });
  }
  
  // Clear log context
  logger.clearLogContext();
}

// Sanitize sensitive information from command args
function sanitizeArgs(args: any): any {
  if (!args) return args;
  
  const sanitized = { ...args };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// Wrap CLI command actions with logging
export function withLogging(command: string, action: Function): Function {
  return async (...args) => {
    const startTime = Date.now();
    const commandId = logCliCommand(command, args);
    
    try {
      const result = await action(...args);
      logCliResult(command, result, null, startTime, commandId);
      return result;
    } catch (error) {
      logCliResult(command, null, error, startTime, commandId);
      throw error;
    }
  };
}

// Example usage in a command
// src/cli/commands/boardCommands.ts - example of adding logging to commands
export function setupBoardCommands(program: Command): void {
  // ... existing code
  
  program
    .command('boards:list')
    .description('List all boards')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(withLogging('boards:list', async (options) => {
      try {
        const serviceFactory = new ServiceFactory();
        const boardService = serviceFactory.createBoardService();
        
        const boards = await boardService.getAllBoards();
        
        // ... rest of the command
      } catch (error) {
        handleCliError(error);
      }
    }));
  
  // Apply similar changes to other commands...
}
```

### 10. Diagnostic Commands

Add diagnostic commands to the CLI for troubleshooting.

```typescript
// src/cli/commands/diagnosticCommands.ts
import { Command } from 'commander';
import chalk from 'chalk';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { ServiceFactory } from '../../services/ServiceFactory';
import { handleCliError } from '../utils/errorHandler';
import { Table } from 'cli-table3';
import { withLogging } from '../utils/cliLogger';

export function setupDiagnosticCommands(program: Command): void {
  const diagnosticCommand = program
    .command('diagnostics')
    .description('Diagnostic and troubleshooting commands');
  
  diagnosticCommand
    .command('system')
    .description('Show system information')
    .action(withLogging('diagnostics:system', async () => {
      try {
        console.log(chalk.cyan('System Information:'));
        console.log(`Platform: ${os.platform()} ${os.release()}`);
        console.log(`Architecture: ${os.arch()}`);
        console.log(`CPUs: ${os.cpus().length} x ${os.cpus()[0].model}`);
        console.log(`Memory: ${formatBytes(os.totalmem())} total, ${formatBytes(os.freemem())} free`);
        console.log(`Node.js: ${process.version}`);
        console.log(`Process uptime: ${formatUptime(process.uptime())}`);
        
        const memoryUsage = process.memoryUsage();
        console.log(chalk.cyan('\nProcess Memory:'));
        console.log(`RSS: ${formatBytes(memoryUsage.rss)}`);
        console.log(`Heap Total: ${formatBytes(memoryUsage.heapTotal)}`);
        console.log(`Heap Used: ${formatBytes(memoryUsage.heapUsed)}`);
        console.log(`External: ${formatBytes(memoryUsage.external)}`);
      } catch (error) {
        handleCliError(error);
      }
    }));
  
  diagnosticCommand
    .command('health')
    .description('Check application health')
    .action(withLogging('diagnostics:health', async () => {
      try {
        const serviceFactory = new ServiceFactory();
        const httpClient = serviceFactory.createHttpClient();
        
        console.log(chalk.cyan('Checking application health...'));
        
        try {
          const response = await httpClient.get('/api/health');
          
          if (response.data.success) {
            const health = response.data.data;
            
            console.log(`Status: ${formatStatus(health.status)}`);
            console.log(`Uptime: ${formatUptime(health.uptime)}`);
            
            console.log(chalk.cyan('\nServices:'));
            Object.entries(health.services).forEach(([name, status]) => {
              console.log(`${name}: ${formatStatus(status as string)}`);
            });
            
            console.log(chalk.cyan('\nMemory:'));
            Object.entries(health.details.memory).forEach(([name, value]) => {
              console.log(`${name}: ${formatBytes(value as number)}`);
            });
          } else {
            console.log(chalk.red('Health check failed'));
          }
        } catch (error) {
          console.log(chalk.red('Health check failed:'));
          console.log(error.message);
        }
      } catch (error) {
        handleCliError(error);
      }
    }));
  
  diagnosticCommand
    .command('logs')
    .description('View application logs')
    .option('--level <level>', 'Log level filter (error, warn, info)', 'info')
    .option('--limit <n>', 'Number of log entries to show', '50')
    .option('--since <time>', 'Show logs since time (e.g. 1h, 1d)', '1d')
    .action(withLogging('diagnostics:logs', async (options) => {
      try {
        const logsDir = path.join(process.cwd(), 'logs');
        
        // Check if logs directory exists
        if (!fs.existsSync(logsDir)) {
          console.log(chalk.yellow('Logs directory not found'));
          return;
        }
        
        // Get log files
        const files = fs.readdirSync(logsDir)
          .filter(file => file.endsWith('.log'))
          .sort()
          .reverse();
        
        if (files.length === 0) {
          console.log(chalk.yellow('No log files found'));
          return;
        }
        
        // Parse since option
        const sinceTime = parseSinceTime(options.since);
        
        // Read latest log file
        const logFile = path.join(logsDir, files[0]);
        const logContent = fs.readFileSync(logFile, 'utf-8');
        
        // Parse log entries
        const logEntries = logContent
          .split('\n')
          .filter(line => line.trim() !== '')
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (error) {
              return { level: 'unknown', message: line, timestamp: new Date().toISOString() };
            }
          })
          .filter(entry => {
            // Filter by level
            const levelPriority = { error: 0, warn: 1, info: 2, verbose: 3, debug: 4 };
            const entryLevelPriority = levelPriority[entry.level] || 99;
            const filterLevelPriority = levelPriority[options.level] || 2;
            
            // Filter by time
            const entryTime = new Date(entry.timestamp).getTime();
            
            return entryLevelPriority <= filterLevelPriority && entryTime >= sinceTime;
          })
          .slice(0, parseInt(options.limit));
        
        // Display log entries
        const table = new Table({
          head: ['Time', 'Level', 'Message'],
          style: { head: ['cyan'] }
        });
        
        logEntries.reverse().forEach(entry => {
          const time = new Date(entry.timestamp).toLocaleTimeString();
          const level = formatLogLevel(entry.level);
          const message = entry.message;
          
          table.push([time, level, message]);
        });
        
        console.log(table.toString());
        
        if (logEntries.length === 0) {
          console.log(chalk.yellow('No log entries match the filter criteria'));
        }
      } catch (error) {
        handleCliError(error);
      }
    }));
  
  return diagnosticCommand;
}

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatStatus(status: string): string {
  if (status === 'ok') {
    return chalk.green('OK');
  } else if (status === 'warning') {
    return chalk.yellow('WARNING');
  } else {
    return chalk.red('ERROR');
  }
}

function formatLogLevel(level: string): string {
  if (level === 'error') {
    return chalk.red('ERROR');
  } else if (level === 'warn') {
    return chalk.yellow('WARN');
  } else if (level === 'info') {
    return chalk.blue('INFO');
  } else if (level === 'verbose') {
    return chalk.cyan('VERB');
  } else if (level === 'debug') {
    return chalk.gray('DEBUG');
  } else {
    return level.toUpperCase();
  }
}

function parseSinceTime(since: string): number {
  const now = Date.now();
  
  if (since.endsWith('h')) {
    const hours = parseInt(since.slice(0, -1));
    return now - hours * 60 * 60 * 1000;
  } else if (since.endsWith('d')) {
    const days = parseInt(since.slice(0, -1));
    return now - days * 24 * 60 * 60 * 1000;
  } else if (since.endsWith('m')) {
    const minutes = parseInt(since.slice(0, -1));
    return now - minutes * 60 * 1000;
  } else {
    return now - 24 * 60 * 60 * 1000; // Default to 1 day
  }
}

// Register the diagnostic commands
// In src/cli/index.ts
import { setupDiagnosticCommands } from './commands/diagnosticCommands';

// In the setupCli function
export function setupCli(): Command {
  // ... existing code
  
  // Register diagnostic commands
  setupDiagnosticCommands(program);
  
  return program;
}
```

### 11. Application Tracing

Implement distributed tracing to track requests across components.

```typescript
// src/utils/tracer.ts
import opentelemetry from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import config from '../config/config';

// Initialize tracer
export function initTracer(): void {
  // Only initialize in production or if explicitly enabled
  if (config.environment !== 'production' && !process.env.ENABLE_TRACING) {
    return;
  }
  
  // Create a tracer provider
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'tkr-kanban',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment
    })
  });
  
  // Configure span processor and exporter
  const exporter = new ConsoleSpanExporter();
  const processor = new SimpleSpanProcessor(exporter);
  
  provider.addSpanProcessor(processor);
  
  // Register the provider
  provider.register();
}

// Get tracer instance
export function getTracer(name: string): opentelemetry.Tracer {
  return opentelemetry.trace.getTracer(name);
}

// Create a middleware for express
// src/middleware/tracingMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { getTracer } from '../utils/tracer';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';

// Get tracer
const tracer = getTracer('express-middleware');

// Express middleware for tracing
export function traceRequests(req: Request, res: Response, next: NextFunction) {
  // Only trace in production or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_TRACING) {
    return next();
  }
  
  // Extract trace context from headers if present
  const traceparent = req.headers.traceparent as string;
  
  // Create a new span
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.host': req.headers.host,
      'http.user_agent': req.headers['user-agent']
    }
  });
  
  // Set request ID from trace
  const traceId = trace.getSpanContext(context.active())?.traceId;
  if (traceId) {
    res.setHeader('X-Trace-ID', traceId);
  }
  
  // Execute the rest of the request in the context of the span
  context.with(trace.setSpan(context.active(), span), () => {
    // Handle request completion
    const endRequest = () => {
      // Add response attributes
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_content_length': parseInt(res.get('content-length') || '0', 10)
      });
      
      // Set status based on response
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      }
      
      // End the span
      span.end();
    };
    
    // Track response completion
    res.on('finish', endRequest);
    res.on('close', endRequest);
    
    next();
  });
}

// Apply tracing middleware to app
// src/app.ts
import { initTracer, traceRequests } from './middleware/tracingMiddleware';

// Initialize tracer
initTracer();

// Apply tracing middleware before routes
app.use(traceRequests);
```

### 12. Integration with External Monitoring Systems

Implement integrations with external monitoring systems like Prometheus.

```typescript
// src/middleware/prometheusMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import onFinished from 'on-finished';

// Create a registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);

// Prometheus middleware
export function prometheusMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip metrics endpoint
  if (req.path === '/metrics') {
    return next();
  }
  
  // Start timer
  const start = process.hrtime();
  
  // Track when response finishes
  onFinished(res, () => {
    // Calculate duration
    const end = process.hrtime(start);
    const duration = end[0] + end[1] / 1e9;
    
    // Get route pattern if available, or use path
    const route = req.route?.path || 'unknown';
    
    // Record metrics
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestCounter
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
}

// Metrics endpoint
export function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}

// Add Prometheus middleware and endpoint to app
// src/app.ts
import { prometheusMiddleware, metricsEndpoint } from './middleware/prometheusMiddleware';

// Apply Prometheus middleware
app.use(prometheusMiddleware);

// Add metrics endpoint
app.get('/metrics', metricsEndpoint);
```

### 13. Error Tracking

Implement error tracking to collect and group application errors.

```typescript
// src/utils/errorTracker.ts
import logger from './logger';

interface ErrorContext {
  user?: {
    id: string;
    username: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

class ErrorTracker {
  private errors: Map<string, { count: number, lastSeen: Date, samples: Error[] }> = new Map();
  private readonly MAX_SAMPLES = 10;
  
  // Track an error
  track(error: Error, context: ErrorContext = {}): void {
    // Generate fingerprint for error
    const fingerprint = this.generateFingerprint(error);
    
    // Get or create error entry
    const entry = this.errors.get(fingerprint) || {
      count: 0,
      lastSeen: new Date(),
      samples: []
    };
    
    // Update entry
    entry.count += 1;
    entry.lastSeen = new Date();
    
    // Add sample if we don't have too many
    if (entry.samples.length < this.MAX_SAMPLES) {
      entry.samples.push(error);
    }
    
    // Update map
    this.errors.set(fingerprint, entry);
    
    // Log the error
    logger.error(`Error tracked: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      fingerprint
    });
    
    // If integrated with an external error tracking service, send there
    this.sendToExternalService(error, context, fingerprint);
  }
  
  // Get all tracked errors
  getErrors(): any[] {
    const result: any[] = [];
    
    this.errors.forEach((entry, fingerprint) => {
      result.push({
        fingerprint,
        count: entry.count,
        lastSeen: entry.lastSeen.toISOString(),
        samples: entry.samples.map(error => ({
          name: error.name,
          message: error.message,
          stack: error.stack
        }))
      });
    });
    
    return result;
  }
  
  // Generate a fingerprint for an error
  private generateFingerprint(error: Error): string {
    // Extract stack frames
    const stack = error.stack || '';
    const frames = stack.split('\n')
      .filter(line => line.includes(' at '))
      .slice(0, 3) // Take top 3 frames
      .map(line => line.trim());
    
    // Combine error name, message, and frames for fingerprint
    return `${error.name}:${error.message}:${frames.join('|')}`;
  }
  
  // Send error to external service
  private sendToExternalService(error: Error, context: ErrorContext, fingerprint: string): void {
    // If integrated with Sentry, New Relic, etc., send error there
    // This is a placeholder for external service integration
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Update error handler to track errors
// src/middleware/errorHandler.ts - update existing error handler
import { errorTracker } from '../utils/errorTracker';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // ... existing error handler code
  
  // Track error
  errorTracker.track(err, {
    user: req.user ? {
      id: req.user.id,
      username: req.user.username
    } : undefined,
    tags: {
      method: req.method,
      path: req.path
    },
    extra: {
      query: req.query,
      headers: req.headers
    }
  });
  
  // ... rest of error handler
}
```

### 14. Development and Debug Logging

Implement development-specific logging for debugging.

```typescript
// src/utils/debugLogger.ts
import fs from 'fs';
import path from 'path';
import util from 'util';
import chalk from 'chalk';
import config from '../config/config';

// Debug logger for development
class DebugLogger {
  private enabled: boolean;
  private logFile: string;
  
  constructor() {
    this.enabled = process.env.DEBUG === 'true' || config.environment === 'development';
    this.logFile = path.join(process.cwd(), 'logs', 'debug.log');
    
    // Create logs directory if it doesn't exist
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }
  
  log(context: string, ...args: any[]): void {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const formatted = args.map(arg => 
      typeof arg === 'object' 
        ? util.inspect(arg, { depth: null, colors: false }) 
        : String(arg)
    ).join(' ');
    
    const message = `[${timestamp}] [${context}] ${formatted}\n`;
    
    // Write to console
    console.log(chalk.cyan(`[DEBUG] [${context}]`), ...args);
    
    // Write to file
    fs.appendFileSync(this.logFile, message);
  }
  
  object(context: string, obj: any, label: string = ''): void {
    if (!this.enabled) return;
    
    const labelPrefix = label ? `${label}: ` : '';
    this.log(context, `${labelPrefix}${util.inspect(obj, { depth: null, colors: false })}`);
  }
  
  trace(context: string, message: string): void {
    if (!this.enabled) return;
    
    const stack = new Error().stack;
    this.log(context, `${message}\nStack: ${stack}`);
  }
}

// Export singleton instance
export const debug = new DebugLogger();

// Example usage in a service
// src/services/BoardService.ts - example of using debug logger
import { debug } from '../utils/debugLogger';

export class BoardService {
  async getBoardById(id: string): Promise<Board | null> {
    debug.log('BoardService', `Getting board by ID: ${id}`);
    
    try {
      const board = await this.boardRepository.getBoardById(id);
      
      debug.object('BoardService', board, 'Board found');
      
      return board;
    } catch (error) {
      debug.log('BoardService', `Error getting board: ${error.message}`);
      throw error;
    }
  }
}
```

### 15. Application Insights for REST API

Implement detailed insights for REST API requests and responses.

```typescript
// src/middleware/apiInsights.ts
import { Request, Response, NextFunction } from 'express';
import onFinished from 'on-finished';
import logger from '../utils/logger';
import { MetricsCollector } from '../utils/metrics';

// Get metrics collector instance
const metrics = new MetricsCollector();

// API insights middleware
export function apiInsights(req: Request, res: Response, next: NextFunction) {
  // Skip for non-API routes
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }
  
  // Record start time
  const startTime = process.hrtime();
  
  // Get original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Override send method to capture response size
  res.send = function(body) {
    res.locals.responseBody = body;
    res.locals.responseSize = Buffer.byteLength(body);
    return originalSend.apply(this, arguments);
  };
  
  // Override json method to capture response data
  res.json = function(body) {
    res.locals.responseBody = body;
    return originalJson.apply(this, arguments);
  };
  
  // Process request when finished
  onFinished(res, () => {
    // Calculate duration
    const endTime = process.hrtime(startTime);
    const durationMs = endTime[0] * 1000 + endTime[1] / 1000000;
    
    // Get route pattern if available
    const route = req.route?.path || req.path;
    
    // Record metrics
    metrics.recordResponseTime(req.method, route, durationMs);
    metrics.recordStatusCode(res.statusCode);
    
    // Log detailed API request for slow requests or errors
    if (durationMs > 1000 || res.statusCode >= 400) {
      const level = res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info');
      
      logger[level](`API ${req.method} ${req.originalUrl} ${res.statusCode}`, {
        method: req.method,
        url: req.originalUrl,
        route,
        params: req.params,
        query: req.query,
        statusCode: res.statusCode,
        durationMs,
        requestHeaders: sanitizeHeaders(req.headers),
        responseSize: res.locals.responseSize,
        userId: req.user?.id
      });
    }
  });
  
  next();
}

// Remove sensitive information from headers
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// Apply API insights middleware to app
// src/app.ts
import { apiInsights } from './middleware/apiInsights';

// Apply API insights middleware before routes
app.use(apiInsights);
```

## Testing Strategy

### Unit Tests

Create comprehensive unit tests for observability components:

```typescript
// src/tests/unit/utils/logger.test.ts
import logger, { setLogContext, clearLogContext } from '../../../utils/logger';
import winston from 'winston';

// Mock winston
jest.mock('winston', () => {
  const mLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  };
  
  return {
    createLogger: jest.fn(() => mLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
      colorize: jest.fn(),
      printf: jest.fn()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    config: {
      npm: {
        levels: {}
      }
    }
  };
});

describe('Logger', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  it('should log messages with context', () => {
    // Set log context
    setLogContext({ requestId: '123', userId: 'user-456' });
    
    // Log a message
    logger.info('Test message', { test: true });
    
    // Get winston logger instance
    const winstonLogger = (winston.createLogger as jest.Mock).mock.results[0].value;
    
    // Check that winston logger was called with context
    expect(winstonLogger.info).toHaveBeenCalledWith('Test message', {
      requestId: '123',
      userId: 'user-456',
      test: true
    });
    
    // Clear log context
    clearLogContext();
    
    // Log another message
    logger.info('Another message');
    
    // Check that context was cleared
    expect(winstonLogger.info).toHaveBeenCalledWith('Another message', {});
  });
  
  it('should log errors', () => {
    const error = new Error('Test error');
    
    logger.error('Error occurred', { error });
    
    // Get winston logger instance
    const winstonLogger = (winston.createLogger as jest.Mock).mock.results[0].value;
    
    // Check that winston logger was called with error
    expect(winstonLogger.error).toHaveBeenCalledWith('Error occurred', {
      error
    });
  });
});

// src/tests/unit/middleware/requestLogger.test.ts
import { requestLogger } from '../../../middleware/requestLogger';
import logger, { setLogContext, clearLogContext } from '../../../utils/logger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setLogContext: jest.fn(),
  clearLogContext: jest.fn()
}));

describe('Request Logger Middleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock request, response and next
    req = {
      method: 'GET',
      originalUrl: '/api/boards',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
      user: { id: 'user-123' },
      query: { test: true }
    };
    
    res = {
      setHeader: jest.fn(),
      on: jest.fn(),
      statusCode: 200
    };
    
    next = jest.fn();
  });
  
  it('should set request ID and log context', () => {
    // Call middleware
    requestLogger(req, res, next);
    
    // Check that request ID was set
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    
    // Check that log context was set
    expect(setLogContext).toHaveBeenCalledWith({
      requestId: expect.any(String),
      userId: 'user-123',
      method: 'GET',
      url: '/api/boards',
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    });
    
    // Check that request was logged
    expect(logger.info).toHaveBeenCalledWith('REQUEST GET /api/boards', {
      query: { test: true },
      body: undefined
    });
    
    // Check that next was called
    expect(next).toHaveBeenCalled();
  });
  
  it('should log response when finished', () => {
    // Call middleware
    requestLogger(req, res, next);
    
    // Get onFinished callback
    const onFinishedCallback = res.on.mock.calls[0][1];
    
    // Call onFinished callback
    onFinishedCallback(null, res);
    
    // Check that response was logged
    expect(logger.info).toHaveBeenCalledWith('RESPONSE GET /api/boards 200', expect.objectContaining({
      statusCode: 200,
      responseTime: expect.any(Number)
    }));
    
    // Check that log context was cleared
    expect(clearLogContext).toHaveBeenCalled();
  });
});
```

### Integration Tests

Create integration tests for observability endpoints:

```typescript
// src/tests/integration/routes/observabilityRoutes.test.ts
import request from 'supertest';
import app from '../../../app';

describe('Observability Routes', () => {
  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.services).toBeDefined();
      expect(response.body.data.details).toBeDefined();
    });
  });
  
  describe('Metrics Endpoint', () => {
    let token;
    
    beforeAll(async () => {
      // Get auth token for admin user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin-password'
        });
      
      token = loginResponse.body.data.token;
    });
    
    it('should return metrics for authenticated admin', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.process).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
    });
    
    it('should deny access to metrics for non-admin', async () => {
      // Get token for normal user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'user',
          password: 'user-password'
        });
      
      const userToken = loginResponse.body.data.token;
      
      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Prometheus Endpoint', () => {
    it('should return prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('text/plain');
      expect(response.text).toContain('http_request_duration_seconds');
    });
  });
});
```

### Performance Tests

Create performance tests to verify the overhead of observability features:

```typescript
// src/tests/performance/observability.test.ts
import request from 'supertest';
import app from '../../app';

describe('Observability Performance', () => {
  it('should have minimal overhead for logging', async () => {
    const iterations = 100;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime();
      
      await request(app)
        .get('/api/health');
      
      const end = process.hrtime(start);
      const duration = end[0] * 1000 + end[1] / 1000000; // Convert to ms
      
      results.push(duration);
    }
    
    // Calculate statistics
    const average = results.reduce((sum, duration) => sum + duration, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    
    console.log(`Observability Performance (${iterations} iterations):`);
    console.log(`- Average: ${average.toFixed(2)} ms`);
    console.log(`- Min: ${min.toFixed(2)} ms`);
    console.log(`- Max: ${max.toFixed(2)} ms`);
    
    // Ensure reasonable performance
    expect(average).toBeLessThan(100); // Adjust threshold as needed
  });
});
```

## Benefits and Impact

Implementing observability features provides several benefits:

1. **Improved Debugging**: Comprehensive logging and error tracking enable faster problem identification and resolution.

2. **Performance Insights**: Metrics and monitoring provide insights into application performance and bottlenecks.

3. **Proactive Problem Detection**: Health checks and metrics enable proactive detection of issues before they affect users.

4. **Better User Support**: Detailed request and error logging help support staff diagnose and fix user-reported issues.

5. **Operational Visibility**: Application metrics provide visibility into resource usage and operational patterns.

6. **Cross-Interface Consistency**: Observability is consistently implemented across MCP, REST API, and CLI interfaces.

## Conclusion

Observability is a critical aspect of any production application. By implementing comprehensive logging, monitoring, metrics, and tracing across all interfaces, we ensure that TaskBoardAI is maintainable, debuggable, and reliable. These features provide valuable insights into the application's behavior and performance, enabling proactive problem detection and faster issue resolution.