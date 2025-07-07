import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Logger, LogLevel } from './logger.js';
import { ErrorTracker } from './errorTracking.js';
import { AlertManager } from './alerting.js';

// Enhanced logging context interface
export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  action?: string;
  resource?: string;
  source?: 'api' | 'mcp' | 'cli';
  traceId?: string;
  [key: string]: any;
}

// Metrics collection interface
export interface MetricEvent {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface ResponseTimeMetric {
  method: string;
  route: string;
  durationMs: number;
  timestamp: number;
  statusCode?: number;
}

export interface ErrorMetric {
  type: string;
  message: string;
  stack?: string;
  context?: LogContext;
  timestamp: number;
}

// Observable logger that extends the base logger
export class ObservableLogger extends Logger {
  private static instance: ObservableLogger;
  private logDir: string;
  private context: LogContext = {};
  private metricsCollector: MetricsCollector;
  private errorTracker: ErrorTracker;
  private alertManager: AlertManager;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    super(logLevel);
    this.logDir = path.join(process.cwd(), 'logs');
    this.metricsCollector = MetricsCollector.getInstance();
    this.errorTracker = ErrorTracker.getInstance();
    this.alertManager = AlertManager.getInstance();
    this.initializeLogDirectory();
  }

  static getInstance(): ObservableLogger {
    if (!ObservableLogger.instance) {
      ObservableLogger.instance = new ObservableLogger();
    }
    return ObservableLogger.instance;
  }

  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  // Set context for subsequent log entries
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  // Clear the current context
  clearContext(): void {
    this.context = {};
  }

  // Get current context
  getContext(): LogContext {
    return { ...this.context };
  }

  // Enhanced logging methods that include observability features
  info(message: string, meta: Record<string, any> = {}): void {
    const enrichedMeta = this.enrichMetadata(meta);
    super.info(message, enrichedMeta);
    this.writeToFile('info', message, enrichedMeta);
  }

  warn(message: string, meta: Record<string, any> = {}): void {
    const enrichedMeta = this.enrichMetadata(meta);
    super.warn(message, enrichedMeta);
    this.writeToFile('warn', message, enrichedMeta);
    
    // Track warnings for error analysis
    this.errorTracker.trackError(
      message,
      enrichedMeta.error,
      enrichedMeta,
      this.context.source,
      'warn'
    );
  }

  error(message: string, meta: Record<string, any> = {}): void {
    const enrichedMeta = this.enrichMetadata(meta);
    super.error(message, enrichedMeta);
    this.writeToFile('error', message, enrichedMeta);
    
    // Track error for analysis and alerting
    this.errorTracker.trackError(
      message,
      enrichedMeta.error,
      enrichedMeta,
      this.context.source,
      'error'
    );
    
    // Track error metrics
    if (enrichedMeta.error) {
      this.metricsCollector.recordError({
        type: enrichedMeta.error.name || 'Error',
        message: enrichedMeta.error.message || message,
        stack: enrichedMeta.error.stack,
        context: this.context,
        timestamp: Date.now()
      });
    }
  }

  debug(message: string, meta: Record<string, any> = {}): void {
    const enrichedMeta = this.enrichMetadata(meta);
    super.debug(message, enrichedMeta);
    this.writeToFile('debug', message, enrichedMeta);
  }

  // Specialized logging methods for observability
  logRequest(method: string, url: string, meta: Record<string, any> = {}): void {
    this.info(`REQUEST ${method} ${url}`, {
      ...meta,
      type: 'request',
      method,
      url
    });
  }

  logResponse(method: string, url: string, statusCode: number, durationMs: number, meta: Record<string, any> = {}): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this[level](`RESPONSE ${method} ${url} ${statusCode}`, {
      ...meta,
      type: 'response',
      method,
      url,
      statusCode,
      durationMs
    });

