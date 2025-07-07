import { z } from 'zod';

export const CardTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isDefault: z.boolean().default(false),
  title: z.string().min(1, "Card title is required"),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.string().default('pending'),
  assignee: z.string().optional(),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().optional()
});

export const ColumnTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isDefault: z.boolean().default(false),
  title: z.string().min(1, "Column title is required"),
  wipLimit: z.number().int().positive().optional(),
  cards: z.array(CardTemplateSchema.omit({ 
    name: true, 
    description: true, 
    category: true, 
    isDefault: true 
  })).optional().default([])
});

export const BoardTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isDefault: z.boolean().default(false),
  title: z.string().min(1, "Board title is required"),
  boardDescription: z.string().optional(),
  columns: z.array(ColumnTemplateSchema.omit({ 
    name: true, 
    description: true, 
    category: true, 
    isDefault: true 
  })).min(1, "At least one column is required"),
  tags: z.array(z.string()).default([]),
  settings: z.record(z.any()).optional().default({})
});

export const CreateCardTemplateSchema = CardTemplateSchema;
export const UpdateCardTemplateSchema = CardTemplateSchema.partial().extend({
  name: z.string().min(1, "Template name is required")
});

export const CreateColumnTemplateSchema = ColumnTemplateSchema;
export const UpdateColumnTemplateSchema = ColumnTemplateSchema.partial().extend({
  name: z.string().min(1, "Template name is required")
});

export const CreateBoardTemplateSchema = BoardTemplateSchema;
export const UpdateBoardTemplateSchema = BoardTemplateSchema.partial().extend({
  name: z.string().min(1, "Template name is required")
});

export type CardTemplate = z.infer<typeof CardTemplateSchema>;
export type ColumnTemplate = z.infer<typeof ColumnTemplateSchema>;
export type BoardTemplate = z.infer<typeof BoardTemplateSchema>;

export type CreateCardTemplate = z.infer<typeof CreateCardTemplateSchema>;
export type UpdateCardTemplate = z.infer<typeof UpdateCardTemplateSchema>;

export type CreateColumnTemplate = z.infer<typeof CreateColumnTemplateSchema>;
export type UpdateColumnTemplate = z.infer<typeof UpdateColumnTemplateSchema>;

export type CreateBoardTemplate = z.infer<typeof CreateBoardTemplateSchema>;
export type UpdateBoardTemplate = z.infer<typeof UpdateBoardTemplateSchema>;