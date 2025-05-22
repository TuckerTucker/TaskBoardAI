import { Command } from 'commander';
import { ServiceFactory } from '../../core/factories/ServiceFactory.js';
import { ObservableLogger } from '../../core/utils/observability.js';
import { MetricsCollector } from '../../core/utils/observability.js';
import { PerformanceTracker } from '../../core/utils/observability.js';
import { HealthChecker } from '../../core/utils/observability.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const observableLogger = ObservableLogger.getInstance();
const metricsCollector = MetricsCollector.getInstance();
const performanceTracker = PerformanceTracker.getInstance();
const healthChecker = HealthChecker.getInstance();

export function createDiagnosticCommands(): Command {
  const diagnosticCmd = new Command('diagnostic')
    .alias('diag')
    .description('System diagnostics and monitoring commands');

  diagnosticCmd
    .command('system')
    .alias('sys')
    .description('Display system information')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const systemInfo = await getSystemInformation();
        
        if (options.json) {
          console.log(JSON.stringify(systemInfo, null, 2));
        } else {
          displaySystemInfo(systemInfo);
        }
      } catch (error) {
        observableLogger.error('Failed to get system information', { error: error.message });
        console.error(chalk.red('Error getting system information:'), error.message);
        process.exit(1);
      }
    });

  diagnosticCmd
    .command('health')
    .description('Run health checks')
    .option('--json', 'Output in JSON format')
    .option('--detailed', 'Show detailed health information')
    .action(async (options) => {
      try {
        const healthResults = await healthChecker.runHealthChecks();
        const systemMetrics = metricsCollector.getSystemMetrics();
        
        if (options.json) {
          console.log(JSON.stringify({ health: healthResults, metrics: systemMetrics }, null, 2));
        } else {
          displayHealthInfo(healthResults, systemMetrics, options.detailed);
        }
      } catch (error) {
        observableLogger.error('Failed to run health checks', { error: error.message });
        console.error(chalk.red('Error running health checks:'), error.message);
        process.exit(1);
      }
    });

  diagnosticCmd
    .command('metrics')
    .description('Display application metrics')
    .option('--json', 'Output in JSON format')
    .option('--category <category>', 'Filter by metrics category')
    .action(async (options) => {
      try {
        const allMetrics = metricsCollector.getAllMetrics();
        const filteredMetrics = options.category 
          ? { [options.category]: allMetrics[options.category] }
          : allMetrics;
        
        if (options.json) {
          console.log(JSON.stringify(filteredMetrics, null, 2));
        } else {
          displayMetrics(filteredMetrics);
        }
      } catch (error) {
        observableLogger.error('Failed to get metrics', { error: error.message });
        console.error(chalk.red('Error getting metrics:'), error.message);
        process.exit(1);
      }
    });

  diagnosticCmd
    .command('performance')
    .alias('perf')
    .description('Display performance statistics')
    .option('--json', 'Output in JSON format')
    .option('--operation <operation>', 'Filter by operation name')
    .action(async (options) => {
      try {
        const perfStats = performanceTracker.getPerformanceStats();
        const filteredStats = options.operation
          ? { [options.operation]: perfStats[options.operation] }
          : perfStats;
        
        if (options.json) {
          console.log(JSON.stringify(filteredStats, null, 2));
        } else {
          displayPerformanceStats(filteredStats);
        }
      } catch (error) {
        observableLogger.error('Failed to get performance stats', { error: error.message });
        console.error(chalk.red('Error getting performance statistics:'), error.message);
        process.exit(1);
      }
    });

  diagnosticCmd
    .command('logs')
    .description('View recent logs')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .option('--level <level>', 'Filter by log level (error, warn, info, debug)')
    .option('--json', 'Output in JSON format')
    .option('--follow', 'Follow log output (like tail -f)')
    .action(async (options) => {
      try {
        if (options.follow) {
          await followLogs(options);
        } else {
          await displayRecentLogs(options);
        }
      } catch (error) {
        observableLogger.error('Failed to read logs', { error: error.message });
        console.error(chalk.red('Error reading logs:'), error.message);
        process.exit(1);
      }
    });

  diagnosticCmd
    .command('errors')
    .description('Display error summary and recent errors')
    .option('--json', 'Output in JSON format')
    .option('--detailed', 'Show detailed error information')
    .option('--since <time>', 'Show errors since specified time (e.g., "1h", "24h", "7d")')
    .action(async (options) => {
      try {
        const errorSummary = await getErrorSummary(options.since);
        
        if (options.json) {
          console.log(JSON.stringify(errorSummary, null, 2));
        } else {
          displayErrorSummary(errorSummary, options.detailed);
        }
      } catch (error) {
        observableLogger.error('Failed to get error summary', { error: error.message });
        console.error(chalk.red('Error getting error summary:'), error.message);
        process.exit(1);
      }
    });

  return diagnosticCmd;
}

