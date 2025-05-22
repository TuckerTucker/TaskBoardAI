import { ObservableLogger } from './observability.js';
import fs from 'fs/promises';
import path from 'path';

export interface ErrorEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warn';
  message: string;
  error?: string;
  stack?: string;
  context?: Record<string, any>;
  source: 'api' | 'mcp' | 'cli' | 'system';
  userId?: string;
  requestId?: string;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  tags?: string[];
}

export interface ErrorPattern {
  pattern: string | RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  suggestedAction?: string;
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySource: Record<string, number>;
  errorsByTime: Record<string, number>;
  topErrors: Array<{ message: string; count: number; lastSeen: string }>;
  criticalErrors: ErrorEvent[];
  trendData: {
    hourly: number[];
    daily: number[];
  };
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private observableLogger: ObservableLogger;
  private errorPatterns: ErrorPattern[] = [];
  private recentErrors: ErrorEvent[] = [];
  private maxRecentErrors = 1000;
  private errorStorage: string;

  private constructor() {
    this.observableLogger = ObservableLogger.getInstance();
    this.errorStorage = path.join(process.cwd(), 'logs', 'errors');
    this.initializeErrorPatterns();
    this.ensureErrorStorageExists();
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  private async ensureErrorStorageExists(): Promise<void> {
    try {
      await fs.mkdir(this.errorStorage, { recursive: true });
    } catch (error) {
      console.error('Failed to create error storage directory:', error);
    }
  }

  private initializeErrorPatterns(): void {
    this.errorPatterns = [
      {
        pattern: /ENOENT.*no such file or directory/i,
        severity: 'medium',
        category: 'File System',
        description: 'File or directory not found',
        suggestedAction: 'Check file paths and ensure required files exist'
      },
      {
        pattern: /EACCES.*permission denied/i,
        severity: 'high',
        category: 'Permissions',
        description: 'Permission denied error',
        suggestedAction: 'Check file/directory permissions and user access rights'
      },
      {
        pattern: /EMFILE.*too many open files/i,
        severity: 'critical',
        category: 'Resource Limits',
        description: 'Too many open file descriptors',
        suggestedAction: 'Increase system file descriptor limits or fix resource leaks'
      },
      {
        pattern: /out of memory|heap out of memory/i,
        severity: 'critical',
        category: 'Memory',
        description: 'Out of memory error',
        suggestedAction: 'Increase available memory or optimize memory usage'
      },
      {
        pattern: /timeout|timed out/i,
        severity: 'medium',
        category: 'Performance',
        description: 'Operation timeout',
        suggestedAction: 'Check network connectivity or increase timeout values'
      },
      {
        pattern: /unauthorized|authentication failed/i,
        severity: 'high',
        category: 'Security',
        description: 'Authentication or authorization failure',
        suggestedAction: 'Verify credentials and access permissions'
      },
      {
        pattern: /validation.*failed|invalid.*format/i,
        severity: 'medium',
        category: 'Validation',
        description: 'Data validation failure',
        suggestedAction: 'Check input data format and validation rules'
      },
      {
        pattern: /database.*error|connection.*refused/i,
        severity: 'high',
        category: 'Database',
        description: 'Database connectivity or operation error',
        suggestedAction: 'Check database connection and query syntax'
      }
    ];
  }

  async trackError(
    message: string,
    error?: Error | string,
    context?: Record<string, any>,
    source: ErrorEvent['source'] = 'system',
    level: ErrorEvent['level'] = 'error'
  ): Promise<string> {
    const errorEvent: ErrorEvent = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      source,
      userId: context?.userId,
      requestId: context?.requestId,
      resolved: false,
      tags: this.extractTags(message, error)
    };

    // Add to recent errors
    this.recentErrors.unshift(errorEvent);
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
    }

    // Persist error to storage
    await this.persistError(errorEvent);

    // Log through observable logger
    this.observableLogger.error(message, {
      errorId: errorEvent.id,
      error: errorEvent.error,
      source: errorEvent.source,
      context: errorEvent.context,
      tags: errorEvent.tags
    });

    // Check for critical patterns and alert if necessary
    await this.checkForCriticalPatterns(errorEvent);

