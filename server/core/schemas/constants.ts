export const PRIORITY_LEVELS = ['low', 'medium', 'high'] as const;
export const THEME_OPTIONS = ['light', 'dark', 'auto'] as const;

export const DEFAULT_BOARD_SETTINGS = {
  allowWipLimitExceeding: false,
  showCardCount: true,
  enableDragDrop: true,
  theme: 'light'
} as const;

export const DEFAULT_COLUMNS = [
  'To Do',
  'In Progress', 
  'Done'
] as const;

export const DEFAULT_SERVER_CONFIG = {
  port: 3001,
  host: 'localhost',
  enableCors: true,
  corsOrigins: ['*'],
  rateLimit: {
    windowMs: 900000, // 15 minutes
    maxRequests: 100
  }
} as const;

export const VALIDATION_LIMITS = {
  CARD_TITLE_MAX: 200,
  CARD_TITLE_MIN: 1,
  COLUMN_TITLE_MAX: 100,
  COLUMN_TITLE_MIN: 1,
  BOARD_TITLE_MAX: 100,
  BOARD_TITLE_MIN: 1,
  WIP_LIMIT_MIN: 1,
  PAGE_SIZE_MIN: 1,
  PAGE_SIZE_MAX: 100,
  PAGE_SIZE_DEFAULT: 20,
  PORT_MIN: 1000,
  PORT_MAX: 65535,
  RATE_LIMIT_WINDOW_MIN: 1000
} as const;

export const REGEX_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  HEX_COLOR: /^#[0-9A-F]{6}$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DATETIME_ISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BOARD_NOT_FOUND: 'BOARD_NOT_FOUND',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  COLUMN_NOT_FOUND: 'COLUMN_NOT_FOUND',
  INVALID_POSITION: 'INVALID_POSITION',
  WIP_LIMIT_EXCEEDED: 'WIP_LIMIT_EXCEEDED',
  DUPLICATE_TITLE: 'DUPLICATE_TITLE'
} as const;