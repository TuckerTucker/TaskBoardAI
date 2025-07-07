import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ServiceFactory } from '../ServiceFactory';
import { formatCliError } from '@core/errors/cli';

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
        const config = await configService.getDefault();
        spinner.stop();
        
        console.log(JSON.stringify(config, null, 2));
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
        await configService.update('default', updateData);
        
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
        
        await configService.reset();
        
        spinner.succeed(chalk.green('Configuration reset to defaults'));
      } catch (error) {
        ora().fail('Failed to reset configuration');
        const { formattedMessage } = formatCliError(error);
        console.error(formattedMessage);
      }
    });
}