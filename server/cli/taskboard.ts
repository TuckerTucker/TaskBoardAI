#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { ServiceFactory } from './ServiceFactory';
import { formatCliError } from '@core/errors/cli';
import { logger } from '@core/utils';

// Initialize services
const serviceFactory = ServiceFactory.getInstance();

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
      .version(packageJson.version || '2.0.0')
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
    const { createTemplateCommands } = require('./commands/templates');
    const { createDiagnosticCommands } = require('./commands/diagnosticCommands');
    
    // Register commands
    registerBoardCommands(program, serviceFactory);
    registerCardCommands(program, serviceFactory);
    registerConfigCommands(program, serviceFactory);
    program.addCommand(createTemplateCommands());
    program.addCommand(createDiagnosticCommands());
    
    // Add help text at the bottom
    program.addHelpText('after', `
Examples:
  $ taskboard list                           # List all boards
  $ taskboard create "My New Board"          # Create a new board
  $ taskboard view d79be631-dd8f-4d91-9fdd   # View a board
  $ taskboard card create --help             # Get help for creating cards
  $ taskboard template board list            # List board templates
  $ taskboard template board use "Project"   # Create board from template
  $ taskboard diagnostic health              # Check application health
  $ taskboard diagnostic logs -n 100         # View recent logs
  
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