    // Record response time metric
    this.metricsCollector.recordResponseTime({
      method,
      route: url,
      durationMs,
      statusCode,
      timestamp: Date.now()
    });
  }

  logOperation(operation: string, resource: string, result: 'success' | 'failure', meta: Record<string, any> = {}): void {
    const level = result === 'success' ? 'info' : 'error';
    this[level](`OPERATION ${operation} ${resource} ${result.toUpperCase()}`, {
      ...meta,
      type: 'operation',
      operation,
      resource,
      result
    });
  }

  private enrichMetadata(meta: Record<string, any>): Record<string, any> {
    return {
      ...this.context,
      ...meta,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      hostname: os.hostname()
    };
  }

  private async writeToFile(level: string, message: string, meta: Record<string, any>): Promise<void> {
    try {
      const logEntry = {
        level,
        message,
        meta,
        timestamp: new Date().toISOString()
      };

      const fileName = level === 'error' ? 'error.log' : 'application.log';
      const filePath = path.join(this.logDir, fileName);
      
      await fs.appendFile(filePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      // Fail silently to avoid logging loops
      console.error('Failed to write to log file:', error);
    }
  }
}

// Metrics collector for performance and operational metrics
export class MetricsCollector {
  private static instance: MetricsCollector;
  private responseTimeMetrics: ResponseTimeMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private customMetrics: MetricEvent[] = [];
  private readonly MAX_STORED_METRICS = 10000;

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  recordResponseTime(metric: ResponseTimeMetric): void {
    this.responseTimeMetrics.push(metric);
    this.trimMetrics(this.responseTimeMetrics);
  }

  recordError(metric: ErrorMetric): void {
    this.errorMetrics.push(metric);
    this.trimMetrics(this.errorMetrics);
  }

  recordCustomMetric(metric: MetricEvent): void {
    this.customMetrics.push(metric);
    this.trimMetrics(this.customMetrics);
  }

  getResponseTimeStats(timeWindow: number = 3600000): any {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.responseTimeMetrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return { count: 0, mean: 0, p95: 0, p99: 0, max: 0 };
    }

    const durations = recentMetrics.map(m => m.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    const mean = durations.reduce((sum, d) => sum + d, 0) / count;
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      count,
      mean: Math.round(mean * 100) / 100,
      p95: durations[p95Index] || 0,
      p99: durations[p99Index] || 0,
      max: durations[count - 1] || 0
    };
  }

  getErrorStats(timeWindow: number = 3600000): any {
    const cutoff = Date.now() - timeWindow;
    const recentErrors = this.errorMetrics.filter(m => m.timestamp > cutoff);

    const errorsByType = recentErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalErrors: recentErrors.length,
      errorsByType,
      recentErrors: recentErrors.slice(-10) // Last 10 errors
    };
  }

  getSystemMetrics(): any {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        uptime: os.uptime()
      }
    };
  }

  getAllMetrics(): any {
    return {
      responseTime: this.getResponseTimeStats(),
      errors: this.getErrorStats(),
      system: this.getSystemMetrics(),
      timestamp: Date.now()
    };
  }

  private trimMetrics(metrics: any[]): void {
    if (metrics.length > this.MAX_STORED_METRICS) {
      metrics.splice(0, metrics.length - this.MAX_STORED_METRICS);
    }
  }
}

// Performance tracker for measuring operation performance
export class PerformanceTracker {
  private static instance: PerformanceTracker;
  private activeOperations: Map<string, { startTime: number, context: LogContext }> = new Map();
  private logger: ObservableLogger;
  private metricsCollector: MetricsCollector;

  constructor() {
    this.logger = ObservableLogger.getInstance();
    this.metricsCollector = MetricsCollector.getInstance();
  }

