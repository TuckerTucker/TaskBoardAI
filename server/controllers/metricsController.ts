import { Request, Response, NextFunction } from 'express';
import { metricsCollector, observableLogger } from '../core/utils/observability.js';

export class MetricsController {
  /**
   * Get comprehensive application metrics
   */
  static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      observableLogger.setContext({
        requestId: req.headers['x-request-id'] as string,
        userId: req.user?.id,
        action: 'get-metrics',
        source: 'api'
      });

      observableLogger.info('Metrics requested');

      const metrics = metricsCollector.getAllMetrics();

      res.status(200).json({
        success: true,
        data: metrics
      });

      observableLogger.clearContext();
    } catch (error) {
      observableLogger.error('Failed to get metrics', { error });
      next(error);
    }
  }

  /**
   * Get response time metrics by route
   */
  static async getResponseTimesByRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      observableLogger.setContext({
        requestId: req.headers['x-request-id'] as string,
        userId: req.user?.id,
        action: 'get-response-times',
        source: 'api'
      });

      const timeWindow = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour
      const responseTimeStats = metricsCollector.getResponseTimeStats(timeWindow);

      res.status(200).json({
        success: true,
        data: {
          timeWindow,
          stats: responseTimeStats
        }
      });

      observableLogger.clearContext();
    } catch (error) {
      observableLogger.error('Failed to get response times', { error });
      next(error);
    }
  }

  /**
   * Get error metrics
   */
  static async getErrorMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      observableLogger.setContext({
        requestId: req.headers['x-request-id'] as string,
        userId: req.user?.id,
        action: 'get-error-metrics',
        source: 'api'
      });

      const timeWindow = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour
      const errorStats = metricsCollector.getErrorStats(timeWindow);

      res.status(200).json({
        success: true,
        data: {
          timeWindow,
          stats: errorStats
        }
      });

      observableLogger.clearContext();
    } catch (error) {
      observableLogger.error('Failed to get error metrics', { error });
      next(error);
    }
  }

  /**
   * Get system metrics
   */
  static async getSystemMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      observableLogger.setContext({
        requestId: req.headers['x-request-id'] as string,
        userId: req.user?.id,
        action: 'get-system-metrics',
        source: 'api'
      });

      const systemMetrics = metricsCollector.getSystemMetrics();

      res.status(200).json({
        success: true,
        data: systemMetrics
      });

      observableLogger.clearContext();
    } catch (error) {
      observableLogger.error('Failed to get system metrics', { error });
      next(error);
    }
  }
}