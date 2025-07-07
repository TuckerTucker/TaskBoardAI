import { Request, Response, NextFunction } from 'express';
import { IConfigService, IValidationService } from '@core/services';
import { ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class ConfigController {
  private logger = logger.child({ component: 'ConfigController' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private configService: IConfigService,
    private validationService: IValidationService
  ) {}

  // GET /api/config
  getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Getting configuration');

      const config = await this.errorRecovery.safeFileOperation(
        () => this.configService.getDefault(),
        'get config'
      );

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/config
  updateConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Updating configuration', { body: req.body });

      const config = await this.errorRecovery.safeFileOperation(
        () => this.configService.update('default', req.body),
        'update config'
      );

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/config/server
  updateServerConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Updating server configuration', { body: req.body });

      const config = await this.errorRecovery.safeFileOperation(
        () => this.configService.updateServerConfig(req.body),
        'update server config'
      );

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/config/defaults
  updateDefaultsConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Updating defaults configuration', { body: req.body });

      const config = await this.errorRecovery.safeFileOperation(
        () => this.configService.updateDefaultsConfig(req.body),
        'update defaults config'
      );

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/config/reset
  resetConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Resetting configuration to defaults');

      const config = await this.errorRecovery.safeFileOperation(
        () => this.configService.reset(),
        'reset config'
      );

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}