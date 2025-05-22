# 8. CLI Redesign

## Objective
Rebuild the command-line interface to use the unified service layer, ensuring feature parity with the MCP and REST API interfaces while providing an intuitive and developer-friendly CLI experience.

## Implementation Tasks

### 8.1 CLI Application Core

**`server/cli/taskboard.ts`:**
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { ServiceFactory } from '@core/services';
import { AppConfig } from '@core/schemas';
import { logger } from '@core/utils/logger';
import { formatCliError } from '@core/errors/cli';

// Load configuration with preset defaults
import config from '../core/utils/config';

// Initialize services
const serviceFactory = ServiceFactory.getInstance(config);

// Create CLI program
const program = new Command();

/**
 * Display an error message and exit
 */
function handleError(error: unknown): never {
  const { code, formattedMessage } = formatCliError(error);
  console.error(formattedMessage);
  process.exit(code);
}

// ASCII art banner
const displayBanner = () => {
  console.log(
    chalk.cyan(
      figlet.textSync('TaskBoardAI', { font: 'Standard', horizontalLayout: 'full' })
    )
  );
  console.log(
    chalk.blueBright('\n📋 Kanban board for AI-assisted task management\n')
  );
};

// Main CLI setup
async function main() {
  try {
    // Configure CLI
    const packageJson = require('../../package.json');
    
    program
      .name('taskboard')
      .description('TaskBoardAI - Kanban board for AI-assisted task management')
      .version(packageJson.version || '1.0.0')
      .option('-d, --debug', 'Enable debug logging')
      .hook('preAction', (thisCommand, actionCommand) => {
        if (actionCommand.opts().debug) {
          process.env.LOG_LEVEL = 'DEBUG';
          logger.info('Debug logging enabled');
        }
      });
    
    // Register command modules
    const registerBoardCommands = require('./commands/boardCommands').default;
    const registerCardCommands = require('./commands/cardCommands').default;
    const registerConfigCommands = require('./commands/configCommands').default;
    const registerWebhookCommands = require('./commands/webhookCommands').default;
    const registerServerCommands = require('./commands/serverCommands').default;
    
    // Register commands
    registerBoardCommands(program, serviceFactory);
    registerCardCommands(program, serviceFactory);
    registerConfigCommands(program, serviceFactory);
    registerWebhookCommands(program, serviceFactory);
    registerServerCommands(program, serviceFactory);
    
    // Add help text at the bottom
    program.addHelpText('after', `
  Examples:
    $ taskboard list                           # List all boards
    $ taskboard create "My New Board"          # Create a new board
    $ taskboard view d79be631-dd8f-4d91-9fdd   # View a board
    $ taskboard server start                   # Start the web server
    $ taskboard card create --help             # Get help for creating cards
    
  Documentation:
    https://github.com/your-repo/taskboardai/docs
`);
    
    // Handle unknown commands
    program.on('command:*', () => {
      console.error(
        chalk.red(`\nError: Unknown command '${program.args.join(' ')}'`)
      );
      console.log(
        `See ${chalk.cyan('taskboard --help')} for a list of available commands.`
      );
      process.exit(1);
    });
    
    // Display banner for the main help screen
    if (process.argv.length <= 2 || 
        (process.argv.length === 3 && ['-h', '--help'].includes(process.argv[2]))) {
      displayBanner();
    }
    
    // Parse command line arguments and execute commands
    await program.parseAsync(process.argv);
    
    // If no commands were matched, show help
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  } catch (error) {
    handleError(error);
  }
}

