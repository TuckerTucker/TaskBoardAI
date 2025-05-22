import express from 'express';
import { TemplateController } from '../controllers/templateController.js';

const router = express.Router();

// Board Templates
router.get('/boards', TemplateController.getAllBoardTemplates);
router.get('/boards/:id', TemplateController.getBoardTemplate);
router.post('/boards', TemplateController.createBoardTemplate);
router.put('/boards/:id', TemplateController.updateBoardTemplate);
router.delete('/boards/:id', TemplateController.deleteBoardTemplate);

// Board Template Actions
router.post('/boards/:templateName/create-board', TemplateController.createBoardFromTemplate);
router.post('/boards/extract/:boardId', TemplateController.extractBoardTemplate);

// Column Templates
router.get('/columns', TemplateController.getAllColumnTemplates);
router.get('/columns/:id', TemplateController.getColumnTemplate);
router.post('/columns', TemplateController.createColumnTemplate);
router.put('/columns/:id', TemplateController.updateColumnTemplate);
router.delete('/columns/:id', TemplateController.deleteColumnTemplate);

// Column Template Actions
router.post('/columns/extract/:boardId/:columnId', TemplateController.extractColumnTemplate);

// Card Templates
router.get('/cards', TemplateController.getAllCardTemplates);
router.get('/cards/:id', TemplateController.getCardTemplate);
router.post('/cards', TemplateController.createCardTemplate);
router.put('/cards/:id', TemplateController.updateCardTemplate);
router.delete('/cards/:id', TemplateController.deleteCardTemplate);

// Card Template Actions
router.post('/cards/:templateName/create-card/:boardId/:columnId', TemplateController.createCardFromTemplate);
router.post('/cards/extract/:boardId/:cardId', TemplateController.extractCardTemplate);

export default router;