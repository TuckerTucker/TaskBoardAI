import { v4 as uuidv4 } from 'uuid';
import { Card, Column, Board, BoardSettings, CreateCard, CreateColumn, CreateBoard } from './validation';
import { DEFAULT_BOARD_SETTINGS, DEFAULT_COLUMNS } from './constants';

export class EntityFactory {
  static createCard(data: CreateCard, columnId?: string): Card {
    const now = new Date().toISOString();
    
    return {
      id: uuidv4(),
      title: data.title,
      description: data.description,
      position: 0, // Will be set by service layer
      columnId: columnId || data.columnId,
      tags: data.tags || [],
      priority: data.priority || 'medium',
      assignee: data.assignee,
      dueDate: data.dueDate,
      createdAt: now,
      updatedAt: now
    };
  }

  static createColumn(data: CreateColumn, position: number): Column {
    return {
      id: uuidv4(),
      title: data.title,
      position,
      wipLimit: data.wipLimit,
      color: data.color
    };
  }

  static createBoard(data: CreateBoard): Board {
    const now = new Date().toISOString();
    const boardId = uuidv4();
    
    // Create default columns if none provided
    const columnTitles = data.columns || [...DEFAULT_COLUMNS];
    const columns = columnTitles.map((title, index) => 
      this.createColumn({ title }, index)
    );

    return {
      id: boardId,
      title: data.title,
      description: data.description,
      columns,
      cards: [],
      settings: {
        ...DEFAULT_BOARD_SETTINGS,
        ...data.settings
      },
      createdAt: now,
      updatedAt: now
    };
  }

  static createDefaultBoardSettings(): BoardSettings {
    return { ...DEFAULT_BOARD_SETTINGS };
  }

  static updateTimestamp<T extends { updatedAt: string }>(entity: T): T {
    return {
      ...entity,
      updatedAt: new Date().toISOString()
    };
  }

  static reorderItems<T extends { position: number }>(
    items: T[],
    fromPosition: number,
    toPosition: number
  ): T[] {
    const result = [...items];
    const [movedItem] = result.splice(fromPosition, 1);
    result.splice(toPosition, 0, movedItem);
    
    // Update positions
    return result.map((item, index) => ({
      ...item,
      position: index
    }));
  }

  static insertAtPosition<T extends { position: number }>(
    items: T[],
    newItem: T,
    position: number
  ): T[] {
    const result = [...items];
    
    // Insert at specified position
    result.splice(position, 0, newItem);
    
    // Update all positions
    return result.map((item, index) => ({
      ...item,
      position: index
    }));
  }

  static removeAtPosition<T extends { position: number }>(
    items: T[],
    position: number
  ): T[] {
    const result = [...items];
    result.splice(position, 1);
    
    // Update positions
    return result.map((item, index) => ({
      ...item,
      position: index
    }));
  }

  static normalizePositions<T extends { position: number }>(items: T[]): T[] {
    return items
      .sort((a, b) => a.position - b.position)
      .map((item, index) => ({
        ...item,
        position: index
      }));
  }

  static cloneEntity<T>(entity: T): T {
    return JSON.parse(JSON.stringify(entity));
  }

  static generateNextPosition<T extends { position: number }>(items: T[]): number {
    if (items.length === 0) return 0;
    return Math.max(...items.map(item => item.position)) + 1;
  }
}