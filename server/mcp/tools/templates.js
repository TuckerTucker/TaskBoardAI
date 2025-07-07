/**
 * MCP tools related to templates: board templates, column templates, card templates
 */

const { z } = require('zod');
const { ServiceFactory } = require('../../cli/ServiceFactory');

function registerTemplateTools(server, { config, checkRateLimit }) {
  
  // Board Template Tools
  server.tool(
    'get-board-templates',
    {},
    async () => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const templates = await templateService.getAllBoardTemplates();
        
        const responseData = {
          success: true,
          data: {
            templates,
            count: templates.length
          },
          help: `Found ${templates.length} board templates. You can use these templates to create new boards quickly with the create-board-from-template tool.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in get-board-templates tool:', error);
        return {
          content: [{ type: 'text', text: `Error retrieving board templates: ${error.message}` }],
          isError: true
        };
      }
    },
    'Get all board templates available for creating new boards'
  );

  server.tool(
    'get-board-template',
    {
      name: z.string().min(1, 'Template name is required').describe('The name of the board template to retrieve')
    },
    async ({ name }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const template = await templateService.getBoardTemplateByName(name);
        
        const responseData = {
          success: true,
          data: {
            template
          },
          help: `Retrieved board template: ${template.name}. You can create a new board using this template with the create-board-from-template tool.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in get-board-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error retrieving board template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Get a specific board template by its name'
  );

  server.tool(
    'create-board-template',
    {
      template: z.object({
        name: z.string().min(1, 'Template name is required'),
        description: z.string().optional(),
        category: z.string().optional(),
        title: z.string().min(1, 'Board title is required'),
        boardDescription: z.string().optional(),
        columns: z.array(z.object({
          title: z.string().min(1, 'Column title is required'),
          wipLimit: z.number().int().positive().optional(),
          cards: z.array(z.object({
            title: z.string().min(1, 'Card title is required'),
            description: z.string().optional(),
            priority: z.enum(['low', 'medium', 'high']).default('medium'),
            status: z.string().default('pending'),
            assignee: z.string().optional(),
            tags: z.array(z.string()).default([]),
            dueDate: z.string().optional()
          })).optional().default([])
        })).min(1, 'At least one column is required'),
        tags: z.array(z.string()).default([]),
        settings: z.record(z.any()).optional().default({})
      }).describe('The board template data to create')
    },
    async ({ template }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const savedTemplate = await templateService.createBoardTemplate(template);
        
        const responseData = {
          success: true,
          data: {
            template: savedTemplate
          },
          help: `Created new board template: ${savedTemplate.name}. You can now use this template to create new boards with create-board-from-template.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in create-board-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error creating board template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new board template that can be used to quickly create boards with predefined structure'
  );

  server.tool(
    'create-board-from-template',
    {
      templateName: z.string().min(1, 'Template name is required').describe('The name of the template to use for creating the board')
    },
    async ({ templateName }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const board = await templateService.createBoardFromTemplate(templateName);
        
        const responseData = {
          success: true,
          data: {
            board,
            templateName
          },
          help: `Created a new board from template: ${templateName}. The new board ID is ${board.id} with title "${board.title}".`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in create-board-from-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error creating board from template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new board using an existing board template'
  );

  server.tool(
    'extract-board-template',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('The ID of the board to use as a template'),
      templateName: z.string().min(1, 'Template name is required').describe('The name for the new template'),
      description: z.string().optional().describe('Optional description for the template')
    },
    async ({ boardId, templateName, description }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const template = await templateService.extractTemplateFromBoard(
          boardId, 
          templateName, 
          description
        );
        
        const responseData = {
          success: true,
          data: {
            template,
            boardId
          },
          help: `Created a new board template "${templateName}" from board ${boardId}. You can now use this template to create similar boards.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in extract-board-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error extracting board template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new template from an existing board, capturing its structure and content'
  );

  server.tool(
    'delete-board-template',
    {
      name: z.string().min(1, 'Template name is required').describe('The name of the board template to delete')
    },
    async ({ name }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        await templateService.deleteBoardTemplate(name);
        
        const responseData = {
          success: true,
          data: {
            name,
            deleted: true
          },
          help: `Deleted board template: ${name}.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in delete-board-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error deleting board template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Delete a board template by its name'
  );

  // Column Template Tools
  server.tool(
    'get-column-templates',
    {},
    async () => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const templates = await templateService.getAllColumnTemplates();
        
        const responseData = {
          success: true,
          data: {
            templates,
            count: templates.length
          },
          help: `Found ${templates.length} column templates. You can use these templates to quickly add columns to boards with create-column-from-template.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in get-column-templates tool:', error);
        return {
          content: [{ type: 'text', text: `Error retrieving column templates: ${error.message}` }],
          isError: true
        };
      }
    },
    'Get all column templates available for creating new columns'
  );

  server.tool(
    'create-column-from-template',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('The ID of the board to add the column to'),
      templateName: z.string().min(1, 'Template name is required').describe('The name of the template to use')
    },
    async ({ boardId, templateName }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const column = await templateService.createColumnFromTemplate(boardId, templateName);
        
        const responseData = {
          success: true,
          data: {
            column,
            boardId,
            templateName
          },
          help: `Created a new column from template: ${templateName} in board ${boardId}. The new column ID is ${column.id}.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in create-column-from-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error creating column from template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new column in a board using an existing column template'
  );

  server.tool(
    'extract-column-template',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('The ID of the board containing the column'),
      columnId: z.string().min(1, 'Column ID is required').describe('The ID of the column to use as a template'),
      templateName: z.string().min(1, 'Template name is required').describe('The name for the new template'),
      description: z.string().optional().describe('Optional description for the template')
    },
    async ({ boardId, columnId, templateName, description }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const template = await templateService.extractTemplateFromColumn(
          boardId, 
          columnId, 
          templateName, 
          description
        );
        
        const responseData = {
          success: true,
          data: {
            template,
            boardId,
            columnId
          },
          help: `Created a new column template "${templateName}" from column ${columnId} in board ${boardId}.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in extract-column-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error extracting column template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new template from an existing column, capturing its structure and cards'
  );

  // Card Template Tools
  server.tool(
    'get-card-templates',
    {},
    async () => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const templates = await templateService.getAllCardTemplates();
        
        const responseData = {
          success: true,
          data: {
            templates,
            count: templates.length
          },
          help: `Found ${templates.length} card templates. You can use these templates to quickly create cards with create-card-from-template.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in get-card-templates tool:', error);
        return {
          content: [{ type: 'text', text: `Error retrieving card templates: ${error.message}` }],
          isError: true
        };
      }
    },
    'Get all card templates available for creating new cards'
  );

  server.tool(
    'create-card-from-template',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('The ID of the board to add the card to'),
      columnId: z.string().min(1, 'Column ID is required').describe('The ID of the column to add the card to'),
      templateName: z.string().min(1, 'Template name is required').describe('The name of the template to use')
    },
    async ({ boardId, columnId, templateName }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const card = await templateService.createCardFromTemplate(boardId, columnId, templateName);
        
        const responseData = {
          success: true,
          data: {
            card,
            boardId,
            columnId,
            templateName
          },
          help: `Created a new card from template: ${templateName} in column ${columnId} of board ${boardId}. The new card ID is ${card.id}.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in create-card-from-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error creating card from template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new card in a column using an existing card template'
  );

  server.tool(
    'extract-card-template',
    {
      boardId: z.string().min(1, 'Board ID is required').describe('The ID of the board containing the card'),
      cardId: z.string().min(1, 'Card ID is required').describe('The ID of the card to use as a template'),
      templateName: z.string().min(1, 'Template name is required').describe('The name for the new template'),
      description: z.string().optional().describe('Optional description for the template')
    },
    async ({ boardId, cardId, templateName, description }) => {
      try {
        checkRateLimit();
        
        const serviceFactory = ServiceFactory.getInstance();
        const templateService = serviceFactory.getTemplateService();
        
        const template = await templateService.extractTemplateFromCard(
          boardId, 
          cardId, 
          templateName, 
          description
        );
        
        const responseData = {
          success: true,
          data: {
            template,
            boardId,
            cardId
          },
          help: `Created a new card template "${templateName}" from card ${cardId} in board ${boardId}.`
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(responseData, null, 2) }]
        };
      } catch (error) {
        console.error('Error in extract-card-template tool:', error);
        return {
          content: [{ type: 'text', text: `Error extracting card template: ${error.message}` }],
          isError: true
        };
      }
    },
    'Create a new template from an existing card, capturing its content and properties'
  );
}

module.exports = { registerTemplateTools };