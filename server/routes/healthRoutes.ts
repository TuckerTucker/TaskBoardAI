import { Router } from 'express';
import { HealthController } from '../controllers/healthController.js';

const router = Router();

// Public health check endpoints (no authentication required for monitoring)
router.get('/', HealthController.getHealth);
router.get('/ready', HealthController.getReadiness);
router.get('/live', HealthController.getLiveness);

export default router;