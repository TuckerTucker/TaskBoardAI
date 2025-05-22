import chalk from 'chalk';
import { AppError, ErrorFormatter } from './index';

export interface CliError {
  code: number;
  formattedMessage: string;
}

export function formatCliError(error: unknown): CliError {
  const formatted = ErrorFormatter.formatError(error);
  
  let code = 1; // Default error code
  let message = formatted.message;
  
  // Map status codes to exit codes
  if (formatted.statusCode) {
    switch (formatted.statusCode) {
      case 400:
        code = 2; // Invalid input
        break;
      case 401:
        code = 3; // Unauthorized
        break;
      case 403:
        code = 4; // Forbidden
        break;
      case 404:
        code = 5; // Not found
        break;
      case 409:
        code = 6; // Conflict
        break;
      case 429:
        code = 7; // Rate limited
        break;
      case 500:
      default:
        code = 1; // General error
        break;
    }
  }
  
  // Format the message with colors
  let formattedMessage = chalk.red('Error: ') + message;
  
  // Add additional context for development
  if (process.env.NODE_ENV === 'development' && formatted.details) {
    formattedMessage += chalk.gray('\n\nDetails: ' + JSON.stringify(formatted.details, null, 2));
  }
  
  return {
    code,
    formattedMessage
  };
}