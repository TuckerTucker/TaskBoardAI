import { Router } from 'express';
import { IBoardService, IConfigService, IValidationService } from '@core/services';
import { createBoardRoutes } from './boardRoutes';
import { createCardRoutes } from './cardRoutes';
import { createColumnRoutes } from './columnRoutes';
import { createConfigRoutes } from './configRoutes';

export function createApiRoutes(
  boardService: IBoardService,
  configService: IConfigService,
  validationService: IValidationService
): Router {
  const router = Router();

  // Mount route handlers
  router.use('/boards', createBoardRoutes(boardService, validationService));
  router.use('/config', createConfigRoutes(configService, validationService));
  
  // Nested routes for cards and columns under boards
  const boardRouter = Router({ mergeParams: true });
  boardRouter.use('/cards', createCardRoutes(boardService, validationService));
  boardRouter.use('/columns', createColumnRoutes(boardService, validationService));
  
  // Mount nested routes
  router.use('/boards/:boardId', boardRouter);

  return router;
}