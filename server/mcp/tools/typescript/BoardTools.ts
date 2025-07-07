import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { IBoardService, IValidationService } from '@core/services';
import { CreateBoard, UpdateBoard, CreateCard, UpdateCard, CreateColumn, UpdateColumn, PaginationParams, CardFilter } from '@core/schemas';
import { ErrorFormatter, ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class BoardTools {
  private logger = logger.child({ component: 'BoardTools' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private boardService: IBoardService,
    private validationService: IValidationService
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'create_board',
        description: 'Create a new kanban board with columns and settings',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Board title' },
            description: { type: 'string', description: 'Board description' },
            columns: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Column titles (optional, defaults to To Do, In Progress, Done)'
            },
            settings: {
              type: 'object',
              properties: {
                allowWipLimitExceeding: { type: 'boolean' },
                showCardCount: { type: 'boolean' },
                enableDragDrop: { type: 'boolean' },
                theme: { type: 'string', enum: ['light', 'dark', 'auto'] }
              }
            }
          },
          required: ['title']
        }
      },
      {
        name: 'get_board',
        description: 'Get a board by ID with all its cards and columns',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' }
          },
          required: ['board_id']
        }
      },
      {
        name: 'list_boards',
        description: 'List all boards with optional pagination and sorting',
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            sort_field: { type: 'string', default: 'createdAt' },
            sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          }
        }
      },
      {
        name: 'update_board',
        description: 'Update board title, description, or settings',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            title: { type: 'string', description: 'New board title' },
            description: { type: 'string', description: 'New board description' },
            settings: {
              type: 'object',
              properties: {
                allowWipLimitExceeding: { type: 'boolean' },
                showCardCount: { type: 'boolean' },
                enableDragDrop: { type: 'boolean' },
                theme: { type: 'string', enum: ['light', 'dark', 'auto'] }
              }
            }
          },
          required: ['board_id']
        }
      },
      {
        name: 'delete_board',
        description: 'Delete a board permanently',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' }
          },
          required: ['board_id']
        }
      },
      {
        name: 'duplicate_board',
        description: 'Create a copy of an existing board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Source board ID' },
            new_title: { type: 'string', description: 'Title for the new board (optional)' }
          },
          required: ['board_id']
        }
      },
      {
        name: 'get_board_stats',
        description: 'Get analytics and statistics for a board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' }
          },
          required: ['board_id']
        }
      }
    ];
  }

  async handleTool(name: string, args: any): Promise<CallToolResult> {
    try {
      this.logger.info('Handling board tool', { name, args });

      switch (name) {
        case 'create_board':
          return await this.createBoard(args);
        case 'get_board':
          return await this.getBoard(args);
        case 'list_boards':
          return await this.listBoards(args);
        case 'update_board':
          return await this.updateBoard(args);
        case 'delete_board':
          return await this.deleteBoard(args);
        case 'duplicate_board':
          return await this.duplicateBoard(args);
        case 'get_board_stats':
          return await this.getBoardStats(args);
        default:
          throw new Error(`Unknown board tool: ${name}`);
      }
    } catch (error) {
      this.logger.error('Board tool execution failed', { name, args, error });
      const formatted = ErrorFormatter.formatError(error);
      
      return {
        content: [{
          type: 'text',
          text: `Error: ${formatted.message}`
        }],
        isError: true
      };
    }
  }

  private async createBoard(args: any): Promise<CallToolResult> {
    const boardData = this.validationService.validateCreateBoard(args);
    
    const board = await this.errorRecovery.safeFileOperation(
      () => this.boardService.create(boardData),
      'create board'
    );

    return {
      content: [{
        type: 'text',
        text: `✅ Board "${board.title}" created successfully!\n\n` +
              `**Board ID:** ${board.id}\n` +
              `**Columns:** ${board.columns.map(col => col.title).join(', ')}\n` +
              `**Created:** ${new Date(board.createdAt).toLocaleString()}`
      }]
    };
  }

  private async getBoard(args: any): Promise<CallToolResult> {
    const { board_id } = args;
    
    const board = await this.errorRecovery.safeFileOperation(
      () => this.boardService.findById(board_id),
      'get board'
    );

    const cardsByColumn = board.columns.map(col => ({
      column: col.title,
      cards: board.cards
        .filter(card => card.columnId === col.id)
        .sort((a, b) => a.position - b.position)
        .map(card => ({
          id: card.id,
          title: card.title,
          priority: card.priority,
          tags: card.tags,
          assignee: card.assignee || 'Unassigned',
          dueDate: card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'No due date'
        }))
    }));

    const boardInfo = `# ${board.title}\n\n` +
      (board.description ? `**Description:** ${board.description}\n\n` : '') +
      `**Total Cards:** ${board.cards.length}\n` +
      `**Created:** ${new Date(board.createdAt).toLocaleString()}\n` +
      `**Last Updated:** ${new Date(board.updatedAt).toLocaleString()}\n\n`;

    const columnsInfo = cardsByColumn.map(col => 
      `## ${col.column} (${col.cards.length} cards)\n\n` +
      (col.cards.length > 0 
        ? col.cards.map(card => 
            `- **${card.title}** (${card.priority}) ${card.tags.length > 0 ? `[${card.tags.join(', ')}]` : ''}\n` +
            `  - Assignee: ${card.assignee}\n` +
            `  - Due: ${card.dueDate}`
          ).join('\n') + '\n'
        : '*No cards*\n'
      )
    ).join('\n');

    return {
      content: [{
        type: 'text',
        text: boardInfo + columnsInfo
      }]
    };
  }

  private async listBoards(args: any): Promise<CallToolResult> {
    const pagination: PaginationParams = {
      page: args.page || 1,
      limit: args.limit || 20
    };

    const sortParams = {
      field: args.sort_field || 'createdAt',
      order: args.sort_order || 'desc' as 'asc' | 'desc'
    };

    const boards = await this.errorRecovery.safeFileOperation(
      () => this.boardService.findAll(pagination, sortParams),
      'list boards'
    );

    const totalCount = await this.boardService.count();

    if (boards.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '📋 No boards found. Create your first board with the `create_board` tool!'
        }]
      };
    }

    const boardList = boards.map((board, index) => {
      const cardCount = board.cards.length;
      const columnCount = board.columns.length;
      
      return `${(pagination.page - 1) * pagination.limit + index + 1}. **${board.title}**\n` +
             `   ID: ${board.id}\n` +
             `   Cards: ${cardCount} | Columns: ${columnCount}\n` +
             `   Created: ${new Date(board.createdAt).toLocaleDateString()}\n` +
             (board.description ? `   Description: ${board.description}\n` : '');
    }).join('\n');

    const paginationInfo = `\n📊 Showing ${boards.length} of ${totalCount} boards (Page ${pagination.page})`;

    return {
      content: [{
        type: 'text',
        text: `# 📋 Kanban Boards\n\n${boardList}${paginationInfo}`
      }]
    };
  }

  private async updateBoard(args: any): Promise<CallToolResult> {
    const { board_id, ...updates } = args;
    const updateData = this.validationService.validateUpdateBoard(updates);
    
    const board = await this.errorRecovery.safeFileOperation(
      () => this.boardService.update(board_id, updateData),
      'update board'
    );

    const changedFields = Object.keys(updates).join(', ');

    return {
      content: [{
        type: 'text',
        text: `✅ Board "${board.title}" updated successfully!\n\n` +
              `**Updated fields:** ${changedFields}\n` +
              `**Last updated:** ${new Date(board.updatedAt).toLocaleString()}`
      }]
    };
  }

  private async deleteBoard(args: any): Promise<CallToolResult> {
    const { board_id } = args;
    
    // Get board info before deletion
    const board = await this.boardService.findById(board_id);
    
    await this.errorRecovery.safeFileOperation(
      () => this.boardService.delete(board_id),
      'delete board'
    );

    return {
      content: [{
        type: 'text',
        text: `🗑️ Board "${board.title}" has been permanently deleted.\n\n` +
              `**Deleted:** ${board.cards.length} cards and ${board.columns.length} columns`
      }]
    };
  }

  private async duplicateBoard(args: any): Promise<CallToolResult> {
    const { board_id, new_title } = args;
    
    const newBoard = await this.errorRecovery.safeFileOperation(
      () => this.boardService.duplicateBoard(board_id, new_title),
      'duplicate board'
    );

    return {
      content: [{
        type: 'text',
        text: `📋 Board duplicated successfully!\n\n` +
              `**New Board:** "${newBoard.title}"\n` +
              `**New Board ID:** ${newBoard.id}\n` +
              `**Duplicated:** ${newBoard.cards.length} cards and ${newBoard.columns.length} columns`
      }]
    };
  }

  private async getBoardStats(args: any): Promise<CallToolResult> {
    const { board_id } = args;
    
    const stats = await this.errorRecovery.safeFileOperation(
      () => this.boardService.getBoardStats(board_id),
      'get board stats'
    );

    const board = await this.boardService.findById(board_id);

    const statsText = `# 📊 Board Statistics: ${board.title}\n\n` +
      `**Total Cards:** ${stats.totalCards}\n` +
      `**Completion Rate:** ${stats.completionRate}%\n` +
      `**Overdue Tasks:** ${stats.overdueTasks}\n\n` +
      `## Cards by Column\n` +
      Object.entries(stats.cardsByColumn)
        .map(([column, count]) => `- **${column}:** ${count} cards`)
        .join('\n') + '\n\n' +
      `## Cards by Priority\n` +
      Object.entries(stats.cardsByPriority)
        .map(([priority, count]) => `- **${priority.charAt(0).toUpperCase() + priority.slice(1)}:** ${count} cards`)
        .join('\n');

    return {
      content: [{
        type: 'text',
        text: statsText
      }]
    };
  }
}