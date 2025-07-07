import { logger } from '@core/utils';

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class RetryHandler {
  private logger = logger.child({ component: 'RetryHandler' });

  async retry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const config: RetryOptions = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'],
      ...options
    };

    let lastError: Error;
    let delay = config.initialDelay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          this.logger.info('Operation succeeded after retry', { 
            attempt, 
            totalAttempts: config.maxAttempts 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        this.logger.warn('Operation failed', {
          attempt,
          totalAttempts: config.maxAttempts,
          error: lastError.message,
          willRetry: attempt < config.maxAttempts && this.isRetryable(lastError, config.retryableErrors!)
        });

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === config.maxAttempts || !this.isRetryable(lastError, config.retryableErrors!)) {
          break;
        }

        // Wait before next attempt
        await this.delay(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }

    this.logger.error('Operation failed after all retry attempts', {
      totalAttempts: config.maxAttempts,
      finalError: lastError.message
    });

    throw lastError;
  }

  private isRetryable(error: Error, retryableErrors: string[]): boolean {
    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || 
      (error as any).code === retryableError
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class CircuitBreaker {
  private logger = logger.child({ component: 'CircuitBreaker' });
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldTryRecovery()) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.info('Circuit breaker transitioning to half-open', { name: this.name });
      } else {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.failureThreshold) {
        this.reset();
        this.logger.info('Circuit breaker closed after successful recovery', { name: this.name });
      }
    } else {
      this.reset();
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn('Circuit breaker opened during half-open state', { name: this.name });
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.warn('Circuit breaker opened due to failure threshold', {
        name: this.name,
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold
      });
    }
  }

  private shouldTryRecovery(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.recoveryTimeout;
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

export class ErrorRecoveryService {
  private logger = logger.child({ component: 'ErrorRecoveryService' });
  private retryHandler = new RetryHandler();
  private circuitBreakers = new Map<string, CircuitBreaker>();

  createCircuitBreaker(name: string, options: CircuitBreakerOptions): CircuitBreaker {
    const breaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, breaker);
    this.logger.info('Circuit breaker created', { name, options });
    return breaker;
  }

  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  async executeWithRetryAndCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerName: string,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(circuitBreakerName);
    
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker '${circuitBreakerName}' not found`);
    }

    return await circuitBreaker.execute(async () => {
      return await this.retryHandler.retry(operation, retryOptions);
    });
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryOptions?: Partial<RetryOptions>
  ): Promise<T> {
    return await this.retryHandler.retry(operation, retryOptions);
  }

  getCircuitBreakerMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    this.circuitBreakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });

    return metrics;
  }

  // Utility method for file operations that might fail
  async safeFileOperation<T>(
    operation: () => Promise<T>,
    operationName: string = 'file operation'
  ): Promise<T> {
    return await this.executeWithRetry(operation, {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      retryableErrors: ['ENOENT', 'EACCES', 'EMFILE', 'ENFILE', 'EBUSY']
    });
  }

  // Utility method for network operations
  async safeNetworkOperation<T>(
    operation: () => Promise<T>,
    circuitBreakerName: string = 'network'
  ): Promise<T> {
    // Create circuit breaker if it doesn't exist
    if (!this.circuitBreakers.has(circuitBreakerName)) {
      this.createCircuitBreaker(circuitBreakerName, {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 10000  // 10 seconds
      });
    }

    return await this.executeWithRetryAndCircuitBreaker(
      operation,
      circuitBreakerName,
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']
      }
    );
  }

  // Health check for all circuit breakers
  getHealthStatus(): {
    healthy: boolean;
    circuitBreakers: Record<string, { state: string; healthy: boolean }>;
  } {
    const circuitBreakers: Record<string, { state: string; healthy: boolean }> = {};
    let overallHealthy = true;

    this.circuitBreakers.forEach((breaker, name) => {
      const state = breaker.getState();
      const healthy = state !== CircuitState.OPEN;
      
      circuitBreakers[name] = {
        state,
        healthy
      };

      if (!healthy) {
        overallHealthy = false;
      }
    });

    return {
      healthy: overallHealthy,
      circuitBreakers
    };
  }
}