import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { ServiceFactory } from '../ServiceFactory.js';
import { CreateBoardTemplate, CreateColumnTemplate, CreateCardTemplate } from '../core/schemas/templateSchemas.js';

const serviceFactory = ServiceFactory.getInstance();
const templateService = serviceFactory.getTemplateService();

export function createTemplateCommands(): Command {
  const program = new Command();

  program
    .name('template')
    .description('Template management commands')
    .alias('t');

  // Board template commands
  const boardCmd = program
    .command('board')
    .description('Board template operations')
    .alias('b');

  boardCmd
    .command('list')
    .description('List all board templates')
    .alias('ls')
    .action(async () => {
      const spinner = ora('Loading board templates...').start();
      try {
        const templates = await templateService.getAllBoardTemplates();
        spinner.stop();

        if (templates.length === 0) {
          console.log(chalk.yellow('No board templates found.'));
          return;
        }

        const table = new Table({
          head: ['ID', 'Name', 'Description', 'Columns', 'Default'].map(h => chalk.bold(h))
        });

        templates.forEach(template => {
          table.push([
            template.id,
            template.name,
            template.description || '',
            template.columns.length.toString(),
            template.isDefault ? chalk.green('Yes') : chalk.gray('No')
          ]);
        });

        console.log(table.toString());
      } catch (error) {
        spinner.fail(`Failed to load board templates: ${error.message}`);
      }
    });

  boardCmd
    .command('create')
    .description('Create a new board template')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Template name:',
            validate: input => input.trim() ? true : 'Template name is required'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Template description (optional):'
          },
          {
            type: 'input',
            name: 'category',
            message: 'Template category (optional):'
          },
          {
            type: 'confirm',
            name: 'isDefault',
            message: 'Set as default template?',
            default: false
          },
          {
            type: 'input',
            name: 'title',
            message: 'Board title:',
            validate: input => input.trim() ? true : 'Board title is required'
          },
          {
            type: 'input',
            name: 'boardDescription',
            message: 'Board description (optional):'
          },
          {
            type: 'input',
            name: 'columns',
            message: 'Column titles (comma-separated):',
            filter: input => input.split(',').map(s => s.trim()).filter(Boolean),
            validate: input => input.length > 0 ? true : 'At least one column is required'
          }
        ]);

        const columnTemplates = answers.columns.map((title: string, index: number) => ({
          title,
          description: '',
          wip: null,
          position: index
        }));

        const templateData: CreateBoardTemplate = {
          name: answers.name,
          description: answers.description || undefined,
          category: answers.category || undefined,
          isDefault: answers.isDefault,
          title: answers.title,
          boardDescription: answers.boardDescription || undefined,
          columns: columnTemplates
        };

        const spinner = ora('Creating board template...').start();
        const template = await templateService.createBoardTemplate(templateData);
        spinner.succeed(`Board template "${template.name}" created successfully!`);
      } catch (error) {
        console.error(chalk.red(`Failed to create board template: ${error.message}`));
      }
    });

  boardCmd
    .command('from-board <boardId>')
    .description('Extract a template from an existing board')
    .option('-n, --name <name>', 'Template name')
    .option('-d, --description <description>', 'Template description')
    .action(async (boardId, options) => {
      try {
        let templateName = options.name;
        let templateDescription = options.description;

        if (!templateName) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Template name:',
              validate: input => input.trim() ? true : 'Template name is required'
            },
            {
              type: 'input',
              name: 'description',
              message: 'Template description (optional):'
            }
          ]);
          templateName = answers.name;
          templateDescription = answers.description;
        }

        const spinner = ora('Extracting board template...').start();
        const template = await templateService.extractBoardTemplate(boardId, templateName, templateDescription);
        spinner.succeed(`Board template "${template.name}" extracted successfully!`);
      } catch (error) {
        console.error(chalk.red(`Failed to extract board template: ${error.message}`));
      }
    });

  boardCmd
    .command('use <templateName>')
    .description('Create a new board from a template')
    .action(async (templateName) => {
      try {
        const spinner = ora('Creating board from template...').start();
        const board = await templateService.createBoardFromTemplate(templateName);
        spinner.succeed(`Board "${board.title}" created from template "${templateName}"!`);
        console.log(chalk.blue(`Board ID: ${board.id}`));
      } catch (error) {
        console.error(chalk.red(`Failed to create board from template: ${error.message}`));
      }
    });

  boardCmd
    .command('delete <templateId>')
    .description('Delete a board template')
    .action(async (templateId) => {
      try {
        const template = await templateService.getBoardTemplate(templateId);
        if (!template) {
          console.error(chalk.red('Board template not found.'));
          return;
        }

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete template "${template.name}"?`,
            default: false
          }
        ]);

        if (!confirm) {
          console.log('Template deletion cancelled.');
          return;
        }

        const spinner = ora('Deleting board template...').start();
        await templateService.deleteBoardTemplate(templateId);
        spinner.succeed('Board template deleted successfully!');
      } catch (error) {
        console.error(chalk.red(`Failed to delete board template: ${error.message}`));
      }
    });

  // Column template commands
  const columnCmd = program
    .command('column')
    .description('Column template operations')
    .alias('c');

  columnCmd
    .command('list')
    .description('List all column templates')
    .alias('ls')
    .action(async () => {
      const spinner = ora('Loading column templates...').start();
      try {
        const templates = await templateService.getAllColumnTemplates();
        spinner.stop();

        if (templates.length === 0) {
          console.log(chalk.yellow('No column templates found.'));
          return;
        }

        const table = new Table({
          head: ['ID', 'Name', 'Title', 'WIP Limit', 'Default'].map(h => chalk.bold(h))
        });

        templates.forEach(template => {
          table.push([
            template.id,
            template.name,
            template.title,
            template.wip?.toString() || 'None',
            template.isDefault ? chalk.green('Yes') : chalk.gray('No')
          ]);
        });

        console.log(table.toString());
      } catch (error) {
        spinner.fail(`Failed to load column templates: ${error.message}`);
      }
    });

  columnCmd
    .command('create')
    .description('Create a new column template')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Template name:',
            validate: input => input.trim() ? true : 'Template name is required'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Template description (optional):'
          },
          {
            type: 'input',
            name: 'category',
            message: 'Template category (optional):'
          },
          {
            type: 'confirm',
            name: 'isDefault',
            message: 'Set as default template?',
            default: false
          },
          {
            type: 'input',
            name: 'title',
            message: 'Column title:',
            validate: input => input.trim() ? true : 'Column title is required'
          },
          {
            type: 'input',
            name: 'columnDescription',
            message: 'Column description (optional):'
          },
          {
            type: 'number',
            name: 'wip',
            message: 'WIP limit (optional, press Enter to skip):'
          }
        ]);

        const templateData: CreateColumnTemplate = {
          name: answers.name,
          description: answers.description || undefined,
          category: answers.category || undefined,
          isDefault: answers.isDefault,
          title: answers.title,
          columnDescription: answers.columnDescription || undefined,
          wip: answers.wip || null
        };

        const spinner = ora('Creating column template...').start();
        const template = await templateService.createColumnTemplate(templateData);
        spinner.succeed(`Column template "${template.name}" created successfully!`);
      } catch (error) {
        console.error(chalk.red(`Failed to create column template: ${error.message}`));
      }
    });

  // Card template commands
  const cardCmd = program
    .command('card')
    .description('Card template operations');

  cardCmd
    .command('list')
    .description('List all card templates')
    .alias('ls')
    .action(async () => {
      const spinner = ora('Loading card templates...').start();
      try {
        const templates = await templateService.getAllCardTemplates();
        spinner.stop();

        if (templates.length === 0) {
          console.log(chalk.yellow('No card templates found.'));
          return;
        }

        const table = new Table({
          head: ['ID', 'Name', 'Title', 'Priority', 'Default'].map(h => chalk.bold(h))
        });

        templates.forEach(template => {
          table.push([
            template.id,
            template.name,
            template.title,
            template.priority,
            template.isDefault ? chalk.green('Yes') : chalk.gray('No')
          ]);
        });

        console.log(table.toString());
      } catch (error) {
        spinner.fail(`Failed to load card templates: ${error.message}`);
      }
    });

  cardCmd
    .command('create')
    .description('Create a new card template')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Template name:',
            validate: input => input.trim() ? true : 'Template name is required'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Template description (optional):'
          },
          {
            type: 'input',
            name: 'category',
            message: 'Template category (optional):'
          },
          {
            type: 'confirm',
            name: 'isDefault',
            message: 'Set as default template?',
            default: false
          },
          {
            type: 'input',
            name: 'title',
            message: 'Card title:',
            validate: input => input.trim() ? true : 'Card title is required'
          },
          {
            type: 'list',
            name: 'priority',
            message: 'Priority:',
            choices: ['low', 'medium', 'high'],
            default: 'medium'
          },
          {
            type: 'input',
            name: 'cardDescription',
            message: 'Card description (optional):'
          },
          {
            type: 'input',
            name: 'tags',
            message: 'Tags (comma-separated, optional):',
            filter: input => input ? input.split(',').map(s => s.trim()).filter(Boolean) : []
          }
        ]);

        const templateData: CreateCardTemplate = {
          name: answers.name,
          description: answers.description || undefined,
          category: answers.category || undefined,
          isDefault: answers.isDefault,
          title: answers.title,
          priority: answers.priority,
          cardDescription: answers.cardDescription || undefined,
          tags: answers.tags
        };

        const spinner = ora('Creating card template...').start();
        const template = await templateService.createCardTemplate(templateData);
        spinner.succeed(`Card template "${template.name}" created successfully!`);
      } catch (error) {
        console.error(chalk.red(`Failed to create card template: ${error.message}`));
      }
    });

  cardCmd
    .command('use <templateName> <boardId> <columnId>')
    .description('Create a new card from a template')
    .action(async (templateName, boardId, columnId) => {
      try {
        const spinner = ora('Creating card from template...').start();
        const card = await templateService.createCardFromTemplate(boardId, columnId, templateName);
        spinner.succeed(`Card "${card.title}" created from template "${templateName}"!`);
        console.log(chalk.blue(`Card ID: ${card.id}`));
      } catch (error) {
        console.error(chalk.red(`Failed to create card from template: ${error.message}`));
      }
    });

  // Initialize default templates
  program
    .command('init')
    .description('Initialize default template library')
    .action(async () => {
      try {
        const spinner = ora('Initializing default templates...').start();
        await templateService.initializeDefaultTemplates();
        spinner.succeed('Default templates initialized successfully!');
        console.log(chalk.green('\nDefault templates are now available:'));
        console.log(chalk.blue('• Board templates: Basic Project, Agile Sprint, Bug Tracking, Content Creation, Personal Tasks'));
        console.log(chalk.blue('• Column templates: To Do, In Progress, Done, Backlog, Review, Blocked'));
        console.log(chalk.blue('• Card templates: Basic Task, User Story, Bug Report, Feature Request, Research Task, etc.'));
        console.log(chalk.gray('\nUse "taskboard template <type> list" to see all available templates.'));
      } catch (error) {
        console.error(chalk.red(`Failed to initialize default templates: ${error.message}`));
      }
    });

  return program;
}