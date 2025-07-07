import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { ServiceFactory } from '../cli/ServiceFactory.js';
import { requirePermission } from '../core/utils/auth.js';

const router = Router();
const serviceFactory = ServiceFactory.getInstance();
const authService = serviceFactory.getAuthService();

// Public routes (no authentication required)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/validate', AuthController.validateToken);

// Protected routes (authentication required)
router.get('/me', authenticate(authService), AuthController.getCurrentUser);
router.post('/refresh', authenticate(authService), AuthController.refreshToken);
router.post('/logout', optionalAuthenticate(authService), AuthController.logout);
router.post('/api-key', authenticate(authService), AuthController.generateApiKey);
router.get('/permissions', authenticate(authService), AuthController.getUserPermissions);

export default router;