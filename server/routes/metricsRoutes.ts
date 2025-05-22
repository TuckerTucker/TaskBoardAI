import { Router } from 'express';
import { MetricsController } from '../controllers/metricsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../core/utils/auth.js';
import { ServiceFactory } from '../cli/ServiceFactory.js';

const router = Router();
const serviceFactory = ServiceFactory.getInstance();
const authService = serviceFactory.getAuthService();

// Protected routes - require admin permissions for security
router.get('/', 
  authenticate(authService), 
  requirePermission('config', 'admin'), 
  MetricsController.getMetrics
);

router.get('/response-times', 
  authenticate(authService), 
  requirePermission('config', 'admin'), 
  MetricsController.getResponseTimesByRoute
);

router.get('/errors', 
  authenticate(authService), 
  requirePermission('config', 'admin'), 
  MetricsController.getErrorMetrics
);

router.get('/system', 
  authenticate(authService), 
  requirePermission('config', 'admin'), 
  MetricsController.getSystemMetrics
);

export default router;