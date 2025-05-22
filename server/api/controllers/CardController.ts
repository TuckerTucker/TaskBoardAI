import { Request, Response, NextFunction } from 'express';
import { IBoardService, IValidationService } from '@core/services';
import { CreateCard, UpdateCard, CardFilter, PaginationParams } from '@core/schemas';
import { ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class CardController {
  private logger = logger.child({ component: 'CardController' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private boardService: IBoardService,
    private validationService: IValidationService
  ) {}

  // GET /api/boards/:boardId/cards
  listCards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = req.params;
      this.logger.debug('Listing cards', { boardId, query: req.query });

      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      // Build filter from query parameters
      const filter: CardFilter = {};
      if (req.query.priority) {
        filter.priority = Array.isArray(req.query.priority) 
          ? req.query.priority as string[]
          : [req.query.priority as string];
      }
      if (req.query.tags) {
        filter.tags = Array.isArray(req.query.tags)
          ? req.query.tags as string[]
          : [req.query.tags as string];
      }
      if (req.query.assignee) {
        filter.assignee = req.query.assignee as string;
      }
      if (req.query.due_date_from || req.query.due_date_to) {
        filter.dueDate = {
          from: req.query.due_date_from as string,
          to: req.query.due_date_to as string
        };
      }

      const cards = await this.errorRecovery.safeFileOperation(
        () => this.boardService.findCards(boardId, filter, pagination),
        'list cards'
      );

      res.json({
        success: true,
        data: {
          cards,
          filter,
          pagination
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:boardId/cards/:cardId
  getCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, cardId } = req.params;
      this.logger.debug('Getting card', { boardId, cardId });

      const card = await this.errorRecovery.safeFileOperation(
        () => this.boardService.findCard(boardId, cardId),
        'get card'
      );

      res.json({
        success: true,
        data: card,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/boards/:boardId/cards
  createCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = req.params;
      this.logger.debug('Creating card', { boardId, body: req.body });

      const cardData = this.validationService.validateCreateCard(req.body);
      
      const card = await this.errorRecovery.safeFileOperation(
        () => this.boardService.addCard(boardId, cardData),
        'create card'
      );

      res.status(201).json({
        success: true,
        data: card,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/boards/:boardId/cards/:cardId
  updateCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, cardId } = req.params;
      this.logger.debug('Updating card', { boardId, cardId, body: req.body });

      const updateData = this.validationService.validateUpdateCard(req.body);
      
      const card = await this.errorRecovery.safeFileOperation(
        () => this.boardService.updateCard(boardId, cardId, updateData),
        'update card'
      );

      res.json({
        success: true,
        data: card,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/boards/:boardId/cards/:cardId
  deleteCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, cardId } = req.params;
      this.logger.debug('Deleting card', { boardId, cardId });

      await this.errorRecovery.safeFileOperation(
        () => this.boardService.deleteCard(boardId, cardId),
        'delete card'
      );

      res.json({
        success: true,
        data: { message: 'Card deleted successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/boards/:boardId/cards/:cardId/move
  moveCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, cardId } = req.params;
      const { toColumnId, position } = req.body;
      this.logger.debug('Moving card', { boardId, cardId, toColumnId, position });

      if (!toColumnId || position === undefined) {
        throw new Error('toColumnId and position are required');
      }

      const card = await this.errorRecovery.safeFileOperation(
        () => this.boardService.moveCard(boardId, cardId, toColumnId, position),
        'move card'
      );

      res.json({
        success: true,
        data: card,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:boardId/cards/search
  searchCards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = req.params;
      const { q: query } = req.query;
      this.logger.debug('Searching cards', { boardId, query });

      if (!query || typeof query !== 'string') {
        throw new Error('Query parameter "q" is required');
      }

      const cards = await this.errorRecovery.safeFileOperation(
        () => this.boardService.searchCards(boardId, query),
        'search cards'
      );

      res.json({
        success: true,
        data: {
          cards,
          query,
          count: cards.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}