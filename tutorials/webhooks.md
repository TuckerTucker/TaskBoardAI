# Using Webhooks with TaskBoardAI

This tutorial explains how to integrate TaskBoardAI with other services using webhooks.

## What are Webhooks?

Webhooks allow TaskBoardAI to notify other services when certain events occur. For example, you can:

- Send board updates to a chat application
- Trigger CI/CD pipelines when cards move to specific columns
- Log board activities to external monitoring systems
- Integrate with custom automation workflows

## Available Webhook Events

TaskBoardAI supports the following webhook events:

- `board.update`: Triggered when a board is updated
- `card.create`: Triggered when a new card is created
- `card.update`: Triggered when a card is updated
- `card.move`: Triggered when a card is moved between columns
- `card.delete`: Triggered when a card is deleted

## Setting Up a Webhook

### 1. Create a Webhook Endpoint

First, you need a service that can receive webhook payloads. This could be:

- A custom server endpoint you create
- A service like Zapier or IFTTT
- A serverless function (AWS Lambda, Google Cloud Functions, etc.)

Your endpoint should:
- Accept HTTP POST requests
- Parse JSON payloads
- Return a 200 status code to acknowledge receipt

### 2. Register the Webhook

You can register webhooks through the TaskBoardAI API:

```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Notification Webhook",
    "url": "https://example.com/my-webhook-endpoint",
    "event": "board.update"
  }'
```

### 3. Test the Webhook

You can test if your webhook is working correctly:

```bash
curl -X POST http://localhost:3001/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/my-webhook-endpoint"
  }'
```

## Webhook Payload Format

Webhook payloads follow this general structure:

```json
{
  "event": "board.update",
  "timestamp": "2025-03-12T18:45:22.531Z",
  "data": {
    "boardId": "53f0aa65-635e-4b5c-852f-dba9c36c767b",
    "boardName": "Project X",
    // Event-specific data follows...
  }
}
```

### Event-Specific Payloads

#### board.update

```json
{
  "event": "board.update",
  "timestamp": "2025-03-12T18:45:22.531Z",
  "data": {
    "boardId": "53f0aa65-635e-4b5c-852f-dba9c36c767b",
    "boardName": "Project X",
    "columnCount": 4,
    "cardCount": 12
  }
}
```

#### card.create / card.update

```json
{
  "event": "card.create",
  "timestamp": "2025-03-12T18:45:22.531Z",
  "data": {
    "boardId": "53f0aa65-635e-4b5c-852f-dba9c36c767b",
    "boardName": "Project X",
    "columnId": "in-progress",
    "columnName": "In Progress",
    "card": {
      "id": "task-1234",
      "title": "Implement webhook feature",
      "tags": ["feature", "backend"]
    }
  }
}
```

#### card.move

```json
{
  "event": "card.move",
  "timestamp": "2025-03-12T18:45:22.531Z",
  "data": {
    "boardId": "53f0aa65-635e-4b5c-852f-dba9c36c767b",
    "boardName": "Project X",
    "card": {
      "id": "task-1234",
      "title": "Implement webhook feature"
    },
    "fromColumn": {
      "id": "in-progress",
      "name": "In Progress"
    },
    "toColumn": {
      "id": "done",
      "name": "Done"
    }
  }
}
```

## Example: Slack Integration

Here's how to set up a webhook that sends board updates to Slack:

1. Create a Slack app and enable incoming webhooks
2. Get your Slack webhook URL
3. Register it with TaskBoardAI:

```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Board Updates",
    "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
    "event": "board.update"
  }'
```

## Security Considerations

When working with webhooks:

- Use HTTPS endpoints whenever possible
- Consider adding authentication to your webhook endpoints
- Be mindful of what data you send in webhook payloads
- Implement retry logic for failed webhook deliveries
- Set up monitoring for webhook delivery status

## Managing Webhooks

List all registered webhooks:

```bash
curl http://localhost:3001/api/webhooks
```

Delete a webhook:

```bash
curl -X DELETE http://localhost:3001/api/webhooks/WEBHOOK_ID
```

Update a webhook:

```bash
curl -X PUT http://localhost:3001/api/webhooks/WEBHOOK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Webhook Name",
    "url": "https://example.com/new-endpoint",
    "event": "card.move"
  }'
```