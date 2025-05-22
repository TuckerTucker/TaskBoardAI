import { Router } from 'express';
import { BoardController } from '../controllers/BoardController';
import { IBoardService, IValidationService } from '@core/services';
import { 
  validateBoardRouteParams, 
  validatePagination,
  validateUUIDParam,
  validateArrayParam,
  logValidation
} from '../middleware/validation';

export function createBoardRoutes(
  boardService: IBoardService, 
  validationService: IValidationService
): Router {
  const router = Router();
  const boardController = new BoardController(boardService, validationService);

  // Apply logging to all routes
  router.use(logValidation);

  // GET /api/boards - List boards with pagination and sorting
  router.get('/', 
    validatePagination,
    validateArrayParam('sort_field'),
    validateArrayParam('sort_order', ['asc', 'desc']),
    boardController.listBoards
  );

  // POST /api/boards - Create a new board
  router.post('/', 
    boardController.createBoard
  );

  // GET /api/boards/:id - Get a specific board
  router.get('/:id', 
    validateUUIDParam('id'),
    boardController.getBoard
  );

  // PUT /api/boards/:id - Update a board
  router.put('/:id', 
    validateUUIDParam('id'),
    boardController.updateBoard
  );

  // DELETE /api/boards/:id - Delete a board
  router.delete('/:id', 
    validateUUIDParam('id'),
    boardController.deleteBoard
  );

  // POST /api/boards/:id/duplicate - Duplicate a board
  router.post('/:id/duplicate', 
    validateUUIDParam('id'),
    boardController.duplicateBoard
  );

  // GET /api/boards/:id/stats - Get board statistics
  router.get('/:id/stats', 
    validateUUIDParam('id'),
    boardController.getBoardStats
  );

  // GET /api/boards/:id/export - Export board data
  router.get('/:id/export', 
    validateUUIDParam('id'),
    validateArrayParam('format', ['json', 'csv']),
    boardController.exportBoard
  );

  // GET /api/boards/:id/validate - Validate board integrity
  router.get('/:id/validate', 
    validateUUIDParam('id'),
    boardController.validateBoard
  );

  return router;
}