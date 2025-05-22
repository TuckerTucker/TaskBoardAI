import { Request, Response, NextFunction } from 'express';
import { healthChecker, metricsCollector, observableLogger } from '../core/utils/observability.js';
import { ServiceFactory } from '../cli/ServiceFactory.js';

export class HealthController {
  /**
   * Get comprehensive health status
   */
  static async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      observableLogger.setContext({
        requestId: req.headers['x-request-id'] as string,
        action: 'health-check',
        source: 'api'
      });

      observableLogger.info('Health check requested');

      // Run all health checks
      const healthResults = await healthChecker.runHealthChecks();
      
      // Get basic system metrics
      const systemMetrics = metricsCollector.getSystemMetrics();
      
      // Test database connectivity
      let databaseStatus = 'ok';
      try {
        const serviceFactory = ServiceFactory.getInstance();
        const boardRepository = serviceFactory.getBoardRepository();
        await boardRepository.getAllBoards();
      } catch (error) {
        databaseStatus = 'error';
        observableLogger.error('Database health check failed', { error });
      }

      const healthData = {
        status: healthResults.overall,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '0.0.0',
        services: {
          database: databaseStatus,
          ...healthResults.checks
        },
        system: systemMetrics,
        responseTime: metricsCollector.getResponseTimeStats(300000), // Last 5 minutes
        errors: metricsCollector.getErrorStats(300000) // Last 5 minutes
      };

      const statusCode = healthResults.overall === 'ok' ? 200 : 
                        healthResults.overall === 'warning' ? 200 : 503;

      observableLogger.info('Health check completed', { 
        status: healthResults.overall,
        statusCode 
      });

      res.status(statusCode).json({
        success: true,
        data: healthData
      });

      observableLogger.clearContext();
    } catch (error) {
      observableLogger.error('Health check failed', { error });
      next(error);
    }
  }

  /**
   * Get readiness probe (minimal check for container orchestration)
   */
  static async getReadiness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Simple readiness check - just verify the service can respond
      const isReady = process.uptime() > 5; // Service has been up for at least 5 seconds

      if (isReady) {
        res.status(200).json({
          success: true,
          data: {
            status: 'ready',
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(503).json({
          success: false,
          data: {
            status: 'not-ready',
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      observableLogger.error('Readiness check failed', { error });
      next(error);
    }
  }

  /**
   * Get liveness probe (basic check for container orchestration)
   */
  static async getLiveness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Basic liveness check - if we can respond, we're alive
      res.status(200).json({
        success: true,
        data: {
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }
      });
    } catch (error) {
      observableLogger.error('Liveness check failed', { error });
      next(error);
    }
  }
}