  static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  startOperation(operationId: string, operation: string, context: LogContext = {}): void {
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      context: { ...context, operation }
    });

    this.logger.debug(`Operation started: ${operation}`, { operationId, ...context });
  }

  endOperation(operationId: string, success: boolean = true, result?: any): number | null {
    const operationData = this.activeOperations.get(operationId);
    
    if (!operationData) {
      this.logger.warn(`Operation not found: ${operationId}`);
      return null;
    }

    const duration = Date.now() - operationData.startTime;
    this.activeOperations.delete(operationId);

    const level = success ? 'info' : 'error';
    this.logger[level](`Operation completed: ${operationData.context.operation}`, {
      operationId,
      duration,
      success,
      result: success ? 'completed' : 'failed',
      ...operationData.context
    });

    // Record custom metric for operation duration
    this.metricsCollector.recordCustomMetric({
      name: 'operation_duration',
      value: duration,
      labels: {
        operation: operationData.context.operation as string,
        success: success.toString()
      },
      timestamp: Date.now()
    });

    return duration;
  }

  // Convenience method to wrap async operations
  async measureAsync<T>(
    operationId: string,
    operation: string,
    fn: () => Promise<T>,
    context: LogContext = {}
  ): Promise<T> {
    this.startOperation(operationId, operation, context);
    
    try {
      const result = await fn();
      this.endOperation(operationId, true, result);
      return result;
    } catch (error) {
      this.endOperation(operationId, false, error);
      throw error;
    }
  }

  // Convenience method to wrap sync operations
  measure<T>(
    operationId: string,
    operation: string,
    fn: () => T,
    context: LogContext = {}
  ): T {
    this.startOperation(operationId, operation, context);
    
    try {
      const result = fn();
      this.endOperation(operationId, true, result);
      return result;
    } catch (error) {
      this.endOperation(operationId, false, error);
      throw error;
    }
  }
}

// Health checker for monitoring application health
export class HealthChecker {
  private static instance: HealthChecker;
  private checks: Map<string, () => Promise<{ status: 'ok' | 'error' | 'warning', details?: any }>> = new Map();
  private logger: ObservableLogger;

  constructor() {
    this.logger = ObservableLogger.getInstance();
    this.registerDefaultChecks();
  }

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  registerCheck(name: string, checkFn: () => Promise<{ status: 'ok' | 'error' | 'warning', details?: any }>): void {
    this.checks.set(name, checkFn);
  }

  async runHealthChecks(): Promise<{ overall: 'ok' | 'error' | 'warning', checks: Record<string, any> }> {
    const results: Record<string, any> = {};
    let overallStatus: 'ok' | 'error' | 'warning' = 'ok';

    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        results[name] = result;

        if (result.status === 'error') {
          overallStatus = 'error';
        } else if (result.status === 'warning' && overallStatus === 'ok') {
          overallStatus = 'warning';
        }
      } catch (error) {
        results[name] = { status: 'error', details: { error: error.message } };
        overallStatus = 'error';
        this.logger.error(`Health check failed: ${name}`, { error });
      }
    }

    this.logger.info('Health checks completed', { overallStatus, checks: Object.keys(results) });

    return { overall: overallStatus, checks: results };
  }

  private registerDefaultChecks(): void {
    // Memory check
    this.registerCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const memoryThreshold = 1024 * 1024 * 1024; // 1GB
      
      if (memoryUsage.heapUsed > memoryThreshold) {
        return { status: 'warning', details: { heapUsed: memoryUsage.heapUsed, threshold: memoryThreshold } };
      }
      
      return { status: 'ok', details: { heapUsed: memoryUsage.heapUsed } };
    });

    // File system check
    this.registerCheck('filesystem', async () => {
      try {
        const testPath = path.join(process.cwd(), 'logs', 'health-test.tmp');
        await fs.writeFile(testPath, 'health check');
        await fs.unlink(testPath);
        return { status: 'ok' };
      } catch (error) {
        return { status: 'error', details: { error: error.message } };
      }
    });

    // Process uptime check
    this.registerCheck('uptime', async () => {
      const uptime = process.uptime();
      return { status: 'ok', details: { uptime } };
    });
  }
}

// Export singleton instances for easy access
export const observableLogger = ObservableLogger.getInstance();
export const metricsCollector = MetricsCollector.getInstance();
export const performanceTracker = PerformanceTracker.getInstance();
export const healthChecker = HealthChecker.getInstance();