async function getSystemInformation() {
  const serviceFactory = ServiceFactory.getInstance();
  
  return {
    application: {
      name: 'TaskBoardAI',
      version: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      pid: process.pid
    },
    system: {
      hostname: os.hostname(),
      type: os.type(),
      release: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      loadAverage: os.loadavg()
    },
    memory: {
      rss: process.memoryUsage().rss,
      heapTotal: process.memoryUsage().heapTotal,
      heapUsed: process.memoryUsage().heapUsed,
      external: process.memoryUsage().external
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };
}

function displaySystemInfo(systemInfo: any) {
  console.log(chalk.cyan.bold('\n📊 System Information\n'));
  
  const appTable = new Table({
    head: ['Property', 'Value'],
    colWidths: [20, 50]
  });
  
  appTable.push(
    ['Name', systemInfo.application.name],
    ['Version', systemInfo.application.version],
    ['Node.js', systemInfo.application.nodeVersion],
    ['Platform', `${systemInfo.application.platform} (${systemInfo.application.arch})`],
    ['Uptime', `${Math.floor(systemInfo.application.uptime / 3600)}h ${Math.floor((systemInfo.application.uptime % 3600) / 60)}m`],
    ['PID', systemInfo.application.pid.toString()]
  );
  
  console.log(chalk.yellow('Application:'));
  console.log(appTable.toString());
  
  const sysTable = new Table({
    head: ['Property', 'Value'],
    colWidths: [20, 50]
  });
  
  sysTable.push(
    ['Hostname', systemInfo.system.hostname],
    ['OS', `${systemInfo.system.type} ${systemInfo.system.release}`],
    ['CPUs', systemInfo.system.cpus.toString()],
    ['Total Memory', `${Math.round(systemInfo.system.totalMemory / 1024 / 1024 / 1024 * 100) / 100} GB`],
    ['Free Memory', `${Math.round(systemInfo.system.freeMemory / 1024 / 1024 / 1024 * 100) / 100} GB`],
    ['Load Average', systemInfo.system.loadAverage.map(l => l.toFixed(2)).join(', ')]
  );
  
  console.log(chalk.yellow('\nSystem:'));
  console.log(sysTable.toString());
  
  const memTable = new Table({
    head: ['Type', 'Memory (MB)'],
    colWidths: [20, 15]
  });
  
  memTable.push(
    ['RSS', Math.round(systemInfo.memory.rss / 1024 / 1024)],
    ['Heap Total', Math.round(systemInfo.memory.heapTotal / 1024 / 1024)],
    ['Heap Used', Math.round(systemInfo.memory.heapUsed / 1024 / 1024)],
    ['External', Math.round(systemInfo.memory.external / 1024 / 1024)]
  );
  
  console.log(chalk.yellow('\nMemory Usage:'));
  console.log(memTable.toString());
}

function displayHealthInfo(healthResults: any, systemMetrics: any, detailed: boolean) {
  console.log(chalk.cyan.bold('\n🏥 Health Check Results\n'));
  
  const healthTable = new Table({
    head: ['Component', 'Status', 'Response Time'],
    colWidths: [20, 15, 15]
  });
  
  Object.entries(healthResults).forEach(([component, result]: [string, any]) => {
    const status = result.healthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy');
    healthTable.push([component, status, `${result.responseTime}ms`]);
  });
  
  console.log(healthTable.toString());
  
  if (detailed) {
    console.log(chalk.yellow('\nSystem Metrics:'));
    const metricsTable = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 20]
    });
    
    Object.entries(systemMetrics).forEach(([key, value]: [string, any]) => {
      metricsTable.push([key, typeof value === 'object' ? JSON.stringify(value) : value.toString()]);
    });
    
    console.log(metricsTable.toString());
  }
}

function displayMetrics(metrics: any) {
  console.log(chalk.cyan.bold('\n📈 Application Metrics\n'));
  
  Object.entries(metrics).forEach(([category, categoryMetrics]: [string, any]) => {
    console.log(chalk.yellow(`${category.toUpperCase()}:`));
    
    const table = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 30]
    });
    
    Object.entries(categoryMetrics).forEach(([metric, value]: [string, any]) => {
      table.push([metric, typeof value === 'object' ? JSON.stringify(value, null, 2) : value.toString()]);
    });
    
    console.log(table.toString());
    console.log();
  });
}

function displayPerformanceStats(perfStats: any) {
  console.log(chalk.cyan.bold('\n⚡ Performance Statistics\n'));
  
  const table = new Table({
    head: ['Operation', 'Count', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'P95 (ms)'],
    colWidths: [25, 10, 12, 12, 12, 12]
  });
  
  Object.entries(perfStats).forEach(([operation, stats]: [string, any]) => {
    table.push([
      operation,
      stats.count.toString(),
      stats.average.toFixed(2),
      stats.min.toString(),
      stats.max.toString(),
      stats.p95.toFixed(2)
    ]);
  });
  
  console.log(table.toString());
}

