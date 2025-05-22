import { Router } from 'express';
import { CardController } from '../controllers/CardController';
import { IBoardService, IValidationService } from '@core/services';
import { 
  validateCardRouteParams,
  validateBoardRouteParams,
  validatePagination,
  validateUUIDParam,
  validateArrayParam,
  validateDateParam,
  validateSearchQuery,
  logValidation
} from '../middleware/validation';

export function createCardRoutes(
  boardService: IBoardService, 
  validationService: IValidationService
): Router {
  const router = Router({ mergeParams: true }); // Inherit params from parent router
  const cardController = new CardController(boardService, validationService);

  // Apply logging to all routes
  router.use(logValidation);

  // GET /api/boards/:boardId/cards - List cards with filtering and pagination
  router.get('/', 
    validateUUIDParam('boardId'),
    validatePagination,
    validateArrayParam('priority', ['low', 'medium', 'high']),
    validateArrayParam('tags'),
    validateDateParam('due_date_from'),
    validateDateParam('due_date_to'),
    cardController.listCards
  );

  // POST /api/boards/:boardId/cards - Create a new card
  router.post('/', 
    validateUUIDParam('boardId'),
    cardController.createCard
  );

  // GET /api/boards/:boardId/cards/search - Search cards
  router.get('/search', 
    validateUUIDParam('boardId'),
    validateSearchQuery,
    cardController.searchCards
  );

  // GET /api/boards/:boardId/cards/:cardId - Get a specific card
  router.get('/:cardId', 
    validateUUIDParam('boardId'),
    validateUUIDParam('cardId'),
    cardController.getCard
  );

  // PUT /api/boards/:boardId/cards/:cardId - Update a card
  router.put('/:cardId', 
    validateUUIDParam('boardId'),
    validateUUIDParam('cardId'),
    cardController.updateCard
  );

  // DELETE /api/boards/:boardId/cards/:cardId - Delete a card
  router.delete('/:cardId', 
    validateUUIDParam('boardId'),
    validateUUIDParam('cardId'),
    cardController.deleteCard
  );

  // POST /api/boards/:boardId/cards/:cardId/move - Move a card
  router.post('/:cardId/move', 
    validateUUIDParam('boardId'),
    validateUUIDParam('cardId'),
    cardController.moveCard
  );

  return router;
}