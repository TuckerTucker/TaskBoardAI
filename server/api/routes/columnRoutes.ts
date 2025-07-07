import { Router } from 'express';
import { ColumnController } from '../controllers/ColumnController';
import { IBoardService, IValidationService } from '@core/services';
import { 
  validateColumnRouteParams,
  validateUUIDParam,
  logValidation
} from '../middleware/validation';

export function createColumnRoutes(
  boardService: IBoardService, 
  validationService: IValidationService
): Router {
  const router = Router({ mergeParams: true }); // Inherit params from parent router
  const columnController = new ColumnController(boardService, validationService);

  // Apply logging to all routes
  router.use(logValidation);

  // POST /api/boards/:boardId/columns - Create a new column
  router.post('/', 
    validateUUIDParam('boardId'),
    columnController.createColumn
  );

  // POST /api/boards/:boardId/columns/reorder - Reorder columns
  router.post('/reorder', 
    validateUUIDParam('boardId'),
    columnController.reorderColumns
  );

  // GET /api/boards/:boardId/columns/:columnId - Get a specific column
  router.get('/:columnId', 
    validateUUIDParam('boardId'),
    validateUUIDParam('columnId'),
    columnController.getColumn
  );

  // PUT /api/boards/:boardId/columns/:columnId - Update a column
  router.put('/:columnId', 
    validateUUIDParam('boardId'),
    validateUUIDParam('columnId'),
    columnController.updateColumn
  );

  // DELETE /api/boards/:boardId/columns/:columnId - Delete a column
  router.delete('/:columnId', 
    validateUUIDParam('boardId'),
    validateUUIDParam('columnId'),
    columnController.deleteColumn
  );

  // GET /api/boards/:boardId/columns/:columnId/cards - Get cards in a column
  router.get('/:columnId/cards', 
    validateUUIDParam('boardId'),
    validateUUIDParam('columnId'),
    columnController.getColumnCards
  );

  return router;
}