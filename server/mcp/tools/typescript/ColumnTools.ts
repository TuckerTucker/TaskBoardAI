import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { IBoardService, IValidationService } from '@core/services';
import { CreateColumn, UpdateColumn } from '@core/schemas';
import { ErrorFormatter, ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class ColumnTools {
  private logger = logger.child({ component: 'ColumnTools' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private boardService: IBoardService,
    private validationService: IValidationService
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'create_column',
        description: 'Add a new column to a board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            title: { type: 'string', description: 'Column title' },
            wip_limit: { type: 'number', minimum: 1, description: 'Work in progress limit (optional)' },
            color: { type: 'string', pattern: '^#[0-9A-F]{6}$', description: 'Column color in hex format (optional)' }
          },
          required: ['board_id', 'title']
        }
      },
      {
        name: 'update_column',
        description: 'Update column properties like title, WIP limit, or color',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            column_id: { type: 'string', description: 'Column ID' },
            title: { type: 'string', description: 'New column title' },
            wip_limit: { type: 'number', minimum: 1, description: 'New WIP limit' },
            color: { type: 'string', pattern: '^#[0-9A-F]{6}$', description: 'New column color in hex format' }
          },
          required: ['board_id', 'column_id']
        }
      },
      {
        name: 'delete_column',
        description: 'Delete a column (only if it has no cards)',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            column_id: { type: 'string', description: 'Column ID' }
          },
          required: ['board_id', 'column_id']
        }
      },
      {
        name: 'reorder_columns',
        description: 'Change the order of columns on a board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            column_order: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of column IDs in the desired order'
            }
          },
          required: ['board_id', 'column_order']
        }
      },
      {
        name: 'get_column_cards',
        description: 'Get all cards in a specific column',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            column_id: { type: 'string', description: 'Column ID' }
          },
          required: ['board_id', 'column_id']
        }
      }
    ];
  }

  async handleTool(name: string, args: any): Promise<CallToolResult> {
    try {
      this.logger.info('Handling column tool', { name, args });

      switch (name) {
        case 'create_column':
          return await this.createColumn(args);
        case 'update_column':
          return await this.updateColumn(args);
        case 'delete_column':
          return await this.deleteColumn(args);
        case 'reorder_columns':
          return await this.reorderColumns(args);
        case 'get_column_cards':
          return await this.getColumnCards(args);
        default:
          throw new Error(`Unknown column tool: ${name}`);
      }
    } catch (error) {
      this.logger.error('Column tool execution failed', { name, args, error });
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

  private async createColumn(args: any): Promise<CallToolResult> {
    const { board_id, ...columnData } = args;
    
    // Convert snake_case to camelCase
    const createData: CreateColumn = {
      title: columnData.title,
      wipLimit: columnData.wip_limit,
      color: columnData.color
    };

    const column = await this.errorRecovery.safeFileOperation(
      () => this.boardService.addColumn(board_id, createData),
      'create column'
    );

    return {
      content: [{
        type: 'text',
        text: `✅ Column "${column.title}" created successfully!\n\n` +
              `**Column ID:** ${column.id}\n` +
              `**Position:** ${column.position}\n` +
              (column.wipLimit ? `**WIP Limit:** ${column.wipLimit}\n` : '') +
              (column.color ? `**Color:** ${column.color}\n` : '')
      }]
    };
  }

  private async updateColumn(args: any): Promise<CallToolResult> {
    const { board_id, column_id, ...updates } = args;
    
    // Convert snake_case to camelCase
    const updateData: UpdateColumn = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.wip_limit !== undefined) updateData.wipLimit = updates.wip_limit;
    if (updates.color !== undefined) updateData.color = updates.color;

    const column = await this.errorRecovery.safeFileOperation(
      () => this.boardService.updateColumn(board_id, column_id, updateData),
      'update column'
    );

    const changedFields = Object.keys(updates).join(', ');

    return {
      content: [{
        type: 'text',
        text: `✅ Column "${column.title}" updated successfully!\n\n` +
              `**Updated fields:** ${changedFields}`
      }]
    };
  }

  private async deleteColumn(args: any): Promise<CallToolResult> {
    const { board_id, column_id } = args;
    
    // Get column info before deletion
    const column = await this.boardService.findColumn(board_id, column_id);
    
    await this.errorRecovery.safeFileOperation(
      () => this.boardService.deleteColumn(board_id, column_id),
      'delete column'
    );

    return {
      content: [{
        type: 'text',
        text: `🗑️ Column "${column.title}" has been permanently deleted.`
      }]
    };
  }

  private async reorderColumns(args: any): Promise<CallToolResult> {
    const { board_id, column_order } = args;
    
    const columns = await this.errorRecovery.safeFileOperation(
      () => this.boardService.reorderColumns(board_id, column_order),
      'reorder columns'
    );

    const columnNames = columns.map(col => col.title).join(' → ');

    return {
      content: [{
        type: 'text',
        text: `🔄 Columns reordered successfully!\n\n**New order:** ${columnNames}`
      }]
    };
  }

  private async getColumnCards(args: any): Promise<CallToolResult> {
    const { board_id, column_id } = args;
    
    const board = await this.boardService.findById(board_id);
    const column = board.columns.find(col => col.id === column_id);
    
    if (!column) {
      throw new Error(`Column not found: ${column_id}`);
    }

    const cards = board.cards
      .filter(card => card.columnId === column_id)
      .sort((a, b) => a.position - b.position);

    if (cards.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `📋 Column "${column.title}" is empty.\n\nNo cards found.`
        }]
      };
    }

    const wipStatus = column.wipLimit 
      ? `(${cards.length}/${column.wipLimit} cards${cards.length >= column.wipLimit ? ' - WIP LIMIT REACHED' : ''})`
      : `(${cards.length} cards)`;

    const cardList = cards.map((card, index) => {
      return `${index + 1}. **${card.title}** (${card.priority})\n` +
             `   Tags: ${card.tags.length > 0 ? card.tags.join(', ') : 'None'}\n` +
             `   Assignee: ${card.assignee || 'Unassigned'}\n` +
             `   Due: ${card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'Not set'}\n`;
    }).join('\n');

    return {
      content: [{
        type: 'text',
        text: `# 📋 ${column.title} ${wipStatus}\n\n${cardList}`
      }]
    };
  }
}