async function displayRecentLogs(options: any) {
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'combined.log');
  
  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const recentLines = lines.slice(-parseInt(options.lines));
    
    let filteredLines = recentLines;
    if (options.level) {
      filteredLines = recentLines.filter(line => line.includes(`"level":"${options.level}"`));
    }
    
    if (options.json) {
      const parsedLines = filteredLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, timestamp: new Date().toISOString() };
        }
      });
      console.log(JSON.stringify(parsedLines, null, 2));
    } else {
      console.log(chalk.cyan.bold('\n📝 Recent Logs\n'));
      filteredLines.forEach(line => {
        try {
          const logEntry = JSON.parse(line);
          const timestamp = new Date(logEntry.timestamp).toLocaleString();
          const level = logEntry.level.toUpperCase();
          const levelColor = getLogLevelColor(logEntry.level);
          console.log(`${chalk.gray(timestamp)} ${levelColor(level.padEnd(5))} ${logEntry.message}`);
          if (logEntry.error) {
            console.log(chalk.red(`  Error: ${logEntry.error}`));
          }
        } catch {
          console.log(line);
        }
      });
    }
  } catch (error) {
    console.error(chalk.red('Could not read log file:'), error.message);
  }
}

async function followLogs(options: any) {
  console.log(chalk.cyan('Following logs... Press Ctrl+C to stop\n'));
  
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'combined.log');
  
  // Simple file watching implementation
  let lastSize = 0;
  
  const checkForNewLogs = async () => {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > lastSize) {
        const content = await fs.readFile(logFile, 'utf-8');
        const newContent = content.slice(lastSize);
        const newLines = newContent.split('\n').filter(line => line.trim());
        
        newLines.forEach(line => {
          try {
            const logEntry = JSON.parse(line);
            const timestamp = new Date(logEntry.timestamp).toLocaleString();
            const level = logEntry.level.toUpperCase();
            const levelColor = getLogLevelColor(logEntry.level);
            console.log(`${chalk.gray(timestamp)} ${levelColor(level.padEnd(5))} ${logEntry.message}`);
          } catch {
            console.log(line);
          }
        });
        
        lastSize = stats.size;
      }
    } catch (error) {
      // File might not exist yet, ignore
    }
  };
  
  // Check for new logs every second
  const interval = setInterval(checkForNewLogs, 1000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(chalk.yellow('\nStopped following logs.'));
    process.exit(0);
  });
}

async function getErrorSummary(since?: string) {
  const logDir = path.join(process.cwd(), 'logs');
  const errorLogFile = path.join(logDir, 'error.log');
  
  let sinceTime = new Date(0);
  if (since) {
    const timeMatch = since.match(/^(\d+)([hmd])$/);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      const unit = timeMatch[2];
      const now = new Date();
      
      switch (unit) {
        case 'h':
          sinceTime = new Date(now.getTime() - value * 60 * 60 * 1000);
          break;
        case 'd':
          sinceTime = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
          break;
        case 'm':
          sinceTime = new Date(now.getTime() - value * 60 * 1000);
          break;
      }
    }
  }
  
  try {
    const content = await fs.readFile(errorLogFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const errors = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(entry => entry && entry.level === 'error')
      .filter(entry => new Date(entry.timestamp) >= sinceTime);
    
    const errorCounts: Record<string, number> = {};
    const recentErrors = errors.slice(-10);
    
    errors.forEach(error => {
      const errorType = error.error || error.message || 'Unknown Error';
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });
    
    return {
      totalErrors: errors.length,
      errorCounts,
      recentErrors,
      timeRange: {
        since: sinceTime.toISOString(),
        until: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      totalErrors: 0,
      errorCounts: {},
      recentErrors: [],
      timeRange: { since: sinceTime.toISOString(), until: new Date().toISOString() },
      error: 'Could not read error log file'
    };
  }
}

function displayErrorSummary(errorSummary: any, detailed: boolean) {
  console.log(chalk.cyan.bold('\n🚨 Error Summary\n'));
  
  console.log(chalk.yellow(`Total Errors: ${errorSummary.totalErrors}`));
  console.log(chalk.gray(`Time Range: ${new Date(errorSummary.timeRange.since).toLocaleString()} - ${new Date(errorSummary.timeRange.until).toLocaleString()}\n`));
  
  if (Object.keys(errorSummary.errorCounts).length > 0) {
    console.log(chalk.yellow('Error Frequency:'));
    const errorTable = new Table({
      head: ['Error Type', 'Count'],
      colWidths: [50, 10]
    });
    
    Object.entries(errorSummary.errorCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .forEach(([error, count]) => {
        errorTable.push([error, count.toString()]);
      });
    
    console.log(errorTable.toString());
  }
  
  if (detailed && errorSummary.recentErrors.length > 0) {
    console.log(chalk.yellow('\nRecent Errors:'));
    errorSummary.recentErrors.forEach((error: any, index: number) => {
      console.log(chalk.red(`${index + 1}. ${new Date(error.timestamp).toLocaleString()}`));
      console.log(chalk.gray(`   ${error.message}`));
      if (error.error) {
        console.log(chalk.gray(`   ${error.error}`));
      }
      console.log();
    });
  }
}

function getLogLevelColor(level: string) {
  switch (level.toLowerCase()) {
    case 'error':
      return chalk.red;
    case 'warn':
      return chalk.yellow;
    case 'info':
      return chalk.green;
    case 'debug':
      return chalk.blue;
    default:
      return chalk.white;
  }
}