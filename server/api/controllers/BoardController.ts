import { Request, Response, NextFunction } from 'express';
import { IBoardService, IValidationService } from '@core/services';
import { CreateBoard, UpdateBoard, PaginationParams, SortParams } from '@core/schemas';
import { ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class BoardController {
  private logger = logger.child({ component: 'BoardController' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private boardService: IBoardService,
    private validationService: IValidationService
  ) {}

  // GET /api/boards
  listBoards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Listing boards', { query: req.query });

      const pagination: PaginationParams = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20
      };

      const sort: SortParams = {
        field: req.query.sort_field as string || 'createdAt',
        order: (req.query.sort_order as 'asc' | 'desc') || 'desc'
      };

      const boards = await this.errorRecovery.safeFileOperation(
        () => this.boardService.findAll(pagination, sort),
        'list boards'
      );

      const totalCount = await this.boardService.count();

      res.json({
        success: true,
        data: {
          boards,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: totalCount,
            pages: Math.ceil(totalCount / pagination.limit)
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:id
  getBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Getting board', { id });

      const board = await this.errorRecovery.safeFileOperation(
        () => this.boardService.findById(id),
        'get board'
      );

      res.json({
        success: true,
        data: board,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/boards
  createBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.logger.debug('Creating board', { body: req.body });

      const boardData = this.validationService.validateCreateBoard(req.body);
      
      const board = await this.errorRecovery.safeFileOperation(
        () => this.boardService.create(boardData),
        'create board'
      );

      res.status(201).json({
        success: true,
        data: board,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/boards/:id
  updateBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Updating board', { id, body: req.body });

      const updateData = this.validationService.validateUpdateBoard(req.body);
      
      const board = await this.errorRecovery.safeFileOperation(
        () => this.boardService.update(id, updateData),
        'update board'
      );

      res.json({
        success: true,
        data: board,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/boards/:id
  deleteBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Deleting board', { id });

      await this.errorRecovery.safeFileOperation(
        () => this.boardService.delete(id),
        'delete board'
      );

      res.json({
        success: true,
        data: { message: 'Board deleted successfully' },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/boards/:id/duplicate
  duplicateBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      this.logger.debug('Duplicating board', { id, newTitle: title });

      const board = await this.errorRecovery.safeFileOperation(
        () => this.boardService.duplicateBoard(id, title),
        'duplicate board'
      );

      res.status(201).json({
        success: true,
        data: board,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:id/stats
  getBoardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Getting board stats', { id });

      const stats = await this.errorRecovery.safeFileOperation(
        () => this.boardService.getBoardStats(id),
        'get board stats'
      );

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:id/export
  exportBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const format = req.query.format as 'json' | 'csv' || 'json';
      this.logger.debug('Exporting board', { id, format });

      const exportData = await this.errorRecovery.safeFileOperation(
        () => this.boardService.exportBoard(id, format),
        'export board'
      );

      const board = await this.boardService.findById(id);
      const filename = `${board.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.${format}`;

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(exportData);
      }
    } catch (error) {
      next(error);
    }
  };

  // GET /api/boards/:id/validate
  validateBoard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      this.logger.debug('Validating board integrity', { id });

      const validation = await this.errorRecovery.safeFileOperation(
        () => this.boardService.validateBoardIntegrity(id),
        'validate board'
      );

      res.json({
        success: true,
        data: validation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  };
}