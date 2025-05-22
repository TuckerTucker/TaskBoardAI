export interface Card {
  id: string;
  title: string;
  description?: string;
  position: number;
  columnId: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  title: string;
  position: number;
  wipLimit?: number;
  color?: string;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  columns: Column[];
  cards: Card[];
  settings: BoardSettings;
  createdAt: string;
  updatedAt: string;
}

export interface BoardSettings {
  allowWipLimitExceeding: boolean;
  showCardCount: boolean;
  enableDragDrop: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface Config {
  server: ServerConfig;
  defaults: DefaultsConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  enableCors: boolean;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface DefaultsConfig {
  board: {
    columns: string[];
    settings: BoardSettings;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

export interface FilterParams {
  tags?: string[];
  priority?: string[];
  assignee?: string;
  dueDate?: {
    from?: string;
    to?: string;
  };
}