    return errorEvent.id;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractTags(message: string, error?: Error | string): string[] {
    const tags: string[] = [];
    const errorText = `${message} ${error instanceof Error ? error.message : error || ''}`.toLowerCase();

    for (const pattern of this.errorPatterns) {
      if (pattern.pattern instanceof RegExp) {
        if (pattern.pattern.test(errorText)) {
          tags.push(pattern.category);
        }
      } else if (typeof pattern.pattern === 'string') {
        if (errorText.includes(pattern.pattern.toLowerCase())) {
          tags.push(pattern.category);
        }
      }
    }

    return [...new Set(tags)];
  }

  private async persistError(errorEvent: ErrorEvent): Promise<void> {
    try {
      const date = new Date(errorEvent.timestamp);
      const fileName = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`;
      const filePath = path.join(this.errorStorage, fileName);

      let existingErrors: ErrorEvent[] = [];
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        existingErrors = JSON.parse(content);
      } catch {
        // File doesn't exist yet, start with empty array
      }

      existingErrors.push(errorEvent);
      await fs.writeFile(filePath, JSON.stringify(existingErrors, null, 2));
    } catch (persistError) {
      console.error('Failed to persist error event:', persistError);
    }
  }

  private async checkForCriticalPatterns(errorEvent: ErrorEvent): Promise<void> {
    const criticalPatterns = this.errorPatterns.filter(p => p.severity === 'critical');
    const errorText = `${errorEvent.message} ${errorEvent.error || ''}`;

    for (const pattern of criticalPatterns) {
      let matches = false;
      if (pattern.pattern instanceof RegExp) {
        matches = pattern.pattern.test(errorText);
      } else {
        matches = errorText.toLowerCase().includes(pattern.pattern.toLowerCase());
      }

      if (matches) {
        await this.alertCriticalError(errorEvent, pattern);
        break;
      }
    }
  }

  private async alertCriticalError(errorEvent: ErrorEvent, pattern: ErrorPattern): Promise<void> {
    this.observableLogger.error('CRITICAL ERROR DETECTED', {
      errorId: errorEvent.id,
      pattern: pattern.description,
      severity: pattern.severity,
      suggestedAction: pattern.suggestedAction,
      errorEvent
    });

    // In a production environment, this would trigger external alerting
    // such as sending to Slack, PagerDuty, email, etc.
    console.error(`🚨 CRITICAL ERROR: ${pattern.description}`);
    console.error(`   Error ID: ${errorEvent.id}`);
    console.error(`   Message: ${errorEvent.message}`);
    if (pattern.suggestedAction) {
      console.error(`   Suggested Action: ${pattern.suggestedAction}`);
    }
  }

  async getErrorSummary(timeRange?: { start: Date; end: Date }): Promise<ErrorSummary> {
    const errors = await this.getErrorsInRange(timeRange);

    const errorsByCategory: Record<string, number> = {};
    const errorsBySource: Record<string, number> = {};
    const errorsByTime: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    const now = new Date();
    const hourlyBuckets = Array(24).fill(0);
    const dailyBuckets = Array(7).fill(0);

    errors.forEach(error => {
      // Count by category
      if (error.tags) {
        error.tags.forEach(tag => {
          errorsByCategory[tag] = (errorsByCategory[tag] || 0) + 1;
        });
      }

      // Count by source
      errorsBySource[error.source] = (errorsBySource[error.source] || 0) + 1;

      // Count by hour for trending
      const errorTime = new Date(error.timestamp);
      const hoursDiff = Math.floor((now.getTime() - errorTime.getTime()) / (1000 * 60 * 60));
      if (hoursDiff < 24) {
        hourlyBuckets[23 - hoursDiff]++;
      }

      const daysDiff = Math.floor((now.getTime() - errorTime.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 7) {
        dailyBuckets[6 - daysDiff]++;
      }

      // Count by time bucket (hour)
      const timeKey = errorTime.toISOString().substr(0, 13); // YYYY-MM-DDTHH
      errorsByTime[timeKey] = (errorsByTime[timeKey] || 0) + 1;

      // Count by error message
      const errorKey = error.message.substr(0, 100); // First 100 chars
      errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => {
        const lastError = errors.find(e => e.message.startsWith(message));
        return {
          message,
          count,
          lastSeen: lastError?.timestamp || ''
        };
      });

    const criticalErrors = errors.filter(error => 
      error.level === 'error' && 
      error.tags?.some(tag => 
        this.errorPatterns.find(p => p.category === tag && p.severity === 'critical')
      )
    ).slice(0, 10);

    return {
      totalErrors: errors.length,
      errorsByCategory,
      errorsBySource,
      errorsByTime,
      topErrors,
      criticalErrors,
      trendData: {
        hourly: hourlyBuckets,
        daily: dailyBuckets
      }
    };
  }

  private async getErrorsInRange(timeRange?: { start: Date; end: Date }): Promise<ErrorEvent[]> {
    const start = timeRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
    const end = timeRange?.end || new Date();

    const errors: ErrorEvent[] = [];
    
    // Get errors from storage files
    try {
      const files = await fs.readdir(this.errorStorage);
      const dateFiles = files.filter(file => file.match(/^\d{4}-\d{2}-\d{2}\.json$/));

      for (const file of dateFiles) {
        const fileDate = new Date(file.replace('.json', ''));
        if (fileDate >= start && fileDate <= end) {
          try {
            const content = await fs.readFile(path.join(this.errorStorage, file), 'utf-8');
            const fileErrors: ErrorEvent[] = JSON.parse(content);
            errors.push(...fileErrors.filter(error => {
              const errorDate = new Date(error.timestamp);
              return errorDate >= start && errorDate <= end;
            }));
          } catch (fileError) {
            console.error(`Failed to read error file ${file}:`, fileError);
          }
        }
      }
    } catch (readError) {
      console.error('Failed to read error storage directory:', readError);
    }

    // Also include recent errors from memory
    const recentInRange = this.recentErrors.filter(error => {
      const errorDate = new Date(error.timestamp);
      return errorDate >= start && errorDate <= end;
    });

    // Merge and deduplicate
    const allErrors = [...errors, ...recentInRange];
    const uniqueErrors = allErrors.filter((error, index, array) => 
      array.findIndex(e => e.id === error.id) === index
    );

    return uniqueErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async resolveError(errorId: string, resolvedBy: string, notes?: string): Promise<boolean> {
    try {
      // Update in recent errors
      const recentError = this.recentErrors.find(e => e.id === errorId);
      if (recentError) {
        recentError.resolved = true;
        recentError.resolvedBy = resolvedBy;
        recentError.resolvedAt = new Date().toISOString();
      }

      // Update in storage files
      const files = await fs.readdir(this.errorStorage);
      for (const file of files) {
        if (file.match(/^\d{4}-\d{2}-\d{2}\.json$/)) {
          try {
            const filePath = path.join(this.errorStorage, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const errors: ErrorEvent[] = JSON.parse(content);
            
            const errorIndex = errors.findIndex(e => e.id === errorId);
            if (errorIndex !== -1) {
              errors[errorIndex].resolved = true;
              errors[errorIndex].resolvedBy = resolvedBy;
              errors[errorIndex].resolvedAt = new Date().toISOString();
              
              await fs.writeFile(filePath, JSON.stringify(errors, null, 2));
              
              this.observableLogger.info('Error resolved', {
                errorId,
                resolvedBy,
                notes
              });
              
              return true;
            }
          } catch (fileError) {
            console.error(`Failed to update error file ${file}:`, fileError);
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to resolve error:', error);
      return false;
    }
  }

  getRecentErrors(limit = 50): ErrorEvent[] {
    return this.recentErrors.slice(0, limit);
  }

  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
    this.observableLogger.info('Error pattern added', { pattern });
  }

  getErrorPatterns(): ErrorPattern[] {
    return [...this.errorPatterns];
  }

  async clearOldErrors(daysToKeep = 30): Promise<number> {
    let deletedCount = 0;
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    try {
      const files = await fs.readdir(this.errorStorage);
      
      for (const file of files) {
        if (file.match(/^\d{4}-\d{2}-\d{2}\.json$/)) {
          const fileDate = new Date(file.replace('.json', ''));
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.errorStorage, file));
            deletedCount++;
          }
        }
      }

      this.observableLogger.info('Old error files cleaned up', { 
        deletedFiles: deletedCount,
        daysToKeep,
        cutoffDate: cutoffDate.toISOString()
      });
    } catch (error) {
      this.observableLogger.error('Failed to clean up old error files', { error });
    }

    return deletedCount;
  }
}