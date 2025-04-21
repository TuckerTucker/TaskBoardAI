# Implementation Plan: Card Tools for MCP Server

## 1. Implement `get-card` Tool
- Description: Retrieve a specific card by ID from a board.
- Parameters: `boardId` (string), `cardId` (string)
- Functionality:
  - Load the board.
  - Find the card by ID.
  - Return card data with column info.
  - Log invocation and errors.

## 2. Implement `update-card` Tool
- Description: Update properties of a specific card.
- Parameters: `boardId` (string), `cardId` (string), `cardData` (JSON string)
- Functionality:
  - Parse and validate `cardData`.
  - Load the board.
  - Backup board before update.
  - Find and update the card.
  - Save the board.
  - Return updated card data.
  - Log invocation and errors.

## 3. Implement `move-card` Tool
- Description: Move a card to a different column or position.
- Parameters: `boardId` (string), `cardId` (string), `columnId` (string), `position` (number or enum)
- Functionality:
  - Load the board.
  - Backup board before move.
  - Find the card.
  - Adjust positions of other cards.
  - Update card's column and position.
  - Save the board.
  - Return new card position info.
  - Log invocation and errors.

## 4. Implement `batch-cards` Tool
- Description: Batch update and move multiple cards atomically.
- Parameters: `boardId` (string), `operations` (array of update/move ops)
- Functionality:
  - Load the board.
  - Backup board before batch.
  - Validate all operations.
  - Apply all updates and moves.
  - Save the board.
  - Return results of all operations.
  - Log invocation and errors.

## 5. Add Descriptions and Logging
- For each tool, add a clear human-readable description.
- Log tool invocation, parameters, success, and errors.

## 6. Test All Card Tools
- Verify correct registration.
- Test success and error cases.
- Confirm logs and outputs.

---

This plan will ensure robust, well-documented, and maintainable card management tools in the MCP server.
