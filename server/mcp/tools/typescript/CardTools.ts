import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { IBoardService, IValidationService } from '@core/services';
import { CreateCard, UpdateCard, CardFilter, PaginationParams } from '@core/schemas';
import { ErrorFormatter, ErrorRecoveryService } from '@core/errors';
import { logger } from '@core/utils';

export class CardTools {
  private logger = logger.child({ component: 'CardTools' });
  private errorRecovery = new ErrorRecoveryService();

  constructor(
    private boardService: IBoardService,
    private validationService: IValidationService
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'create_card',
        description: 'Create a new card in a specific column',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            column_id: { type: 'string', description: 'Column ID where card should be created' },
            title: { type: 'string', description: 'Card title' },
            description: { type: 'string', description: 'Card description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Card tags' },
            assignee: { type: 'string', description: 'Assigned person' },
            due_date: { type: 'string', format: 'date-time', description: 'Due date in ISO format' }
          },
          required: ['board_id', 'column_id', 'title']
        }
      },
      {
        name: 'get_card',
        description: 'Get detailed information about a specific card',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            card_id: { type: 'string', description: 'Card ID' }
          },
          required: ['board_id', 'card_id']
        }
      },
      {
        name: 'update_card',
        description: 'Update card properties like title, description, priority, etc.',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            card_id: { type: 'string', description: 'Card ID' },
            title: { type: 'string', description: 'New card title' },
            description: { type: 'string', description: 'New card description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            tags: { type: 'array', items: { type: 'string' }, description: 'New card tags' },
            assignee: { type: 'string', description: 'New assignee' },
            due_date: { type: 'string', format: 'date-time', description: 'New due date in ISO format' }
          },
          required: ['board_id', 'card_id']
        }
      },
      {
        name: 'move_card',
        description: 'Move a card to a different column and position',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            card_id: { type: 'string', description: 'Card ID' },
            to_column_id: { type: 'string', description: 'Destination column ID' },
            position: { type: 'number', minimum: 0, description: 'Position in destination column (0 = top)' }
          },
          required: ['board_id', 'card_id', 'to_column_id', 'position']
        }
      },
      {
        name: 'delete_card',
        description: 'Delete a card permanently',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            card_id: { type: 'string', description: 'Card ID' }
          },
          required: ['board_id', 'card_id']
        }
      },
      {
        name: 'search_cards',
        description: 'Search for cards by title, description, tags, or assignee',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            query: { type: 'string', description: 'Search query' }
          },
          required: ['board_id', 'query']
        }
      },
      {
        name: 'filter_cards',
        description: 'Filter cards by priority, tags, assignee, or due date',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string', description: 'Board ID' },
            priority: { type: 'array', items: { type: 'string', enum: ['low', 'medium', 'high'] } },
            tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
            assignee: { type: 'string', description: 'Filter by assignee' },
            due_date_from: { type: 'string', format: 'date-time', description: 'Due date range start' },
            due_date_to: { type: 'string', format: 'date-time', description: 'Due date range end' },
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
          },
          required: ['board_id']
        }
      }
    ];
  }

  async handleTool(name: string, args: any): Promise<CallToolResult> {
    try {
      this.logger.info('Handling card tool', { name, args });

      switch (name) {
        case 'create_card':
          return await this.createCard(args);
        case 'get_card':
          return await this.getCard(args);
        case 'update_card':
          return await this.updateCard(args);
        case 'move_card':
          return await this.moveCard(args);
        case 'delete_card':
          return await this.deleteCard(args);
        case 'search_cards':
          return await this.searchCards(args);
        case 'filter_cards':
          return await this.filterCards(args);
        default:
          throw new Error(`Unknown card tool: ${name}`);
      }
    } catch (error) {
      this.logger.error('Card tool execution failed', { name, args, error });
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

  private async createCard(args: any): Promise<CallToolResult> {
    const { board_id, ...cardData } = args;
    
    // Convert snake_case to camelCase for API
    const createData: CreateCard = {
      title: cardData.title,
      description: cardData.description,
      columnId: cardData.column_id,
      priority: cardData.priority || 'medium',
      tags: cardData.tags || [],
      assignee: cardData.assignee,
      dueDate: cardData.due_date
    };

    const card = await this.errorRecovery.safeFileOperation(
      () => this.boardService.addCard(board_id, createData),
      'create card'
    );

    const board = await this.boardService.findById(board_id);
    const column = board.columns.find(col => col.id === card.columnId);

    return {
      content: [{
        type: 'text',
        text: `✅ Card "${card.title}" created successfully!\n\n` +
              `**Card ID:** ${card.id}\n` +
              `**Column:** ${column?.title}\n` +
              `**Priority:** ${card.priority}\n` +
              `**Tags:** ${card.tags.length > 0 ? card.tags.join(', ') : 'None'}\n` +
              `**Assignee:** ${card.assignee || 'Unassigned'}\n` +
              `**Due Date:** ${card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'Not set'}`
      }]
    };
  }

  private async getCard(args: any): Promise<CallToolResult> {
    const { board_id, card_id } = args;
    
    const card = await this.errorRecovery.safeFileOperation(
      () => this.boardService.findCard(board_id, card_id),
      'get card'
    );

    const board = await this.boardService.findById(board_id);
    const column = board.columns.find(col => col.id === card.columnId);

    const cardInfo = `# 📝 ${card.title}\n\n` +
      `**Card ID:** ${card.id}\n` +
      `**Column:** ${column?.title}\n` +
      `**Priority:** ${card.priority}\n` +
      `**Position:** ${card.position}\n` +
      (card.description ? `**Description:** ${card.description}\n` : '') +
      `**Tags:** ${card.tags.length > 0 ? card.tags.join(', ') : 'None'}\n` +
      `**Assignee:** ${card.assignee || 'Unassigned'}\n` +
      `**Due Date:** ${card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'Not set'}\n` +
      `**Created:** ${new Date(card.createdAt).toLocaleString()}\n` +
      `**Last Updated:** ${new Date(card.updatedAt).toLocaleString()}`;

    return {
      content: [{
        type: 'text',
        text: cardInfo
      }]
    };
  }

  private async updateCard(args: any): Promise<CallToolResult> {
    const { board_id, card_id, ...updates } = args;
    
    // Convert snake_case to camelCase
    const updateData: UpdateCard = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.assignee !== undefined) updateData.assignee = updates.assignee;
    if (updates.due_date !== undefined) updateData.dueDate = updates.due_date;

    const card = await this.errorRecovery.safeFileOperation(
      () => this.boardService.updateCard(board_id, card_id, updateData),
      'update card'
    );

    const changedFields = Object.keys(updates).join(', ');

    return {
      content: [{
        type: 'text',
        text: `✅ Card "${card.title}" updated successfully!\n\n` +
              `**Updated fields:** ${changedFields}\n` +
              `**Last updated:** ${new Date(card.updatedAt).toLocaleString()}`
      }]
    };
  }

  private async moveCard(args: any): Promise<CallToolResult> {
    const { board_id, card_id, to_column_id, position } = args;
    
    const card = await this.errorRecovery.safeFileOperation(
      () => this.boardService.moveCard(board_id, card_id, to_column_id, position),
      'move card'
    );

    const board = await this.boardService.findById(board_id);
    const toColumn = board.columns.find(col => col.id === to_column_id);

    return {
      content: [{
        type: 'text',
        text: `🔄 Card "${card.title}" moved successfully!\n\n` +
              `**New Column:** ${toColumn?.title}\n` +
              `**New Position:** ${position}`
      }]
    };
  }

  private async deleteCard(args: any): Promise<CallToolResult> {
    const { board_id, card_id } = args;
    
    // Get card info before deletion
    const card = await this.boardService.findCard(board_id, card_id);
    
    await this.errorRecovery.safeFileOperation(
      () => this.boardService.deleteCard(board_id, card_id),
      'delete card'
    );

    return {
      content: [{
        type: 'text',
        text: `🗑️ Card "${card.title}" has been permanently deleted.`
      }]
    };
  }

  private async searchCards(args: any): Promise<CallToolResult> {
    const { board_id, query } = args;
    
    const cards = await this.errorRecovery.safeFileOperation(
      () => this.boardService.searchCards(board_id, query),
      'search cards'
    );

    if (cards.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `🔍 No cards found matching "${query}"`
        }]
      };
    }

    const board = await this.boardService.findById(board_id);
    
    const cardList = cards.map((card, index) => {
      const column = board.columns.find(col => col.id === card.columnId);
      
      return `${index + 1}. **${card.title}** (${card.priority})\n` +
             `   Column: ${column?.title}\n` +
             `   Tags: ${card.tags.length > 0 ? card.tags.join(', ') : 'None'}\n` +
             `   Assignee: ${card.assignee || 'Unassigned'}\n` +
             (card.description ? `   Description: ${card.description.substring(0, 100)}...\n` : '');
    }).join('\n');

    return {
      content: [{
        type: 'text',
        text: `# 🔍 Search Results for "${query}"\n\nFound ${cards.length} cards:\n\n${cardList}`
      }]
    };
  }

  private async filterCards(args: any): Promise<CallToolResult> {
    const { board_id, page = 1, limit = 20, ...filterArgs } = args;
    
    const pagination: PaginationParams = { page, limit };
    
    const filter: CardFilter = {};
    if (filterArgs.priority) filter.priority = filterArgs.priority;
    if (filterArgs.tags) filter.tags = filterArgs.tags;
    if (filterArgs.assignee) filter.assignee = filterArgs.assignee;
    if (filterArgs.due_date_from || filterArgs.due_date_to) {
      filter.dueDate = {
        from: filterArgs.due_date_from,
        to: filterArgs.due_date_to
      };
    }

    const cards = await this.errorRecovery.safeFileOperation(
      () => this.boardService.findCards(board_id, filter, pagination),
      'filter cards'
    );

    if (cards.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '🔍 No cards found matching the specified filters.'
        }]
      };
    }

    const board = await this.boardService.findById(board_id);
    
    const cardList = cards.map((card, index) => {
      const column = board.columns.find(col => col.id === card.columnId);
      
      return `${(page - 1) * limit + index + 1}. **${card.title}** (${card.priority})\n` +
             `   Column: ${column?.title}\n` +
             `   Tags: ${card.tags.length > 0 ? card.tags.join(', ') : 'None'}\n` +
             `   Assignee: ${card.assignee || 'Unassigned'}\n` +
             `   Due: ${card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'Not set'}\n`;
    }).join('\n');

    const filterSummary = Object.entries(filterArgs)
      .filter(([key, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join(', ');

    return {
      content: [{
        type: 'text',
        text: `# 🔍 Filtered Cards\n\n**Filters:** ${filterSummary}\n` +
              `**Results:** ${cards.length} cards (Page ${page})\n\n${cardList}`
      }]
    };
  }
}