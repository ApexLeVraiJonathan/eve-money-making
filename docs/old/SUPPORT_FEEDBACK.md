# Support & Feedback System

## Overview

The Support & Feedback system allows authenticated users to submit support requests and provide feedback directly through the application. Submissions are sent to dedicated Discord channels via webhooks for admin review.

## Features

- **Support Requests**: Users can submit support tickets for technical issues, billing questions, account problems, or general inquiries
- **Feedback**: Users can share bug reports, feature requests, improvement suggestions, and general feedback
- **Discord Integration**: All submissions are automatically sent to Discord channels with rich embeds
- **User Context**: Submissions include user information (ID, character name, email) for easy follow-up
- **Optional Technical Context**: Support requests can include page URL and browser information for debugging

## Architecture

### Frontend (Next.js)

#### Components

- `apps/web/components/support-dialog.tsx`: Dialog component for support requests
- `apps/web/components/feedback-dialog.tsx`: Dialog component for feedback

#### Integration

The Support and Feedback buttons are integrated into the sidebar (`apps/web/components/sidebar/app-sidebar.tsx`) and open modal dialogs when clicked.

#### Form Features

**Support Form:**
- Category dropdown (Technical, Billing, Account, Question, Other)
- Subject field (max 200 characters)
- Description field (max 2000 characters)
- Optional checkbox to include technical context (page URL, user agent)
- Client-side validation
- Loading states and error handling

**Feedback Form:**
- Type dropdown (Bug Report, Feature Request, Improvement, General, Other)
- Subject field (max 200 characters)
- Message field (max 2000 characters)
- Optional 1-5 star rating
- Client-side validation
- Loading states and error handling

### Backend (NestJS)

#### Modules & Controllers

- `apps/api/src/support/support.module.ts`: Support module
- `apps/api/src/support/support.controller.ts`: REST endpoints for support and feedback
  - `POST /support`: Submit support request
  - `POST /feedback`: Submit feedback

#### DTOs

- `apps/api/src/support/dto/create-support-request.dto.ts`: Support request validation
- `apps/api/src/support/dto/create-feedback.dto.ts`: Feedback validation

#### Discord Service

- `apps/api/src/common/discord-notification.service.ts`: Handles webhook notifications

**Features:**
- Sends formatted embeds to Discord
- Includes user context and metadata
- Handles webhook failures gracefully (doesn't fail user requests)
- Configurable via environment variables
- Truncates long text to fit Discord limits
- Different colors for support (red) vs feedback (green)

### API Contracts

Shared TypeScript types in `packages/api-contracts/src/index.ts`:
- `CreateSupportRequest`: Support request interface
- `CreateFeedbackRequest`: Feedback request interface
- `SupportFeedbackResponse`: Response interface

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Support webhook (required for Discord notifications)
DISCORD_SUPPORT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_SUPPORT_WEBHOOK_ID/YOUR_SUPPORT_WEBHOOK_TOKEN

# Feedback webhook (required for Discord notifications)
DISCORD_FEEDBACK_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_FEEDBACK_WEBHOOK_ID/YOUR_FEEDBACK_WEBHOOK_TOKEN
```

### Setting Up Discord Webhooks

1. **Create Discord Channels**
   - Create a `#support` channel for support requests
   - Create a `#feedback` channel for feedback submissions
   - (Or use existing channels)

2. **Create Webhooks**
   - Go to Server Settings > Integrations > Webhooks
   - Click "New Webhook"
   - For each webhook:
     - Name it appropriately (e.g., "Support Bot", "Feedback Bot")
     - Select the target channel
     - Copy the webhook URL
     - Add to your `.env` file

3. **Test the Integration**
   - Start your application with the webhook URLs configured
   - Submit a test support request and feedback
   - Verify messages appear in the correct Discord channels

### Optional Configuration

If webhook URLs are not configured:
- The endpoints still accept submissions (return success)
- A warning is logged on service startup
- No Discord messages are sent
- This allows for graceful degradation in development

## Security

- **Authentication Required**: Both endpoints require valid authentication (EVE SSO token or dev API key)
- **Rate Limiting**: Protected by global rate limiter (100 requests per minute per IP)
- **Input Validation**: All inputs are validated with class-validator decorators
- **Character Limits**: Subject (200 chars), Description/Message (2000 chars)
- **Webhook URLs**: Never exposed to frontend; kept in backend environment

## Discord Message Format

### Support Request Embed

```
🆘 New Support Request

Category: 🔧 Technical Issue
Environment: production
Subject: Cannot access my account
Description: I have been trying to log in...
User: User ID: abc123
      Character: John Doe
      Email: user@example.com
Page URL: https://app.example.com/tradecraft
User Agent: Mozilla/5.0...
```

### Feedback Embed

```
💡 New Feedback

Type: ✨ Feature Request
Environment: production
Subject: Add dark mode
Message: It would be great if...
User: User ID: abc123
      Character: Jane Smith
      Email: user@example.com
Rating: ⭐⭐⭐⭐⭐ (5/5)
```

## Usage Examples

### Frontend Usage

The dialogs are already integrated into the sidebar. Users can:
1. Click the "Support" button in the sidebar
2. Fill out the support form
3. Submit (automatic API call with authentication)
4. See success toast or error message

### API Usage (Direct)

For programmatic access:

```typescript
// Submit support request
const response = await fetch(`${API_URL}/support`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    category: 'technical',
    subject: 'Login issue',
    description: 'Cannot log in to my account',
    context: {
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
  }),
});

// Submit feedback
const response = await fetch(`${API_URL}/feedback`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    feedbackType: 'feature',
    subject: 'Dark mode',
    message: 'Please add a dark mode option',
    rating: 5,
  }),
});
```

## Testing

### Manual Testing

1. **Frontend Testing**
   - Log in to the application
   - Click Support button in sidebar
   - Fill out and submit form
   - Verify success toast appears
   - Check Discord channel for message

2. **Backend Testing**
   - Use API client (Postman, curl, etc.)
   - Send POST request to `/support` or `/feedback`
   - Include valid Bearer token
   - Verify 200 response
   - Check Discord channel

### Automated Tests

- Backend unit tests in `apps/api/test/support/`
- Frontend component tests in `apps/web/test/`
- See Testing section below for details

## Future Enhancements

- **Database Storage**: Store submissions in DB for in-app admin dashboard
- **Discord OAuth**: Link admin Discord accounts for DM notifications
- **Status Updates**: Allow admins to update ticket status and notify users
- **In-App History**: Show users their past support requests and feedback
- **Auto-Response**: Send automated acknowledgment to users
- **Categorization**: More sophisticated categorization and routing
- **Attachments**: Support for file uploads (screenshots, logs)
- **Thread Support**: Create Discord threads for each submission for organized responses

## Troubleshooting

### Webhook Not Working

1. Verify webhook URL is correct in `.env`
2. Check Discord webhook is still active (not deleted)
3. Check backend logs for error messages
4. Test webhook URL directly with curl:

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

### Forms Not Submitting

1. Check browser console for errors
2. Verify user is authenticated
3. Check network tab for API response
4. Verify NEXT_PUBLIC_API_URL is correct

### Backend Errors

1. Check `NODE_ENV` is set correctly
2. Verify all required environment variables are set
3. Check NestJS logs for detailed error messages
4. Verify CompositeAuthGuard is working (test with `/health` endpoint)

## Related Documentation

- [Authentication Architecture](./AUTH_ARCHITECTURE.md)
- [Environment Variables](../env.example.md)
- [API Documentation](./ARCHITECTURE.md)

