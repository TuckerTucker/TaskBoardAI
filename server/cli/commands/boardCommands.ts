import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table, getBorderCharacters } from 'table';
import { ServiceFactory } from '../ServiceFactory';
import { formatCliError } from '@core/errors/cli';
import { BoardQuery } from '@core/schemas/querySchemas';

export default function registerBoardCommands(program: Command, services: ServiceFactory) {
  const boardService = services.getBoardService();
  
  // Board commands group
  const boardCmd = program
    .command('board')
    .description('Manage kanban boards')
    .alias('b');
  
  // List boards command
  boardCmd
    .command('list')
    .description('List all available boards')
    .alias('ls')
    .action(async () => {
      const spinner = ora('Fetching boards...').start();
      
      try {
        const boards = await boardService.findAll();
        spinner.stop();
        
        if (boards.length === 0) {
          console.log(chalk.yellow('No boards found. Create one with "taskboard board create <name>".'));
          return;
        }
        
        // Format the data for the table
        const tableData = [
          [chalk.cyan('Title'), chalk.cyan('ID'), chalk.cyan('Cards'), chalk.cyan('Columns'), chalk.cyan('Last Updated')],
          ...boards.map(board => {
            const date = new Date(board.updatedAt);
            const formattedDate = date.toLocaleString();
            return [
              chalk.white(board.title),
              chalk.gray(board.id.substring(0, 8) + '...'),
              chalk.yellow(board.cards.length.toString()),
              chalk.blue(board.columns.length.toString()),
              chalk.gray(formattedDate)
            ];
          })
        ];
        
        // Display the table
        const tableConfig = {
          border: getBorderCharacters('norc'),
          columnDefault: {
            paddingLeft: 1,
            paddingRight: 1
          },
          drawHorizontalLine: (index: number, size: number) => {
            return index === 0 || index === 1 || index === size;
          }
        };
        
        console.log(table(tableData, tableConfig));
      } catch (error) {
        spinner.fail('Failed to list boards');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Create board command
  boardCmd
    .command('create <title>')
    .description('Create a new board with the given title')
    .option('-d, --description <description>', 'Board description')
    .option('-c, --columns <columns>', 'Comma-separated list of column names')
    .action(async (title, options) => {
      const spinner = ora(`Creating board "${title}"...`).start();
      
      try {
        const boardData: any = { title };
        
        if (options.description) {
          boardData.description = options.description;
        }
        
        if (options.columns) {
          boardData.columns = options.columns.split(',').map((col: string) => col.trim());
        }
        
        const board = await boardService.create(boardData);
        spinner.succeed(chalk.green(`Board "${title}" created successfully with ID: ${board.id}`));
        
        console.log(`\nTo view your board: ${chalk.cyan(`taskboard board view ${board.id}`)}`);
      } catch (error) {
        spinner.fail(`Failed to create board "${title}"`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // View board command
  boardCmd
    .command('view <boardId>')
    .description('View a board by ID')
    .option('-f, --format <format>', 'Output format: summary, full, cards-only', 'summary')
    .action(async (boardId, options) => {
      const spinner = ora(`Loading board ${boardId}...`).start();
      
      try {
        const board = await boardService.findById(boardId);
        spinner.stop();
        
        if (options.format === 'full') {
          // For full format, pretty-print the JSON
          console.log(JSON.stringify(board, null, 2));
        } else if (options.format === 'summary') {
          // For summary format, show a concise view
          console.log(chalk.cyan(`\n${board.title} (${board.id})`));
          if (board.description) {
            console.log(chalk.gray(`Description: ${board.description}`));
          }
          console.log(chalk.gray(`Last updated: ${new Date(board.updatedAt).toLocaleString()}\n`));
          
          // Show column statistics
          const columnData = [
            [chalk.cyan('Column'), chalk.cyan('Cards'), chalk.cyan('WIP Limit')],
            ...board.columns.map(col => {
              const cardCount = board.cards.filter(card => card.columnId === col.id).length;
              const wipLimit = col.wipLimit ? col.wipLimit.toString() : 'None';
              return [
                chalk.white(col.title),
                chalk.yellow(cardCount.toString()),
                chalk.blue(wipLimit)
              ];
            })
          ];
          
          console.log(table(columnData, {
            border: getBorderCharacters('norc'),
            columnDefault: {
              paddingLeft: 1,
              paddingRight: 1
            },
            drawHorizontalLine: (index: number, size: number) => {
              return index === 0 || index === 1 || index === size;
            }
          }));
          
          // Show progress
          const totalCards = board.cards.length;
          const lastColumn = board.columns[board.columns.length - 1];
          const completedCards = lastColumn ? board.cards.filter(card => card.columnId === lastColumn.id).length : 0;
          const progressPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;
          
          console.log(`\nProgress: ${chalk.green(progressPercentage + '%')} (${completedCards}/${totalCards} cards completed)`);
        } else if (options.format === 'cards-only') {
          // For cards-only format, show a table of cards
          const cards = board.cards || [];
          
          if (cards.length === 0) {
            console.log(chalk.yellow('No cards found.'));
            return;
          }
          
          const cardData = [
            [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Column'), chalk.cyan('Priority'), chalk.cyan('Updated')],
            ...cards.map(card => {
              // Find column name
              const column = board.columns.find(c => c.id === card.columnId);
              
              return [
                chalk.gray(card.id.substring(0, 8) + '...'),
                chalk.white(card.title),
                chalk.yellow(column?.title || 'Unknown'),
                chalk.blue(card.priority),
                chalk.gray(new Date(card.updatedAt).toLocaleString())
              ];
            })
          ];
          
          console.log(table(cardData, {
            border: getBorderCharacters('norc'),
            columnDefault: {
              paddingLeft: 1,
              paddingRight: 1
            },
            drawHorizontalLine: (index: number, size: number) => {
              return index === 0 || index === 1 || index === size;
            }
          }));
        }
      } catch (error) {
        spinner.fail(`Failed to load board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Delete board command
  boardCmd
    .command('delete <boardId>')
    .description('Delete a board by ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (boardId, options) => {
      if (!options.force) {
        const { default: inquirer } = await import('inquirer');
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete board ${boardId}? This action cannot be undone.`,
            default: false
          }
        ]);
        
        if (!answer.confirm) {
          console.log(chalk.yellow('Operation cancelled.'));
          return;
        }
      }
      
      const spinner = ora(`Deleting board ${boardId}...`).start();
      
      try {
        await boardService.delete(boardId);
        spinner.succeed(chalk.green(`Board ${boardId} deleted successfully`));
      } catch (error) {
        spinner.fail(`Failed to delete board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Duplicate board command
  boardCmd
    .command('duplicate <boardId>')
    .description('Create a copy of an existing board')
    .option('-t, --title <title>', 'Title for the new board')
    .action(async (boardId, options) => {
      const spinner = ora(`Duplicating board ${boardId}...`).start();
      
      try {
        const newBoard = await boardService.duplicateBoard(boardId, options.title);
        spinner.succeed(chalk.green(`Board duplicated successfully!`));
        
        console.log(`\n**New Board:** "${newBoard.title}"`);
        console.log(`**New Board ID:** ${newBoard.id}`);
        console.log(`**Duplicated:** ${newBoard.cards.length} cards and ${newBoard.columns.length} columns`);
      } catch (error) {
        spinner.fail(`Failed to duplicate board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Get board stats command
  boardCmd
    .command('stats <boardId>')
    .description('Get analytics and statistics for a board')
    .action(async (boardId) => {
      const spinner = ora(`Loading board statistics...`).start();
      
      try {
        const stats = await boardService.getBoardStats(boardId);
        const board = await boardService.findById(boardId);
        spinner.stop();

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

        console.log(statsText);
      } catch (error) {
        spinner.fail(`Failed to get board stats ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Also register shorthand commands at the root level
  
  // List shorthand
  program
    .command('list')
    .description('List all available boards')
    .alias('ls')
    .action(async () => {
      const listCommand = boardCmd.commands.find(cmd => cmd.name() === 'list');
      if (listCommand) {
        // @ts-ignore
        await listCommand._actionHandler();
      }
    });
  
  // Create shorthand
  program
    .command('create <title>')
    .description('Create a new board with the given title')
    .option('-d, --description <description>', 'Board description')
    .option('-c, --columns <columns>', 'Comma-separated list of column names')
    .action(async (title, options) => {
      const createCommand = boardCmd.commands.find(cmd => cmd.name() === 'create');
      if (createCommand) {
        // @ts-ignore
        await createCommand._actionHandler(title, options);
      }
    });
  
  // View shorthand
  program
    .command('view <boardId>')
    .description('View a board by ID')
    .option('-f, --format <format>', 'Output format: summary, full, cards-only', 'summary')
    .action(async (boardId, options) => {
      const viewCommand = boardCmd.commands.find(cmd => cmd.name() === 'view');
      if (viewCommand) {
        // @ts-ignore
        await viewCommand._actionHandler(boardId, options);
      }
    });
  
  // Query boards command
  boardCmd
    .command('query')
    .description('Search for boards that match specific criteria')
    .option('--title <title>', 'Filter boards by title (partial match)')
    .option('--created-before <date>', 'Filter boards created before this date (ISO format)')
    .option('--created-after <date>', 'Filter boards created after this date (ISO format)')
    .option('--updated-before <date>', 'Filter boards updated before this date (ISO format)')
    .option('--updated-after <date>', 'Filter boards updated after this date (ISO format)')
    .option('--tags <tags>', 'Filter boards containing any of these tags (comma-separated)')
    .option('--sort-by <property>', 'Property to sort by (title, createdAt, updatedAt)')
    .option('--sort-order <order>', 'Sort order (asc, desc)')
    .option('--limit <number>', 'Maximum number of boards to return')
    .option('--offset <number>', 'Number of boards to skip')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      const spinner = ora('Querying boards...').start();
      
      try {
        const query: BoardQuery = {
          title: options.title,
          createdBefore: options.createdBefore,
          createdAfter: options.createdAfter,
          updatedBefore: options.updatedBefore,
          updatedAfter: options.updatedAfter,
          tags: options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : undefined,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
          limit: options.limit ? parseInt(options.limit) : undefined,
          offset: options.offset ? parseInt(options.offset) : undefined
        };
        
        const boards = await boardService.queryBoards(query);
        spinner.stop();
        
        if (options.output === 'json') {
          console.log(JSON.stringify(boards, null, 2));
          return;
        }
        
        if (boards.length === 0) {
          console.log(chalk.yellow('No boards found matching your query.'));
          return;
        }
        
        // Create table output
        const tableData = [
          [chalk.cyan('Title'), chalk.cyan('ID'), chalk.cyan('Cards'), chalk.cyan('Columns'), chalk.cyan('Created'), chalk.cyan('Updated'), chalk.cyan('Tags')],
          ...boards.map(board => [
            chalk.white(board.title),
            chalk.gray(board.id.substring(0, 8) + '...'),
            chalk.yellow(board.cards.length.toString()),
            chalk.blue(board.columns.length.toString()),
            chalk.gray(new Date(board.createdAt).toLocaleDateString()),
            chalk.gray(new Date(board.updatedAt).toLocaleDateString()),
            chalk.magenta(board.tags.join(', '))
          ])
        ];
        
        const output = table(tableData, {
          border: getBorderCharacters('norc'),
          columnDefault: { paddingLeft: 1, paddingRight: 1 },
          drawHorizontalLine: (index, size) => index === 0 || index === 1 || index === size
        });
        
        console.log(output);
        console.log(chalk.green(`Found ${boards.length} boards matching your query`));
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
  
  // Query boards shorthand
  program
    .command('query-boards')
    .description('Search for boards that match specific criteria')
    .option('--title <title>', 'Filter boards by title (partial match)')
    .option('--created-before <date>', 'Filter boards created before this date (ISO format)')
    .option('--created-after <date>', 'Filter boards created after this date (ISO format)')
    .option('--updated-before <date>', 'Filter boards updated before this date (ISO format)')
    .option('--updated-after <date>', 'Filter boards updated after this date (ISO format)')
    .option('--tags <tags>', 'Filter boards containing any of these tags (comma-separated)')
    .option('--sort-by <property>', 'Property to sort by (title, createdAt, updatedAt)')
    .option('--sort-order <order>', 'Sort order (asc, desc)')
    .option('--limit <number>', 'Maximum number of boards to return')
    .option('--offset <number>', 'Number of boards to skip')
    .option('--output <format>', 'Output format (table, json)', 'table')
    .action(async (options) => {
      const queryCommand = boardCmd.commands.find(cmd => cmd.name() === 'query');
      if (queryCommand) {
        // @ts-ignore
        await queryCommand._actionHandler(options);
      }
    });
}