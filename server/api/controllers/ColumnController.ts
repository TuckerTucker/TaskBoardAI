import { Request, Response, NextFunction } from 'express';
import { IBoardService, IValidationService } from '@core/services';
import { CreateColumn, UpdateColumn } from '@core/schemas';
import { ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class ColumnController {
  private logger = logger.child({ component: 'ColumnController' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private boardService: IBoardService,
    private validationService: IValidationService
  ) {}

  // GET /api/boards/:boardId/columns/:columnId
  getColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, columnId } = req.params;
      this.logger.debug('Getting column', { boardId, columnId });

      const column = await this.errorRecovery.safeFileOperation(
        () => this.boardService.findColumn(boardId, columnId),
        'get column'
      );

      res.json({
        success: true,
        data: column,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/boards/:boardId/columns
  createColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = req.params;
      this.logger.debug('Creating column', { boardId, body: req.body });

      const columnData = this.validationService.validateCreateColumn(req.body);
      
      const column = await this.errorRecovery.safeFileOperation(
        () => this.boardService.addColumn(boardId, columnData),
        'create column'
      );

      res.status(201).json({
        success: true,
        data: column,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/boards/:boardId/columns/:columnId
  updateColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, columnId } = req.params;
      this.logger.debug('Updating column', { boardId, columnId, body: req.body });

      const updateData = this.validationService.validateUpdateColumn(req.body);
      
      const column = await this.errorRecovery.safeFileOperation(
        () => this.boardService.updateColumn(boardId, columnId, updateData),
        'update column'
      );

      res.json({
        success: true,
        data: column,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/boards/:boardId/columns/:columnId
  deleteColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, columnId } = req.params;
      this.logger.debug('Deleting column', { boardId, columnId });

      await this.errorRecovery.safeFileOperation(
        () => this.boardService.deleteColumn(boardId, columnId),
        'delete column'
      );

      res.json({
        success: true,
        data: { message: 'Column deleted successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/boards/:boardId/columns/reorder
  reorderColumns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId } = req.params;
      const { columnOrder } = req.body;
      this.logger.debug('Reordering columns', { boardId, columnOrder });

      if (!Array.isArray(columnOrder)) {
        throw new Error('columnOrder must be an array of column IDs');
      }

      const columns = await this.errorRecovery.safeFileOperation(
        () => this.boardService.reorderColumns(boardId, columnOrder),
        'reorder columns'
      );

      res.json({
        success: true,
        data: columns,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:boardId/columns/:columnId/cards
  getColumnCards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { boardId, columnId } = req.params;
      this.logger.debug('Getting column cards', { boardId, columnId });

      // Get the board to access cards in the column
      const board = await this.boardService.findById(boardId);
      const column = board.columns.find(col => col.id === columnId);
      
      if (!column) {
        throw new Error(`Column not found: ${columnId}`);
      }

      const cards = board.cards
        .filter(card => card.columnId === columnId)
        .sort((a, b) => a.position - b.position);

      res.json({
        success: true,
        data: {
          column,
          cards,
          cardCount: cards.length,
          wipStatus: column.wipLimit ? {
            current: cards.length,
            limit: column.wipLimit,
            exceeded: cards.length > column.wipLimit
          } : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}