import { Router } from 'express';
import { ConfigController } from '../controllers/ConfigController';
import { IConfigService, IValidationService } from '@core/services';
import { logValidation } from '../middleware/validation';

export function createConfigRoutes(
  configService: IConfigService, 
  validationService: IValidationService
): Router {
  const router = Router();
  const configController = new ConfigController(configService, validationService);

  // Apply logging to all routes
  router.use(logValidation);

  // GET /api/config - Get current configuration
  router.get('/', 
    configController.getConfig
  );

  // PUT /api/config - Update full configuration
  router.put('/', 
    configController.updateConfig
  );

  // PUT /api/config/server - Update server configuration
  router.put('/server', 
    configController.updateServerConfig
  );

  // PUT /api/config/defaults - Update defaults configuration
  router.put('/defaults', 
    configController.updateDefaultsConfig
  );

  // POST /api/config/reset - Reset configuration to defaults
  router.post('/reset', 
    configController.resetConfig
  );

  return router;
}