const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Get the home directory for the user
const homeDir = os.homedir();
const dataDir = path.join(homeDir, '.taskboardai');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure boards directory exists
const userBoardsDir = path.join(dataDir, 'boards');
if (!fs.existsSync(userBoardsDir)) {
  fs.mkdirSync(userBoardsDir, { recursive: true });
}

// Ensure config directory exists
const userConfigDir = path.join(dataDir, 'config');
if (!fs.existsSync(userConfigDir)) {
  fs.mkdirSync(userConfigDir, { recursive: true });
}

// Ensure webhooks directory exists
const userWebhooksDir = path.join(dataDir, 'webhooks');
if (!fs.existsSync(userWebhooksDir)) {
  fs.mkdirSync(userWebhooksDir, { recursive: true });
}

// Detect package location
const packageRoot = path.join(__dirname, '../..');
const isRunningFromPackage = fs.existsSync(path.join(packageRoot, 'package.json'));

// OVERRIDE: Always use the local boards directory for development
const localBoardsDir = path.join(packageRoot, 'boards');

// Environment variables and defaults
const config = {
    port: process.env.PORT || 3001,
    boardFile: process.env.BOARD_FILE || 'kanban.json',
    configFile: process.env.CONFIG_FILE || 'config.json',
    
    // Directories - package directories (for static assets, templates, etc.)
    rootDir: packageRoot,
    appDir: path.join(packageRoot, 'app'),
    
    // User data directories (for storing user's boards, configs, webhooks)
    userDataDir: dataDir,
    boardsDir: localBoardsDir, // OVERRIDE: Always use local boards directory
    configDir: process.env.USE_LOCAL_CONFIG ? path.join(packageRoot, 'config') : userConfigDir,
    webhooksDir: process.env.USE_LOCAL_WEBHOOKS ? path.join(packageRoot, 'webhooks') : userWebhooksDir,
    
    // Template directories (read-only, included in package)
    templateBoardsDir: path.join(packageRoot, 'boards'),
    
    // Static directories
    staticDirs: {
        css: path.join(packageRoot, 'app/css'),
        js: path.join(packageRoot, 'app/js'),
        img: path.join(packageRoot, 'app/public'),
        public: path.join(packageRoot, 'app/public')
    }
};

// Handle board file path
const isBoardAbsolutePath = path.isAbsolute(config.boardFile);
const hasBoardJsonExt = config.boardFile.toLowerCase().endsWith('.json');

// Set final data file path
if (process.env.BOARD_FILE) {
    // If the environment variable was explicitly set
    if (isBoardAbsolutePath) {
        // Use the absolute path directly
        config.dataFile = hasBoardJsonExt ? config.boardFile : `${config.boardFile}.json`;
    } else {
        // For relative paths, we check if we are running from the project directory
        // or from an installed package
        const normalizedBoardFile = hasBoardJsonExt ? config.boardFile : `${config.boardFile}.json`;
        
        // First check if the file exists in the current working directory
        const cwdPath = path.join(process.cwd(), normalizedBoardFile);
        if (fs.existsSync(cwdPath)) {
            config.dataFile = cwdPath;
        } else {
            // Then check if it exists in the user's boards directory
            const userPath = path.join(config.boardsDir, normalizedBoardFile);
            if (fs.existsSync(userPath)) {
                config.dataFile = userPath;
            } else {
                // Finally, check if it exists in the package's boards directory
                const packagePath = path.join(config.templateBoardsDir, normalizedBoardFile);
                if (fs.existsSync(packagePath)) {
                    config.dataFile = packagePath;
                } else {
                    // Default to the user's boards directory, even if the file doesn't exist yet
                    config.dataFile = userPath;
                }
            }
        }
    }
} else {
    // No environment variable set, use default from user's board directory
    const normalizedBoardFile = hasBoardJsonExt ? config.boardFile : `${config.boardFile}.json`;
    const userPath = path.join(config.boardsDir, normalizedBoardFile);
    
    // Copy default board if it doesn't exist
    if (!fs.existsSync(userPath) && config.boardFile === 'kanban.json') {
        const templatePath = path.join(config.templateBoardsDir, '_kanban_example.json');
        if (fs.existsSync(templatePath)) {
            try {
                fs.copyFileSync(templatePath, userPath);
                console.log(`Created default board at ${userPath}`);
            } catch (err) {
                console.error(`Failed to create default board: ${err.message}`);
            }
        }
    }
    
    config.dataFile = userPath;
}

// Handle config file path
const isConfigAbsolutePath = path.isAbsolute(config.configFile);
const hasConfigJsonExt = config.configFile.toLowerCase().endsWith('.json');

// Set final config file path
if (process.env.CONFIG_FILE) {
    // If the environment variable was explicitly set
    if (isConfigAbsolutePath) {
        // Use the absolute path directly
        config.configDataFile = hasConfigJsonExt ? config.configFile : `${config.configFile}.json`;
    } else {
        // For relative paths in installed package
        const normalizedConfigFile = hasConfigJsonExt ? config.configFile : `${config.configFile}.json`;
        
        // First check if the file exists in the current working directory
        const cwdPath = path.join(process.cwd(), normalizedConfigFile);
        if (fs.existsSync(cwdPath)) {
            config.configDataFile = cwdPath;
        } else {
            // Then check if it exists in the user's config directory
            const userPath = path.join(config.configDir, normalizedConfigFile);
            if (fs.existsSync(userPath)) {
                config.configDataFile = userPath;
            } else {
                // Finally, check if it exists in the package's config directory
                const packagePath = path.join(packageRoot, 'config', normalizedConfigFile);
                if (fs.existsSync(packagePath)) {
                    config.configDataFile = packagePath;
                } else {
                    // Default to the user's config directory
                    config.configDataFile = userPath;
                }
            }
        }
    }
} else {
    // No environment variable set, use default from user's config directory
    const normalizedConfigFile = hasConfigJsonExt ? config.configFile : `${config.configFile}.json`;
    const userPath = path.join(config.configDir, normalizedConfigFile);
    
    // Copy default config if it doesn't exist
    if (!fs.existsSync(userPath)) {
        const templatePath = path.join(packageRoot, 'config', normalizedConfigFile);
        if (fs.existsSync(templatePath)) {
            try {
                fs.copyFileSync(templatePath, userPath);
                console.log(`Created default config at ${userPath}`);
            } catch (err) {
                console.error(`Failed to create default config: ${err.message}`);
            }
        }
    }
    
    config.configDataFile = userPath;
}

console.log('Using boards directory:', config.boardsDir);

module.exports = config;