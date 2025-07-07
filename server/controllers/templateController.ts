import { Request, Response } from 'express';
import { ServiceFactory } from '../cli/ServiceFactory.js';
import { 
  CreateBoardTemplateSchema, 
  CreateColumnTemplateSchema, 
  CreateCardTemplateSchema,
  UpdateBoardTemplateSchema,
  UpdateColumnTemplateSchema,
  UpdateCardTemplateSchema
} from '../core/schemas/templateSchemas.js';
import { ZodError } from 'zod';

const serviceFactory = ServiceFactory.getInstance();
const templateService = serviceFactory.getTemplateService();

export class TemplateController {
  // Board Templates
  static async getAllBoardTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await templateService.getAllBoardTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error getting board templates:', error);
      res.status(500).json({ error: 'Failed to get board templates' });
    }
  }

  static async getBoardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await templateService.getBoardTemplate(id);
      if (!template) {
        res.status(404).json({ error: 'Board template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      console.error('Error getting board template:', error);
      res.status(500).json({ error: 'Failed to get board template' });
    }
  }

  static async createBoardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData = CreateBoardTemplateSchema.parse(req.body);
      const template = await templateService.createBoardTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid template data', details: error.errors });
        return;
      }
      console.error('Error creating board template:', error);
      res.status(500).json({ error: 'Failed to create board template' });
    }
  }

  static async updateBoardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = UpdateBoardTemplateSchema.parse(req.body);
      const template = await templateService.updateBoardTemplate(id, updateData);
      if (!template) {
        res.status(404).json({ error: 'Board template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid template data', details: error.errors });
        return;
      }
      console.error('Error updating board template:', error);
      res.status(500).json({ error: 'Failed to update board template' });
    }
  }

  static async deleteBoardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await templateService.deleteBoardTemplate(id);
      if (!success) {
        res.status(404).json({ error: 'Board template not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting board template:', error);
      res.status(500).json({ error: 'Failed to delete board template' });
    }
  }

  static async createBoardFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateName } = req.params;
      const board = await templateService.createBoardFromTemplate(templateName);
      res.status(201).json(board);
    } catch (error) {
      console.error('Error creating board from template:', error);
      res.status(500).json({ error: 'Failed to create board from template' });
    }
  }

  static async extractBoardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { boardId } = req.params;
      const { templateName, description } = req.body;
      const template = await templateService.extractBoardTemplate(boardId, templateName, description);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error extracting board template:', error);
      res.status(500).json({ error: 'Failed to extract board template' });
    }
  }

  // Column Templates
  static async getAllColumnTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await templateService.getAllColumnTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error getting column templates:', error);
      res.status(500).json({ error: 'Failed to get column templates' });
    }
  }

  static async getColumnTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await templateService.getColumnTemplate(id);
      if (!template) {
        res.status(404).json({ error: 'Column template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      console.error('Error getting column template:', error);
      res.status(500).json({ error: 'Failed to get column template' });
    }
  }

  static async createColumnTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData = CreateColumnTemplateSchema.parse(req.body);
      const template = await templateService.createColumnTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid template data', details: error.errors });
        return;
      }
      console.error('Error creating column template:', error);
      res.status(500).json({ error: 'Failed to create column template' });
    }
  }

  static async updateColumnTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = UpdateColumnTemplateSchema.parse(req.body);
      const template = await templateService.updateColumnTemplate(id, updateData);
      if (!template) {
        res.status(404).json({ error: 'Column template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid template data', details: error.errors });
        return;
      }
      console.error('Error updating column template:', error);
      res.status(500).json({ error: 'Failed to update column template' });
    }
  }

  static async deleteColumnTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await templateService.deleteColumnTemplate(id);
      if (!success) {
        res.status(404).json({ error: 'Column template not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting column template:', error);
      res.status(500).json({ error: 'Failed to delete column template' });
    }
  }

  static async extractColumnTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { boardId, columnId } = req.params;
      const { templateName, description } = req.body;
      const template = await templateService.extractColumnTemplate(boardId, columnId, templateName, description);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error extracting column template:', error);
      res.status(500).json({ error: 'Failed to extract column template' });
    }
  }

  // Card Templates
  static async getAllCardTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await templateService.getAllCardTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error getting card templates:', error);
      res.status(500).json({ error: 'Failed to get card templates' });
    }
  }

  static async getCardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await templateService.getCardTemplate(id);
      if (!template) {
        res.status(404).json({ error: 'Card template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      console.error('Error getting card template:', error);
      res.status(500).json({ error: 'Failed to get card template' });
    }
  }

  static async createCardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData = CreateCardTemplateSchema.parse(req.body);
      const template = await templateService.createCardTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid template data', details: error.errors });
        return;
      }
      console.error('Error creating card template:', error);
      res.status(500).json({ error: 'Failed to create card template' });
    }
  }

  static async updateCardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = UpdateCardTemplateSchema.parse(req.body);
      const template = await templateService.updateCardTemplate(id, updateData);
      if (!template) {
        res.status(404).json({ error: 'Card template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Invalid template data', details: error.errors });
        return;
      }
      console.error('Error updating card template:', error);
      res.status(500).json({ error: 'Failed to update card template' });
    }
  }

  static async deleteCardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await templateService.deleteCardTemplate(id);
      if (!success) {
        res.status(404).json({ error: 'Card template not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting card template:', error);
      res.status(500).json({ error: 'Failed to delete card template' });
    }
  }

  static async createCardFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { boardId, columnId, templateName } = req.params;
      const card = await templateService.createCardFromTemplate(boardId, columnId, templateName);
      res.status(201).json(card);
    } catch (error) {
      console.error('Error creating card from template:', error);
      res.status(500).json({ error: 'Failed to create card from template' });
    }
  }

  static async extractCardTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { boardId, cardId } = req.params;
      const { templateName, description } = req.body;
      const template = await templateService.extractCardTemplate(boardId, cardId, templateName, description);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error extracting card template:', error);
      res.status(500).json({ error: 'Failed to extract card template' });
    }
  }
}