import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table, getBorderCharacters } from 'table';
import { ServiceFactory } from '../ServiceFactory';
import { formatCliError } from '@core/errors/cli';
import { CardQuery } from '@core/schemas/querySchemas';

export default function registerCardCommands(program: Command, services: ServiceFactory) {
  const boardService = services.getBoardService();
  
  // Card commands group
  const cardCmd = program
    .command('card')
    .description('Manage cards within boards')
    .alias('c');
  
  // List cards command
  cardCmd
    .command('list <boardId>')
    .description('List all cards in a board')
    .option('-c, --column <columnId>', 'Filter cards by column ID')
    .action(async (boardId, options) => {
      const spinner = ora(`Fetching cards for board ${boardId}...`).start();
      
      try {
        const board = await boardService.findById(boardId);
        let cards = board.cards;
        
        // Filter by column if specified
        if (options.column) {
          cards = cards.filter(card => card.columnId === options.column);
        }
        
        spinner.stop();
        
        if (cards.length === 0) {
          console.log(chalk.yellow('No cards found.'));
          return;
        }
        
        // Create a map of column IDs to names
        const columnMap = new Map(
          board.columns.map(col => [col.id, col.title])
        );
        
        // Format the data for the table
        const tableData = [
          [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Column'), chalk.cyan('Priority'), chalk.cyan('Tags')],
          ...cards.map(card => {
            const columnName = columnMap.get(card.columnId) || card.columnId;
            const tags = card.tags.length > 0 ? card.tags.join(', ') : '';
            
            return [
              chalk.gray(card.id.substring(0, 8) + '...'),
              chalk.white(card.title),
              chalk.yellow(columnName),
              chalk.blue(card.priority),
              chalk.magenta(tags)
            ];
          })
        ];
        
        // Display the table
        console.log(table(tableData, {
          border: getBorderCharacters('norc'),
          columnDefault: {
            paddingLeft: 1,
            paddingRight: 1
          },
          drawHorizontalLine: (index: number, size: number) => {
            return index === 0 || index === 1 || index === size;
          }
        }));
        
        console.log(`\nView a card with: ${chalk.cyan(`taskboard card view ${boardId} <cardId>`)}`);
      } catch (error) {
        spinner.fail(`Failed to list cards for board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // View card command
  cardCmd
    .command('view <boardId> <cardId>')
    .description('View a specific card')
    .action(async (boardId, cardId) => {
      const spinner = ora(`Fetching card ${cardId}...`).start();
      
      try {
        const card = await boardService.findCard(boardId, cardId);
        const board = await boardService.findById(boardId);
        
        spinner.stop();
        
        // Find column name
        const column = board.columns.find(col => col.id === card.columnId);
        
        // Display card details
        console.log(chalk.cyan(`\n${card.title} (${card.id})`));
        console.log(chalk.gray(`Column: ${column?.title || 'Unknown'}`));
        console.log(chalk.blue(`Priority: ${card.priority}`));
        console.log(chalk.gray(`Last updated: ${new Date(card.updatedAt).toLocaleString()}`));
        
        if (card.tags && card.tags.length > 0) {
          console.log(chalk.magenta(`Tags: ${card.tags.join(', ')}`));
        }
        
        if (card.assignee) {
          console.log(chalk.green(`Assignee: ${card.assignee}`));
        }
        
        if (card.dueDate) {
          console.log(chalk.yellow(`Due Date: ${new Date(card.dueDate).toLocaleDateString()}`));
        }
        
        if (card.description) {
          console.log(chalk.white('\nDescription:'));
          console.log(card.description);
        }
        
        console.log(`\nEdit this card with: ${chalk.cyan(`taskboard card edit ${boardId} ${cardId}`)}`);
      } catch (error) {
        spinner.fail(`Failed to fetch card ${cardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Create card command
  cardCmd
    .command('create <boardId>')
    .description('Create a new card in a board')
    .option('-t, --title <title>', 'Card title')
    .option('-c, --column <columnId>', 'Column ID to place the card in')
    .option('-d, --description <description>', 'Card description')
    .option('-p, --priority <priority>', 'Card priority (low, medium, high)', 'medium')
    .option('--tags <tags>', 'Comma-separated list of tags')
    .option('-a, --assignee <assignee>', 'Assigned person')
    .option('--due <dueDate>', 'Due date (YYYY-MM-DD)')
    .option('-i, --interactive', 'Create card interactively')
    .action(async (boardId, options) => {
      try {
        // Get board to retrieve column information
        const spinner = ora(`Loading board ${boardId}...`).start();
        const board = await boardService.findById(boardId);
        spinner.stop();
        
        let title = options.title;
        let columnId = options.column;
        let description = options.description;
        let priority = options.priority;
        let tags = options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : [];
        let assignee = options.assignee;
        let dueDate = options.due;
        
        // If interactive mode or missing required fields, prompt for input
        if (options.interactive || !title || !columnId) {
          const { default: inquirer } = await import('inquirer');
          
          // Prepare column choices
          const columnChoices = board.columns.map(col => ({
            name: col.title,
            value: col.id
          }));
          
          // Create prompts for missing information
          const prompts = [];
          
          if (!title) {
            prompts.push({
              type: 'input',
              name: 'title',
              message: 'Card title:',
              validate: (input: string) => input.trim().length > 0 ? true : 'Title is required'
            });
          }
          
          if (!columnId) {
            prompts.push({
              type: 'list',
              name: 'columnId',
              message: 'Select column:',
              choices: columnChoices
            });
          }
          
          if (options.interactive && description === undefined) {
            prompts.push({
              type: 'input',
              name: 'description',
              message: 'Card description (optional):'
            });
          }
          
          if (options.interactive && priority === 'medium') {
            prompts.push({
              type: 'list',
              name: 'priority',
              message: 'Select priority:',
              choices: ['low', 'medium', 'high'],
              default: 'medium'
            });
          }
          
          if (options.interactive && tags.length === 0) {
            prompts.push({
              type: 'input',
              name: 'tags',
              message: 'Tags (comma-separated):',
              filter: (input: string) => 
                input ? input.split(',').map(tag => tag.trim()) : []
            });
          }
          
          if (options.interactive && !assignee) {
            prompts.push({
              type: 'input',
              name: 'assignee',
              message: 'Assignee (optional):'
            });
          }
          
          if (options.interactive && !dueDate) {
            prompts.push({
              type: 'input',
              name: 'dueDate',
              message: 'Due date (YYYY-MM-DD, optional):',
              validate: (input: string) => {
                if (!input) return true;
                const date = new Date(input);
                return !isNaN(date.getTime()) ? true : 'Please enter a valid date (YYYY-MM-DD)';
              }
            });
          }
          
          // Prompt for input
          if (prompts.length > 0) {
            const answers = await inquirer.prompt(prompts);
            title = title || answers.title;
            columnId = columnId || answers.columnId;
            description = description !== undefined ? description : answers.description;
            priority = answers.priority || priority;
            tags = answers.tags || tags;
            assignee = assignee || answers.assignee;
            dueDate = dueDate || answers.dueDate;
          }
        }
        
        // Create card data
        const cardData: any = {
          title,
          columnId,
          priority
        };
        
        if (description) cardData.description = description;
        if (tags.length > 0) cardData.tags = tags;
        if (assignee) cardData.assignee = assignee;
        if (dueDate) cardData.dueDate = new Date(dueDate).toISOString();
        
        // Create the card
        spinner.text = 'Creating card...';
        spinner.start();
        
        const card = await boardService.addCard(boardId, cardData);
        
        spinner.succeed(chalk.green('Card created successfully'));
        
        console.log(`\nView your card with: ${chalk.cyan(`taskboard card view ${boardId} ${card.id}`)}`);
      } catch (error) {
        ora().fail(`Failed to create card in board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Edit card command
  cardCmd
    .command('edit <boardId> <cardId>')
    .description('Edit an existing card')
    .option('-t, --title <title>', 'New card title')
    .option('-d, --description <description>', 'New card description')
    .option('-p, --priority <priority>', 'New card priority (low, medium, high)')
    .option('--tags <tags>', 'Comma-separated list of tags')
    .option('-a, --assignee <assignee>', 'New assignee')
    .option('--due <dueDate>', 'New due date (YYYY-MM-DD)')
    .option('-i, --interactive', 'Edit card interactively')
    .action(async (boardId, cardId, options) => {
      try {
        // Get the current card
        const spinner = ora(`Loading card ${cardId}...`).start();
        const card = await boardService.findCard(boardId, cardId);
        spinner.stop();
        
        let title = options.title;
        let description = options.description;
        let priority = options.priority;
        let tags = options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : undefined;
        let assignee = options.assignee;
        let dueDate = options.due;
        
        // If interactive mode or no fields specified, prompt for input
        if (options.interactive || (!title && description === undefined && !priority && tags === undefined && !assignee && !dueDate)) {
          const { default: inquirer } = await import('inquirer');
          
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'title',
              message: 'Card title:',
              default: card.title,
              validate: (input: string) => input.trim().length > 0 ? true : 'Title is required'
            },
            {
              type: 'input',
              name: 'description',
              message: 'Card description:',
              default: card.description || ''
            },
            {
              type: 'list',
              name: 'priority',
              message: 'Priority:',
              choices: ['low', 'medium', 'high'],
              default: card.priority
            },
            {
              type: 'input',
              name: 'tags',
              message: 'Tags (comma-separated):',
              default: card.tags.join(', '),
              filter: (input: string) => 
                input ? input.split(',').map(tag => tag.trim()) : []
            },
            {
              type: 'input',
              name: 'assignee',
              message: 'Assignee:',
              default: card.assignee || ''
            },
            {
              type: 'input',
              name: 'dueDate',
              message: 'Due date (YYYY-MM-DD):',
              default: card.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : '',
              validate: (input: string) => {
                if (!input) return true;
                const date = new Date(input);
                return !isNaN(date.getTime()) ? true : 'Please enter a valid date (YYYY-MM-DD)';
              }
            }
          ]);
          
          title = answers.title;
          description = answers.description;
          priority = answers.priority;
          tags = answers.tags;
          assignee = answers.assignee;
          dueDate = answers.dueDate;
        }
        
        // Create update data
        const updateData: any = {};
        
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority !== undefined) updateData.priority = priority;
        if (tags !== undefined) updateData.tags = tags;
        if (assignee !== undefined) updateData.assignee = assignee;
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate).toISOString() : undefined;
        
        // Update the card
        spinner.text = 'Updating card...';
        spinner.start();
        
        await boardService.updateCard(boardId, cardId, updateData);
        
        spinner.succeed(chalk.green('Card updated successfully'));
        
        console.log(`\nView your updated card with: ${chalk.cyan(`taskboard card view ${boardId} ${cardId}`)}`);
      } catch (error) {
        ora().fail(`Failed to edit card ${cardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Move card command
  cardCmd
    .command('move <boardId> <cardId>')
    .description('Move a card to a different column or position')
    .option('-c, --column <columnId>', 'Target column ID')
    .option('-p, --position <position>', 'Position within column (number)', '0')
    .option('-i, --interactive', 'Move card interactively')
    .action(async (boardId, cardId, options) => {
      try {
        // Get the current card and board
        const spinner = ora(`Loading board and card information...`).start();
        const [card, board] = await Promise.all([
          boardService.findCard(boardId, cardId),
          boardService.findById(boardId)
        ]);
        spinner.stop();
        
        let columnId = options.column;
        let position = parseInt(options.position) || 0;
        
        // If interactive mode or missing required fields, prompt for input
        if (options.interactive || !columnId) {
          const { default: inquirer } = await import('inquirer');
          
          // Prepare column choices
          const columnChoices = board.columns.map(col => ({
            name: col.title,
            value: col.id
          }));
          
          // Create prompts
          const prompts = [];
          
          if (!columnId) {
            prompts.push({
              type: 'list',
              name: 'columnId',
              message: 'Select target column:',
              choices: columnChoices,
              default: card.columnId
            });
          }
          
          if (options.interactive) {
            prompts.push({
              type: 'number',
              name: 'position',
              message: 'Position in column (0 = top):',
              default: 0,
              validate: (input: number) => input >= 0 ? true : 'Position must be non-negative'
            });
          }
          
          // Prompt for input
          if (prompts.length > 0) {
            const answers = await inquirer.prompt(prompts);
            columnId = columnId || answers.columnId;
            position = answers.position !== undefined ? answers.position : position;
          }
        }
        
        // Move the card
        spinner.text = 'Moving card...';
        spinner.start();
        
        await boardService.moveCard(boardId, cardId, columnId, position);
        
        spinner.succeed(chalk.green('Card moved successfully'));
        
        console.log(`\nView the board with: ${chalk.cyan(`taskboard board view ${boardId}`)}`);
      } catch (error) {
        ora().fail(`Failed to move card ${cardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Delete card command
  cardCmd
    .command('delete <boardId> <cardId>')
    .description('Delete a card')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (boardId, cardId, options) => {
      try {
        if (!options.force) {
          const { default: inquirer } = await import('inquirer');
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete card ${cardId}? This action cannot be undone.`,
              default: false
            }
          ]);
          
          if (!answer.confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
          }
        }
        
        const spinner = ora(`Deleting card ${cardId}...`).start();
        
        await boardService.deleteCard(boardId, cardId);
        
        spinner.succeed(chalk.green('Card deleted successfully'));
      } catch (error) {
        ora().fail(`Failed to delete card ${cardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Search cards command
  cardCmd
    .command('search <boardId> <query>')
    .description('Search for cards by title, description, tags, or assignee')
    .action(async (boardId, query) => {
      const spinner = ora(`Searching for "${query}"...`).start();
      
      try {
        const cards = await boardService.searchCards(boardId, query);
        const board = await boardService.findById(boardId);
        
        spinner.stop();
        
        if (cards.length === 0) {
          console.log(chalk.yellow(`No cards found matching "${query}"`));
          return;
        }
        
        // Create a map of column IDs to names
        const columnMap = new Map(
          board.columns.map(col => [col.id, col.title])
        );
        
        const cardList = cards.map((card, index) => {
          const columnName = columnMap.get(card.columnId) || card.columnId;
          
          return `${index + 1}. **${card.title}** (${card.priority})\n` +
                 `   Column: ${columnName}\n` +
                 `   Tags: ${card.tags.length > 0 ? card.tags.join(', ') : 'None'}\n` +
                 `   Assignee: ${card.assignee || 'Unassigned'}\n` +
                 (card.description ? `   Description: ${card.description.substring(0, 100)}...\n` : '');
        }).join('\n');

        console.log(`# 🔍 Search Results for "${query}"\n\nFound ${cards.length} cards:\n\n${cardList}`);
      } catch (error) {
        spinner.fail(`Failed to search cards in board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });

  // Query cards command
  cardCmd
    .command('query <boardId>')
    .description('Search for cards within a board that match specific criteria')
    .option('--title <title>', 'Filter cards by title (partial match)')
    .option('--content <content>', 'Filter cards by content (partial match)')
    .option('--column-id <id>', 'Filter cards by column ID')
    .option('--priority <priority>', 'Filter cards by priority level (low, medium, high)')
    .option('--status <status>', 'Filter cards by status')
    .option('--assignee <assignee>', 'Filter cards by assignee')
    .option('--tags <tags>', 'Filter cards containing any of these tags (comma-separated)')
    .option('--created-before <date>', 'Filter cards created before this date (ISO format)')
    .option('--created-after <date>', 'Filter cards created after this date (ISO format)')
    .option('--updated-before <date>', 'Filter cards updated before this date (ISO format)')
    .option('--updated-after <date>', 'Filter cards updated after this date (ISO format)')
    .option('--sort-by <property>', 'Property to sort by (title, priority, createdAt, updatedAt, status)')
    .option('--sort-order <order>', 'Sort order (asc, desc)')
    .option('--limit <number>', 'Maximum number of cards to return')
    .option('--offset <number>', 'Number of cards to skip')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (boardId, options) => {
      const spinner = ora('Querying cards...').start();
      
      try {
        const query: CardQuery = {
          title: options.title,
          content: options.content,
          columnId: options.columnId,
          priority: options.priority,
          status: options.status,
          assignee: options.assignee,
          tags: options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : undefined,
          createdBefore: options.createdBefore,
          createdAfter: options.createdAfter,
          updatedBefore: options.updatedBefore,
          updatedAfter: options.updatedAfter,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
          limit: options.limit ? parseInt(options.limit) : undefined,
          offset: options.offset ? parseInt(options.offset) : undefined
        };
        
        const cards = await boardService.queryCards(boardId, query);
        const board = await boardService.findById(boardId);
        
        spinner.stop();
        
        if (options.output === 'json') {
          console.log(JSON.stringify(cards, null, 2));
          return;
        }
        
        if (cards.length === 0) {
          console.log(chalk.yellow('No cards found matching your query.'));
          return;
        }
        
        // Create a map of column IDs to names
        const columnMap = new Map(
          board.columns.map(col => [col.id, col.title])
        );
        
        // Helper function for priority coloring
        const getPriorityColor = (priority: string) => {
          switch (priority) {
            case 'high': return chalk.red;
            case 'medium': return chalk.yellow;
            case 'low': return chalk.green;
            default: return chalk.white;
          }
        };
        
        // Create table output
        const tableData = [
          [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Column'), chalk.cyan('Priority'), chalk.cyan('Status'), chalk.cyan('Assignee'), chalk.cyan('Tags')],
          ...cards.map(card => {
            const columnName = columnMap.get(card.columnId) || 'Unknown';
            return [
              chalk.gray(card.id.substring(0, 8) + '...'),
              chalk.white(card.title),
              chalk.blue(columnName),
              getPriorityColor(card.priority)(card.priority),
              chalk.cyan(card.status || '-'),
              chalk.magenta(card.assignee || '-'),
              chalk.gray(card.tags.join(', '))
            ];
          })
        ];
        
        const output = table(tableData, {
          border: getBorderCharacters('norc'),
          columnDefault: { paddingLeft: 1, paddingRight: 1 },
          drawHorizontalLine: (index, size) => index === 0 || index === 1 || index === size
        });
        
        console.log(output);
        console.log(chalk.green(`Found ${cards.length} cards matching your query`));
      } catch (error) {
        spinner.stop();
        const cliError = formatCliError(error);
        console.error(chalk.red(`Error: ${cliError.message}`));
        if (cliError.details) {
          console.error(chalk.gray(cliError.details));
        }
        process.exit(cliError.code);
      }
    });
  
  // Query cards shorthand
  program
    .command('query-cards <boardId>')
    .description('Search for cards within a board that match specific criteria')
    .option('--title <title>', 'Filter cards by title (partial match)')
    .option('--content <content>', 'Filter cards by content (partial match)')
    .option('--column-id <id>', 'Filter cards by column ID')
    .option('--priority <priority>', 'Filter cards by priority level (low, medium, high)')
    .option('--status <status>', 'Filter cards by status')
    .option('--assignee <assignee>', 'Filter cards by assignee')
    .option('--tags <tags>', 'Filter cards containing any of these tags (comma-separated)')
    .option('--created-before <date>', 'Filter cards created before this date (ISO format)')
    .option('--created-after <date>', 'Filter cards created after this date (ISO format)')
    .option('--updated-before <date>', 'Filter cards updated before this date (ISO format)')
    .option('--updated-after <date>', 'Filter cards updated after this date (ISO format)')
    .option('--sort-by <property>', 'Property to sort by (title, priority, createdAt, updatedAt, status)')
    .option('--sort-order <order>', 'Sort order (asc, desc)')
    .option('--limit <number>', 'Maximum number of cards to return')
    .option('--offset <number>', 'Number of cards to skip')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (boardId, options) => {
      const queryCommand = cardCmd.commands.find(cmd => cmd.name() === 'query');
      if (queryCommand) {
        // @ts-ignore
        await queryCommand._actionHandler(boardId, options);
      }
    });
}