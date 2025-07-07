import { z } from 'zod';
import { ValidationError } from '@core/errors';
import { REGEX_PATTERNS, VALIDATION_LIMITS } from './constants';

export class ValidationHelper {
  static validateUUID(value: string, fieldName: string = 'id'): string {
    if (!REGEX_PATTERNS.UUID.test(value)) {
      throw new ValidationError(`Invalid ${fieldName}: must be a valid UUID`);
    }
    return value;
  }

  static validateRequired<T>(value: T | undefined | null, fieldName: string): T {
    if (value === undefined || value === null) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return value;
  }

  static validatePositiveNumber(value: number, fieldName: string): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new ValidationError(`${fieldName} must be a non-negative integer`);
    }
    return value;
  }

  static validateStringLength(
    value: string, 
    fieldName: string, 
    min: number = 1, 
    max: number = 255
  ): string {
    if (value.length < min || value.length > max) {
      throw new ValidationError(
        `${fieldName} must be between ${min} and ${max} characters`
      );
    }
    return value;
  }

  static validateDateTimeISO(value: string, fieldName: string): string {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date.toISOString();
    } catch {
      throw new ValidationError(`${fieldName} must be a valid ISO datetime string`);
    }
  }

  static validateEnum<T extends readonly string[]>(
    value: string, 
    enumValues: T, 
    fieldName: string
  ): T[number] {
    if (!enumValues.includes(value as T[number])) {
      throw new ValidationError(
        `${fieldName} must be one of: ${enumValues.join(', ')}`
      );
    }
    return value as T[number];
  }

  static validateArrayUnique<T>(array: T[], fieldName: string): T[] {
    const unique = [...new Set(array)];
    if (unique.length !== array.length) {
      throw new ValidationError(`${fieldName} must contain unique values`);
    }
    return array;
  }

  static validateHexColor(value: string, fieldName: string): string {
    if (!REGEX_PATTERNS.HEX_COLOR.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid hex color (e.g., #FF5733)`);
    }
    return value;
  }
}

export function createSafeParser<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const errorMessages = result.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      throw new ValidationError(`Validation failed: ${errorMessages}`, result.error.errors);
    }
    return result.data;
  };
}

export function createAsyncSafeParser<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown): Promise<T> => {
    const result = await schema.safeParseAsync(data);
    if (!result.success) {
      const errorMessages = result.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      throw new ValidationError(`Validation failed: ${errorMessages}`, result.error.errors);
    }
    return result.data;
  };
}

export const validatePositionInArray = (position: number, arrayLength: number): void => {
  if (position < 0 || position >= arrayLength) {
    throw new ValidationError(
      `Position ${position} is invalid. Must be between 0 and ${arrayLength - 1}`
    );
  }
};

export const validateWipLimit = (currentCount: number, wipLimit?: number): void => {
  if (wipLimit !== undefined && currentCount >= wipLimit) {
    throw new ValidationError(
      `WIP limit exceeded. Current: ${currentCount}, Limit: ${wipLimit}`,
      { currentCount, wipLimit }
    );
  }
};

export const validateUniqueTitle = (title: string, existingTitles: string[]): void => {
  if (existingTitles.includes(title)) {
    throw new ValidationError(`Title '${title}' already exists`);
  }
};