// Execute main function
main();
```

### 8.2 Board Commands

**`server/cli/commands/boardCommands.ts`:**
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table, getBorderCharacters } from 'table';
import { ServiceFactory } from '@core/services';
import { formatCliError } from '@core/errors/cli';

/**
 * Register board-related CLI commands
 */
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
        const boards = await boardService.getBoards();
        spinner.stop();
        
        if (boards.length === 0) {
          console.log(chalk.yellow('No boards found. Create one with "taskboard board create <name>".'));
          return;
        }
        
        // Format the data for the table
        const tableData = [
          [chalk.cyan('Name'), chalk.cyan('ID'), chalk.cyan('Last Updated')],
          ...boards.map(board => {
            const date = new Date(board.lastUpdated);
            const formattedDate = date.toLocaleString();
            return [
              chalk.white(board.name),
              chalk.gray(board.id),
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
    .command('create <name>')
    .description('Create a new board with the given name')
    .option('-t, --template <template>', 'Template to use for the new board')
    .action(async (name, options) => {
      const spinner = ora(`Creating board "${name}"...`).start();
      
      try {
        const board = await boardService.createBoardFromTemplate(name, options.template);
        spinner.succeed(chalk.green(`Board "${name}" created successfully with ID: ${board.id}`));
        
        console.log(`\nTo view your board: ${chalk.cyan(`taskboard board view ${board.id}`)}`);
      } catch (error) {
        spinner.fail(`Failed to create board "${name}"`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // View board command
  boardCmd
    .command('view <boardId>')
    .description('View a board by ID')
    .option('-f, --format <format>', 'Output format: full, summary, compact, cards-only', 'summary')
    .option('-c, --column <columnId>', 'Filter cards by column ID')
    .action(async (boardId, options) => {
      const spinner = ora(`Loading board ${boardId}...`).start();
      
      try {
        const board = await boardService.getBoard(boardId, {
          format: options.format,
          columnId: options.column
        });
        
        spinner.stop();
        
        if (options.format === 'full') {
          // For full format, pretty-print the JSON
          console.log(JSON.stringify(board, null, 2));
        } else if (options.format === 'summary') {
          // For summary format, show a concise view
          console.log(chalk.cyan(`\n${board.projectName} (${board.id})`));
          console.log(chalk.gray(`Last updated: ${new Date(board.last_updated).toLocaleString()}\n`));
          
          // Show column statistics
          const columnData = [
            [chalk.cyan('Column'), chalk.cyan('Cards')],
            ...board.columns.map(col => [
              chalk.white(col.name),
              chalk.yellow(col.cardCount.toString())
            ])
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
          console.log(`\nProgress: ${chalk.green(board.stats.progressPercentage + '%')} (${board.stats.completedCards}/${board.stats.totalCards} cards completed)`);
        } else if (options.format === 'cards-only') {
          // For cards-only format, show a table of cards
          const cards = board.cards || [];
          
          if (cards.length === 0) {
            console.log(chalk.yellow('No cards found.'));
            return;
          }
          
          const cardData = [
            [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Column'), chalk.cyan('Updated')],
            ...cards.map(card => {
              // Find column name
              const column = board._boardData?.columns?.find(c => c.id === card.columnId)?.name || card.columnId;
              
              return [
                chalk.gray(card.id),
                chalk.white(card.title),
                chalk.yellow(column),
                chalk.gray(new Date(card.updated_at || Date.now()).toLocaleString())
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
        } else {
          // For other formats, pretty-print the JSON
          console.log(JSON.stringify(board, null, 2));
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
        await boardService.deleteBoard(boardId);
        spinner.succeed(chalk.green(`Board ${boardId} deleted successfully`));
      } catch (error) {
        spinner.fail(`Failed to delete board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Archive board command
  boardCmd
    .command('archive <boardId>')
    .description('Archive a board by ID')
    .action(async (boardId) => {
      const spinner = ora(`Archiving board ${boardId}...`).start();
      
      try {
        const result = await boardService.archiveBoard(boardId);
        spinner.succeed(chalk.green(`Board "${result.projectName}" archived successfully`));
      } catch (error) {
        spinner.fail(`Failed to archive board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // List archives command
  boardCmd
    .command('archives')
    .description('List all archived boards')
    .action(async () => {
      const spinner = ora('Fetching archived boards...').start();
      
      try {
        const archives = await boardService.getArchivedBoards();
        spinner.stop();
        
        if (archives.length === 0) {
          console.log(chalk.yellow('No archived boards found.'));
          return;
        }
        
        // Format the data for the table
        const tableData = [
          [chalk.cyan('Name'), chalk.cyan('ID'), chalk.cyan('Archived Date')],
          ...archives.map(board => {
            const date = new Date(board.archivedAt);
            const formattedDate = date.toLocaleString();
            return [
              chalk.white(board.projectName),
              chalk.gray(board.id),
              chalk.gray(formattedDate)
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
        
        console.log(`\nRestore an archived board with: ${chalk.cyan('taskboard board restore <boardId>')}`);
      } catch (error) {
        spinner.fail('Failed to list archived boards');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Restore board command
  boardCmd
    .command('restore <boardId>')
    .description('Restore an archived board by ID')
    .action(async (boardId) => {
      const spinner = ora(`Restoring board ${boardId}...`).start();
      
      try {
        const result = await boardService.restoreBoard(boardId);
        spinner.succeed(chalk.green(`Board "${result.projectName}" restored successfully`));
        
        console.log(`\nView the restored board: ${chalk.cyan(`taskboard board view ${result.id}`)}`);
      } catch (error) {
        spinner.fail(`Failed to restore board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Import board command
  boardCmd
    .command('import <file>')
    .description('Import a board from a JSON file')
    .action(async (file) => {
      const spinner = ora(`Importing board from ${file}...`).start();
      
      try {
        const { readFile } = await import('fs/promises');
        const { resolve } = await import('path');
        
        // Resolve path and read file
        const filePath = resolve(file);
        const data = await readFile(filePath, 'utf8');
        const boardData = JSON.parse(data);
        
        // Import the board
        const board = await boardService.importBoard(boardData);
        
        spinner.succeed(chalk.green(`Board "${board.projectName}" imported successfully with ID: ${board.id}`));
        
        console.log(`\nTo view your board: ${chalk.cyan(`taskboard board view ${board.id}`)}`);
      } catch (error) {
        spinner.fail(`Failed to import board from ${file}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Export board command
  boardCmd
    .command('export <boardId> [file]')
    .description('Export a board to a JSON file')
    .action(async (boardId, file) => {
      const spinner = ora(`Exporting board ${boardId}...`).start();
      
      try {
        const { writeFile } = await import('fs/promises');
        const { resolve } = await import('path');
        
        // Get the board data
        const board = await boardService.getBoard(boardId, { format: 'full' });
        
        // Determine the output file path
        const outputPath = file 
          ? resolve(file) 
          : resolve(`./${board.projectName.replace(/\s+/g, '_')}_${boardId}.json`);
        
        // Write the file
        await writeFile(outputPath, JSON.stringify(board, null, 2));
        
        spinner.succeed(chalk.green(`Board exported successfully to ${outputPath}`));
      } catch (error) {
        spinner.fail(`Failed to export board ${boardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Verify board structure command
  boardCmd
    .command('verify <boardId>')
    .description('Verify the structure and integrity of a board')
    .action(async (boardId) => {
      const spinner = ora(`Verifying board ${boardId}...`).start();
      
      try {
        const result = await boardService.verifyBoard(boardId);
        spinner.stop();
        
        console.log(chalk.cyan(`\nBoard Architecture: ${result.architecture}`));
        console.log(chalk.cyan('Analysis:'));
        console.log(`  Columns: ${chalk.white(result.analysis.totalColumns.toString())}`);
        console.log(`  Cards: ${chalk.white(result.analysis.totalCards.toString())}`);
        
        if (result.architecture === 'column-items') {
          console.log(`  Legacy Items: ${chalk.yellow(result.analysis.totalLegacyItems.toString())}`);
        }
        
        if (result.analysis.orphanedCards > 0) {
          console.log(`  Orphaned Cards: ${chalk.red(result.analysis.orphanedCards.toString())}`);
        }
        
        if (result.analysis.malformedEntities > 0) {
          console.log(`  Malformed Entities: ${chalk.red(result.analysis.malformedEntities.toString())}`);
        }
        
        if (result.recommendations.length > 0) {
          console.log(chalk.cyan('\nRecommendations:'));
          result.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${chalk.yellow(rec)}`);
          });
          
        } else {
          console.log(chalk.green('\nNo issues found. Board structure is valid.'));
        }
      } catch (error) {
        spinner.fail(`Failed to verify board ${boardId}`);
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
      await boardCmd.commands.find(cmd => cmd.name() === 'list')!.action();
    });
  
  // Create shorthand
  program
    .command('create <name>')
    .description('Create a new board with the given name')
    .option('-t, --template <template>', 'Template to use for the new board')
    .action(async (name, options) => {
      await boardCmd.commands.find(cmd => cmd.name() === 'create')!.action(name, options);
    });
  
  // View shorthand
  program
    .command('view <boardId>')
    .description('View a board by ID')
    .option('-f, --format <format>', 'Output format: full, summary, compact, cards-only', 'summary')
    .option('-c, --column <columnId>', 'Filter cards by column ID')
    .action(async (boardId, options) => {
      await boardCmd.commands.find(cmd => cmd.name() === 'view')!.action(boardId, options);
    });
}
```

### 8.3 Card Commands

**`server/cli/commands/cardCommands.ts`:**
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table, getBorderCharacters } from 'table';
import { ServiceFactory } from '@core/services';
import { formatCliError } from '@core/errors/cli';

/**
 * Register card-related CLI commands
 */
export default function registerCardCommands(program: Command, services: ServiceFactory) {
  const cardService = services.getCardService();
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
        const [cards, board] = await Promise.all([
          cardService.getCards(boardId, options.column),
          boardService.getBoard(boardId, { format: 'summary' })
        ]);
        
        spinner.stop();
        
        if (cards.length === 0) {
          console.log(chalk.yellow('No cards found.'));
          return;
        }
        
        // Create a map of column IDs to names
        const columnMap = new Map(
          board.columns.map(col => [col.id, col.name])
        );
        
        // Format the data for the table
        const tableData = [
          [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Column'), chalk.cyan('Tags')],
          ...cards.map(card => {
            const columnName = columnMap.get(card.columnId) || card.columnId;
            const tags = card.tags ? card.tags.join(', ') : '';
            
            return [
              chalk.gray(card.id),
              chalk.white(card.title),
              chalk.yellow(columnName),
              chalk.blue(tags)
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
        const [card, board] = await Promise.all([
          cardService.getCard(boardId, cardId),
          boardService.getBoard(boardId, { format: 'summary' })
        ]);
        
        spinner.stop();
        
        // Find column name
        const columnName = board.columns.find(col => col.id === card.columnId)?.name || card.columnId;
        
        // Display card details
        console.log(chalk.cyan(`\n${card.title} (${card.id})`));
        console.log(chalk.gray(`Column: ${columnName}`));
        console.log(chalk.gray(`Last updated: ${new Date(card.updated_at || Date.now()).toLocaleString()}`));
        
        if (card.tags && card.tags.length > 0) {
          console.log(chalk.blue(`Tags: ${card.tags.join(', ')}`));
        }
        
        if (card.content) {
          console.log(chalk.white('\nContent:'));
          console.log(card.content);
        }
        
        if (card.subtasks && card.subtasks.length > 0) {
          console.log(chalk.yellow('\nSubtasks:'));
          card.subtasks.forEach((task, index) => {
            const isCompleted = task.startsWith('✓') || task.startsWith('✅');
            console.log(`  ${isCompleted ? chalk.green('✓') : chalk.gray('□')} ${task.replace(/^[✓✅]\s*/, '')}`);
          });
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
    .option('--content <content>', 'Card content/description')
    .option('--tags <tags>', 'Comma-separated list of tags')
    .option('-i, --interactive', 'Create card interactively')
    .action(async (boardId, options) => {
      try {
        // Get board to retrieve column information
        const spinner = ora(`Loading board ${boardId}...`).start();
        const board = await boardService.getBoard(boardId, { format: 'summary' });
        spinner.stop();
        
        let title = options.title;
        let columnId = options.column;
        let content = options.content;
        let tags = options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : undefined;
        
        // If interactive mode or missing required fields, prompt for input
        if (options.interactive || !title || !columnId) {
          const { default: inquirer } = await import('inquirer');
          
          // Prepare column choices
          const columnChoices = board.columns.map(col => ({
            name: col.name,
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
          
          if (options.interactive && content === undefined) {
            prompts.push({
              type: 'editor',
              name: 'content',
              message: 'Card content (press i to start editing, ESC then :wq to save):',
            });
          }
          
          if (options.interactive && tags === undefined) {
            prompts.push({
              type: 'input',
              name: 'tags',
              message: 'Tags (comma-separated):',
              filter: (input: string) => 
                input ? input.split(',').map(tag => tag.trim()) : undefined
            });
          }
          
          // Prompt for input
          if (prompts.length > 0) {
            const answers = await inquirer.prompt(prompts);
            title = title || answers.title;
            columnId = columnId || answers.columnId;
            content = content !== undefined ? content : answers.content;
            tags = tags || answers.tags;
          }
        }
        
        // Create card data
        const cardData = {
          title,
          columnId,
          ...(content ? { content } : {}),
          ...(tags && tags.length > 0 ? { tags } : {})
        };
        
        // Create the card
        spinner.text = 'Creating card...';
        spinner.start();
        
        const card = await cardService.createCard(boardId, cardData);
        
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
    .option('-c, --content <content>', 'New card content')
    .option('--tags <tags>', 'Comma-separated list of tags')
    .option('--subtasks <subtasks>', 'Comma-separated list of subtasks')
    .option('-i, --interactive', 'Edit card interactively')
    .action(async (boardId, cardId, options) => {
      try {
        // Get the current card
        const spinner = ora(`Loading card ${cardId}...`).start();
        const card = await cardService.getCard(boardId, cardId);
        spinner.stop();
        
        let title = options.title;
        let content = options.content;
        let tags = options.tags ? options.tags.split(',').map((tag: string) => tag.trim()) : undefined;
        let subtasks = options.subtasks ? options.subtasks.split(',').map((task: string) => task.trim()) : undefined;
        
        // If interactive mode or no fields specified, prompt for input
        if (options.interactive || (!title && content === undefined && tags === undefined && subtasks === undefined)) {
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
              type: 'editor',
              name: 'content',
              message: 'Card content (press i to start editing, ESC then :wq to save):',
              default: card.content || '',
            },
            {
              type: 'input',
              name: 'tags',
              message: 'Tags (comma-separated):',
              default: card.tags ? card.tags.join(', ') : '',
              filter: (input: string) => 
                input ? input.split(',').map(tag => tag.trim()) : []
            },
            {
              type: 'input',
              name: 'subtasks',
              message: 'Subtasks (comma-separated):',
              default: card.subtasks ? card.subtasks.join(', ') : '',
              filter: (input: string) => 
                input ? input.split(',').map(task => task.trim()) : []
            }
          ]);
          
          title = answers.title;
          content = answers.content;
          tags = answers.tags;
          subtasks = answers.subtasks;
        }
        
        // Create update data
        const updateData: any = {};
        
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (tags !== undefined) updateData.tags = tags;
        if (subtasks !== undefined) updateData.subtasks = subtasks;
        
        // Update the card
        spinner.text = 'Updating card...';
        spinner.start();
        
        await cardService.updateCard(boardId, cardId, updateData);
        
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
    .option('-p, --position <position>', 'Position within column (number, "first", or "last")')
    .option('-i, --interactive', 'Move card interactively')
    .action(async (boardId, cardId, options) => {
      try {
        // Get the current card and board
        const spinner = ora(`Loading board and card information...`).start();
        const [card, board] = await Promise.all([
          cardService.getCard(boardId, cardId),
          boardService.getBoard(boardId, { format: 'summary' })
        ]);
        spinner.stop();
        
        let columnId = options.column;
        let position = options.position || 'last';
        
        // If interactive mode or missing required fields, prompt for input
        if (options.interactive || !columnId) {
          const { default: inquirer } = await import('inquirer');
          
          // Prepare column choices
          const columnChoices = board.columns.map(col => ({
            name: col.name,
            value: col.id,
            checked: col.id === card.columnId
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
              type: 'list',
              name: 'position',
              message: 'Select position:',
              choices: [
                { name: 'First position', value: 'first' },
                { name: 'Last position', value: 'last' },
                { name: 'Specific position (number)', value: 'custom' }
              ],
              default: 'last'
            });
          }
          
          // Prompt for input
          if (prompts.length > 0) {
            const answers = await inquirer.prompt(prompts);
            columnId = columnId || answers.columnId;
            
            // If custom position selected, prompt for a number
            if (answers.position === 'custom') {
              const posAnswer = await inquirer.prompt([
                {
                  type: 'number',
                  name: 'customPosition',
                  message: 'Enter position number:',
                  default: 0,
                  validate: (input: number) => input >= 0 ? true : 'Position must be non-negative'
                }
              ]);
              
              position = posAnswer.customPosition;
            } else if (answers.position) {
              position = answers.position;
            }
          }
        }
        
        // Convert position to number if it's a numeric string
        if (typeof position === 'string' && /^\d+$/.test(position)) {
          position = parseInt(position, 10);
        }
        
        // Move the card
        spinner.text = 'Moving card...';
        spinner.start();
        
        await cardService.moveCard(boardId, cardId, columnId, position as any);
        
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
        
        await cardService.deleteCard(boardId, cardId);
        
        spinner.succeed(chalk.green('Card deleted successfully'));
      } catch (error) {
        ora().fail(`Failed to delete card ${cardId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Batch operations command
  cardCmd
    .command('batch <boardId>')
    .description('Perform batch operations on cards')
    .option('-f, --file <file>', 'JSON file containing operations')
    .action(async (boardId, options) => {
      try {
        if (!options.file) {
          console.log(chalk.red('Error: File is required for batch operations.'));
          console.log(`Example: ${chalk.cyan('taskboard card batch <boardId> -f operations.json')}`);
          return;
        }
        
        const { readFile } = await import('fs/promises');
        const { resolve } = await import('path');
        
        // Resolve path and read file
        const filePath = resolve(options.file);
        const spinner = ora(`Reading operations from ${filePath}...`).start();
        
        const data = await readFile(filePath, 'utf8');
        const { operations } = JSON.parse(data);
        
        if (!operations || !Array.isArray(operations)) {
          spinner.fail('Invalid operations file format. Expected { "operations": [...] }');
          return;
        }
        
        spinner.text = `Performing ${operations.length} operations...`;
        
        const result = await cardService.batchOperations(boardId, operations);
        
        if (result.success) {
          spinner.succeed(chalk.green(`Batch operations completed successfully (${result.results.length} operations)`));
          
          // Summary of operations
          const successCount = result.results.filter(r => r.success).length;
          const failCount = result.results.length - successCount;
          
          console.log(`\nResults: ${chalk.green(`${successCount} succeeded`)}, ${failCount > 0 ? chalk.red(`${failCount} failed`) : '0 failed'}`);
          
          if (result.newCards.length > 0) {
            console.log(chalk.cyan(`\nCreated ${result.newCards.length} new cards:`));
            result.newCards.forEach(card => {
              console.log(`  - ${chalk.white(card.title)} (${chalk.gray(card.id)})`);
            });
          }
        } else {
          spinner.fail(chalk.red('Batch operations failed'));
          
          console.log('\nError details:');
          result.results
            .filter(r => !r.success)
            .forEach((r, i) => {
              console.log(`  ${i+1}. ${chalk.red(r.error || 'Unknown error')}`);
            });
        }
      } catch (error) {
        ora().fail('Failed to perform batch operations');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
}
```

### 8.4 Config, Webhook, and Server Commands

**`server/cli/commands/configCommands.ts`:**
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ServiceFactory } from '@core/services';
import { formatCliError } from '@core/errors/cli';

/**
 * Register configuration-related CLI commands
 */
export default function registerConfigCommands(program: Command, services: ServiceFactory) {
  const configService = services.getConfigService();
  
  // Config commands group
  const configCmd = program
    .command('config')
    .description('Manage application configuration');
  
  // Get config command
  configCmd
    .command('get')
    .description('Get the current configuration')
    .action(async () => {
      const spinner = ora('Fetching configuration...').start();
      
      try {
        const config = await configService.getConfig();
        spinner.stop();
        
        // Remove sensitive information if needed
        const safeConfig = {
          ...config,
          // Remove any sensitive fields here
        };
        
        console.log(JSON.stringify(safeConfig, null, 2));
      } catch (error) {
        spinner.fail('Failed to fetch configuration');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Set config command
  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key, value) => {
      const spinner = ora(`Setting ${key}...`).start();
      
      try {
        // Parse the value
        let parsedValue: any = value;
        
        // Try to parse as JSON if it looks like JSON
        if (value.startsWith('{') || value.startsWith('[') || 
            value === 'true' || value === 'false' || !isNaN(Number(value))) {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // If parsing fails, use the string value
          }
        }
        
        // Create update object with nested path support
        const updateData: any = {};
        const parts = key.split('.');
        let current = updateData;
        
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = parsedValue;
        
        // Update config
        const config = await configService.updateConfig(updateData);
        
        spinner.succeed(chalk.green(`Configuration updated: ${key} = ${value}`));
      } catch (error) {
        spinner.fail(`Failed to update configuration`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Reset config command
  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        if (!options.force) {
          const { default: inquirer } = await import('inquirer');
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to reset all configuration to defaults?',
              default: false
            }
          ]);
          
          if (!answer.confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
          }
        }
        
        const spinner = ora('Resetting configuration...').start();
        
        const config = await configService.resetConfig();
        
        spinner.succeed(chalk.green('Configuration reset to defaults'));
      } catch (error) {
        ora().fail('Failed to reset configuration');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
}
```

**`server/cli/commands/webhookCommands.ts`:**
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table, getBorderCharacters } from 'table';
import { ServiceFactory } from '@core/services';
import { formatCliError } from '@core/errors/cli';

/**
 * Register webhook-related CLI commands
 */
export default function registerWebhookCommands(program: Command, services: ServiceFactory) {
  const webhookService = services.getWebhookService();
  
  // Webhook commands group
  const webhookCmd = program
    .command('webhook')
    .description('Manage webhooks')
    .alias('wh');
  
  // List webhooks command
  webhookCmd
    .command('list')
    .description('List all webhooks')
    .alias('ls')
    .action(async () => {
      const spinner = ora('Fetching webhooks...').start();
      
      try {
        const webhooks = await webhookService.getWebhooks();
        spinner.stop();
        
        if (webhooks.length === 0) {
          console.log(chalk.yellow('No webhooks found. Create one with "taskboard webhook create".'));
          return;
        }
        
        // Format the data for the table
        const tableData = [
          [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Event'), chalk.cyan('Status')],
          ...webhooks.map(webhook => {
            const status = webhook.active !== false ? chalk.green('Active') : chalk.gray('Inactive');
            
            return [
              chalk.gray(webhook.id),
              chalk.white(webhook.name),
              chalk.yellow(webhook.event),
              status
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
      } catch (error) {
        spinner.fail('Failed to list webhooks');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Create webhook command
  webhookCmd
    .command('create')
    .description('Create a new webhook')
    .option('-n, --name <name>', 'Webhook name')
    .option('-u, --url <url>', 'Webhook URL')
    .option('-e, --event <event>', 'Event type to trigger webhook')
    .option('-s, --secret <secret>', 'Secret key for webhook signature')
    .option('-i, --interactive', 'Create webhook interactively')
    .action(async (options) => {
      try {
        let name = options.name;
        let url = options.url;
        let event = options.event;
        let secret = options.secret;
        
        // If interactive mode or missing required fields, prompt for input
        if (options.interactive || !name || !url || !event) {
          const { default: inquirer } = await import('inquirer');
          
          // Create prompts for missing information
          const prompts = [];
          
          if (!name) {
            prompts.push({
              type: 'input',
              name: 'name',
              message: 'Webhook name:',
              validate: (input: string) => input.trim().length > 0 ? true : 'Name is required'
            });
          }
          
          if (!url) {
            prompts.push({
              type: 'input',
              name: 'url',
              message: 'Webhook URL:',
              validate: (input: string) => {
                try {
                  new URL(input);
                  return true;
                } catch {
                  return 'Please enter a valid URL';
                }
              }
            });
          }
          
          if (!event) {
            prompts.push({
              type: 'list',
              name: 'event',
              message: 'Event type:',
              choices: [
                'board.created',
                'board.updated',
                'board.deleted',
                'card.created',
                'card.updated',
                'card.moved',
                'card.deleted'
              ]
            });
          }
          
          if (options.interactive && secret === undefined) {
            prompts.push({
              type: 'password',
              name: 'secret',
              message: 'Secret key (optional):',
              mask: '*'
            });
          }
          
          // Prompt for input
          if (prompts.length > 0) {
            const answers = await inquirer.prompt(prompts);
            name = name || answers.name;
            url = url || answers.url;
            event = event || answers.event;
            secret = secret !== undefined ? secret : answers.secret;
          }
        }
        
        // Create webhook data
        const webhookData = {
          name,
          url,
          event,
          ...(secret ? { secret } : {})
        };
        
        // Create the webhook
        const spinner = ora('Creating webhook...').start();
        
        const webhook = await webhookService.createWebhook(webhookData);
        
        spinner.succeed(chalk.green(`Webhook "${name}" created successfully`));
        
        // Test the webhook
        console.log(`\nTest your webhook with: ${chalk.cyan(`taskboard webhook test ${webhook.id}`)}`);
      } catch (error) {
        ora().fail('Failed to create webhook');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // View webhook command
  webhookCmd
    .command('view <webhookId>')
    .description('View a webhook by ID')
    .action(async (webhookId) => {
      const spinner = ora(`Fetching webhook ${webhookId}...`).start();
      
      try {
        const webhook = await webhookService.getWebhook(webhookId);
        spinner.stop();
        
        console.log(chalk.cyan(`\n${webhook.name} (${webhook.id})`));
        console.log(chalk.gray(`URL: ${webhook.url}`));
        console.log(chalk.yellow(`Event: ${webhook.event}`));
        console.log(chalk.gray(`Status: ${webhook.active !== false ? 'Active' : 'Inactive'}`));
        
        if (webhook.created_at) {
          console.log(chalk.gray(`Created: ${new Date(webhook.created_at).toLocaleString()}`));
        }
        
        if (webhook.updated_at) {
          console.log(chalk.gray(`Updated: ${new Date(webhook.updated_at).toLocaleString()}`));
        }
        
        if (webhook.secret) {
          console.log(chalk.gray('Secret: ••••••••'));
        }
        
        console.log(`\nTest this webhook with: ${chalk.cyan(`taskboard webhook test ${webhookId}`)}`);
      } catch (error) {
        spinner.fail(`Failed to fetch webhook ${webhookId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Update webhook command
  webhookCmd
    .command('update <webhookId>')
    .description('Update a webhook')
    .option('-n, --name <name>', 'New webhook name')
    .option('-u, --url <url>', 'New webhook URL')
    .option('-e, --event <event>', 'New event type')
    .option('-s, --secret <secret>', 'New secret key')
    .option('-a, --active <active>', 'Set webhook active state (true/false)')
    .option('-i, --interactive', 'Update webhook interactively')
    .action(async (webhookId, options) => {
      try {
        // Get the current webhook
        const spinner = ora(`Loading webhook ${webhookId}...`).start();
        const webhook = await webhookService.getWebhook(webhookId);
        spinner.stop();
        
        let name = options.name;
        let url = options.url;
        let event = options.event;
        let secret = options.secret;
        let active = options.active !== undefined 
          ? options.active === 'true' || options.active === true
          : undefined;
        
        // If interactive mode or no fields specified, prompt for input
        if (options.interactive || (!name && !url && !event && secret === undefined && active === undefined)) {
          const { default: inquirer } = await import('inquirer');
          
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Webhook name:',
              default: webhook.name,
              validate: (input: string) => input.trim().length > 0 ? true : 'Name is required'
            },
            {
              type: 'input',
              name: 'url',
              message: 'Webhook URL:',
              default: webhook.url,
              validate: (input: string) => {
                try {
                  new URL(input);
                  return true;
                } catch {
                  return 'Please enter a valid URL';
                }
              }
            },
            {
              type: 'list',
              name: 'event',
              message: 'Event type:',
              default: webhook.event,
              choices: [
                'board.created',
                'board.updated',
                'board.deleted',
                'card.created',
                'card.updated',
                'card.moved',
                'card.deleted'
              ]
            },
            {
              type: 'password',
              name: 'secret',
              message: 'Secret key (leave empty to keep current):',
              mask: '*'
            },
            {
              type: 'confirm',
              name: 'active',
              message: 'Is webhook active:',
              default: webhook.active !== false
            }
          ]);
          
          name = answers.name;
          url = answers.url;
          event = answers.event;
          secret = answers.secret || undefined;
          active = answers.active;
        }
        
        // Create update data
        const updateData: any = {};
        
        if (name !== undefined) updateData.name = name;
        if (url !== undefined) updateData.url = url;
        if (event !== undefined) updateData.event = event;
        if (secret !== undefined) updateData.secret = secret;
        if (active !== undefined) updateData.active = active;
        
        // Update the webhook
        spinner.text = 'Updating webhook...';
        spinner.start();
        
        await webhookService.updateWebhook(webhookId, updateData);
        
        spinner.succeed(chalk.green('Webhook updated successfully'));
        
        console.log(`\nTest your webhook with: ${chalk.cyan(`taskboard webhook test ${webhookId}`)}`);
      } catch (error) {
        ora().fail(`Failed to update webhook ${webhookId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Delete webhook command
  webhookCmd
    .command('delete <webhookId>')
    .description('Delete a webhook')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (webhookId, options) => {
      try {
        if (!options.force) {
          const { default: inquirer } = await import('inquirer');
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete webhook ${webhookId}? This action cannot be undone.`,
              default: false
            }
          ]);
          
          if (!answer.confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
          }
        }
        
        const spinner = ora(`Deleting webhook ${webhookId}...`).start();
        
        await webhookService.deleteWebhook(webhookId);
        
        spinner.succeed(chalk.green('Webhook deleted successfully'));
      } catch (error) {
        ora().fail(`Failed to delete webhook ${webhookId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Test webhook command
  webhookCmd
    .command('test <webhookId>')
    .description('Test a webhook by sending a test payload')
    .action(async (webhookId) => {
      const spinner = ora(`Testing webhook ${webhookId}...`).start();
      
      try {
        // Create test payload
        const payload = {
          event: 'webhook.test',
          timestamp: new Date().toISOString(),
          data: {
            message: 'This is a test webhook from TaskBoardAI CLI',
            source: 'CLI'
          }
        };
        
        // Trigger the webhook
        const result = await webhookService.triggerWebhook(webhookId, payload);
        
        if (result.success) {
          spinner.succeed(chalk.green('Webhook test completed successfully'));
          console.log(`Status code: ${chalk.blue(result.statusCode)}`);
          console.log(`Message: ${result.message}`);
        } else {
          spinner.fail(chalk.red('Webhook test failed'));
          console.log(`Status code: ${chalk.red(result.statusCode)}`);
          console.log(`Error: ${result.message}`);
        }
      } catch (error) {
        spinner.fail(`Failed to test webhook ${webhookId}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Test URL command
  webhookCmd
    .command('test-url <url>')
    .description('Test a webhook URL without creating a webhook')
    .action(async (url) => {
      const spinner = ora(`Testing URL ${url}...`).start();
      
      try {
        // Test the connection
        const result = await webhookService.testConnection(url);
        
        if (result.success) {
          spinner.succeed(chalk.green('URL test completed successfully'));
          console.log(`Status code: ${chalk.blue(result.statusCode)}`);
          console.log(`Message: ${result.message}`);
        } else {
          spinner.fail(chalk.red('URL test failed'));
          console.log(`Status code: ${chalk.red(result.statusCode)}`);
          console.log(`Error: ${result.message}`);
        }
      } catch (error) {
        spinner.fail(`Failed to test URL ${url}`);
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
}
```

**`server/cli/commands/serverCommands.ts`:**
```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ServiceFactory } from '@core/services';
import { formatCliError } from '@core/errors/cli';

/**
 * Register server-related CLI commands
 */
export default function registerServerCommands(program: Command, services: ServiceFactory) {
  const serverService = services.getServerService();
  
  // Server commands group
  const serverCmd = program
    .command('server')
    .description('Manage web and MCP servers');
  
  // Start web server command
  serverCmd
    .command('start')
    .description('Start the Kanban web server')
    .option('-p, --port <port>', 'Port to listen on', '3001')
    .option('-d, --detach', 'Run in detached mode (background)')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const spinner = ora(`Starting web server on port ${port}...`).start();
      
      try {
        const result = await serverService.startWebServer({ port });
        
        if (result.success) {
          spinner.succeed(chalk.green(`Web server started on port ${port}`));
          console.log(`You can access the web UI at: ${chalk.cyan(`http://localhost:${port}`)}`);
          
          // If not detached, keep running
          if (!options.detach) {
            console.log('\nPress Ctrl+C to stop the server.');
            
            // Keep the process running
            process.stdin.resume();
            
            // Handle graceful shutdown
            process.on('SIGINT', () => {
              console.log(chalk.yellow('\nStopping web server...'));
              process.exit(0);
            });
          }
        } else {
          spinner.fail(chalk.red('Failed to start web server'));
          console.log(`Reason: ${result.message}`);
        }
      } catch (error) {
        spinner.fail('Failed to start web server');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Check web server status command
  serverCmd
    .command('status')
    .description('Check the status of the Kanban web server')
    .option('-p, --port <port>', 'Port to check', '3001')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const spinner = ora(`Checking web server status on port ${port}...`).start();
      
      try {
        const result = await serverService.checkWebServer({ port });
        spinner.stop();
        
        if (result.running) {
          console.log(chalk.green(`✓ Web server is running on port ${port}`));
          console.log(`You can access the web UI at: ${chalk.cyan(`http://localhost:${port}`)}`);
        } else {
          console.log(chalk.yellow(`✗ No web server detected on port ${port}`));
          console.log(`Start the server with: ${chalk.cyan('taskboard server start')}`);
        }
      } catch (error) {
        spinner.fail('Failed to check web server status');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Start MCP server command
  serverCmd
    .command('start-mcp')
    .description('Start the MCP server for AI agent integration')
    .option('-p, --port <port>', 'Port to listen on')
    .option('-d, --detach', 'Run in detached mode (background)')
    .action(async (options) => {
      const port = options.port ? parseInt(options.port, 10) : undefined;
      const spinner = ora('Starting MCP server...').start();
      
      try {
        const result = await serverService.startMcpServer({ port });
        
        if (result.success) {
          spinner.succeed(chalk.green('MCP server started successfully'));
          
          if (result.port) {
            console.log(`MCP server listening on port: ${chalk.cyan(result.port)}`);
          }
          
          // If not detached, keep running
          if (!options.detach) {
            console.log('\nPress Ctrl+C to stop the server.');
            
            // Keep the process running
            process.stdin.resume();
            
            // Handle graceful shutdown
            process.on('SIGINT', () => {
              console.log(chalk.yellow('\nStopping MCP server...'));
              process.exit(0);
            });
          }
        } else {
          spinner.fail(chalk.red('Failed to start MCP server'));
          console.log(`Reason: ${result.message}`);
        }
      } catch (error) {
        spinner.fail('Failed to start MCP server');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Start all servers command
  serverCmd
    .command('start-all')
    .description('Start both web and MCP servers')
    .option('-p, --port <port>', 'Port for web server', '3001')
    .option('--mcp-port <mcpPort>', 'Port for MCP server')
    .option('-d, --detach', 'Run in detached mode (background)')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const mcpPort = options.mcpPort ? parseInt(options.mcpPort, 10) : undefined;
      
      const spinner = ora('Starting servers...').start();
      
      try {
        // Start both servers
        const [webResult, mcpResult] = await Promise.all([
          serverService.startWebServer({ port }),
          serverService.startMcpServer({ port: mcpPort })
        ]);
        
        spinner.stop();
        
        // Report results
        if (webResult.success) {
          console.log(chalk.green(`✓ Web server started on port ${port}`));
          console.log(`  You can access the web UI at: ${chalk.cyan(`http://localhost:${port}`)}`);
        } else {
          console.log(chalk.red(`✗ Failed to start web server: ${webResult.message}`));
        }
        
        if (mcpResult.success) {
          console.log(chalk.green('✓ MCP server started successfully'));
          
          if (mcpResult.port) {
            console.log(`  MCP server listening on port: ${chalk.cyan(mcpResult.port)}`);
          }
        } else {
          console.log(chalk.red(`✗ Failed to start MCP server: ${mcpResult.message}`));
        }
        
        // If not detached, keep running
        if (!options.detach) {
          console.log('\nPress Ctrl+C to stop all servers.');
          
          // Keep the process running
          process.stdin.resume();
          
          // Handle graceful shutdown
          process.on('SIGINT', () => {
            console.log(chalk.yellow('\nStopping all servers...'));
            process.exit(0);
          });
        }
      } catch (error) {
        spinner.fail('Failed to start servers');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
  
  // Setup command - simplified server setup for first-time users
  program
    .command('setup')
    .description('Set up TaskBoardAI for first use')
    .action(async () => {
      try {
        console.log(chalk.cyan('\n=== TaskBoardAI Setup ===\n'));
        console.log('This will guide you through setting up TaskBoardAI for first use.\n');
        
        const { default: inquirer } = await import('inquirer');
        
        // Ask for preferences
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'boardName',
            message: 'What should we name your first board?',
            default: 'My First Board'
          },
          {
            type: 'number',
            name: 'port',
            message: 'Which port should the web server use?',
            default: 3001,
            validate: (input: number) => 
              input >= 1024 && input <= 65535 ? true : 'Port must be between 1024 and 65535'
          },
          {
            type: 'confirm',
            name: 'startServer',
            message: 'Would you like to start the server after setup?',
            default: true
          }
        ]);
        
        // Create first board
        const spinner = ora('Creating your first board...').start();
        
        try {
          const board = await services.getBoardService().createBoardFromTemplate(answers.boardName);
          spinner.succeed(chalk.green(`Board "${answers.boardName}" created successfully with ID: ${board.id}`));
        } catch (error) {
          spinner.fail('Failed to create board');
          console.error(formatCliError(error).formattedMessage);
          return;
        }
        
        // Start server if requested
        if (answers.startServer) {
          spinner.text = `Starting web server on port ${answers.port}...`;
          spinner.start();
          
          try {
            const result = await serverService.startWebServer({ port: answers.port });
            
            if (result.success) {
              spinner.succeed(chalk.green(`Web server started on port ${answers.port}`));
              console.log(`You can access the web UI at: ${chalk.cyan(`http://localhost:${answers.port}`)}`);
              
              console.log('\nPress Ctrl+C to stop the server.');
              
              // Keep the process running
              process.stdin.resume();
              
              // Handle graceful shutdown
              process.on('SIGINT', () => {
                console.log(chalk.yellow('\nStopping web server...'));
                process.exit(0);
              });
            } else {
              spinner.fail(chalk.red('Failed to start web server'));
              console.log(`Reason: ${result.message}`);
            }
          } catch (error) {
            spinner.fail('Failed to start web server');
            console.error(formatCliError(error).formattedMessage);
          }
        } else {
          console.log(`\nSetup complete! To start the server later, run:\n  ${chalk.cyan(`taskboard server start -p ${answers.port}`)}`);
        }
      } catch (error) {
        console.error(chalk.red('Setup failed:'), error);
      }
    });
}
```

## Expected Outcome
- Complete CLI interface using the unified service layer
- Feature parity with MCP and REST API interfaces
- Interactive and user-friendly command line experience
- Consistent error handling and output formatting
- Strong validation and input management
- Helpful help text and examples
- Command autocompletion support
- Support for common use cases and workflows