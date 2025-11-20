<!-- 30e62341-4ece-421b-8716-dcd69bffbeb5 abb9644a-c711-4839-afa8-fa068aaa8f91 -->
# Support & Feedback via Discord Webhooks

## Overview

Implement Support and Feedback flows so authenticated users can submit forms from the existing buttons, with submissions sent to dedicated Discord channels via webhooks. No data is stored in our DB for v1, and we won’t implement Discord account linking yet.

## High-Level Design

- **Entry points**: Use the existing `Support` and `Feedback` buttons in the frontend to open corresponding form UIs.
- **Forms**: Minimal but structured forms with required fields and basic validation, tied to the logged-in user.
- **Transport**: Backend API endpoints that accept form payloads, enrich with user context, and send to Discord via channel-specific webhooks.
- **Discord**: Two separate incoming webhooks, one per channel (support and feedback), configured via env vars.
- **Security**: Authenticated-only endpoints, rate limiting and basic spam protection in backend, no PII beyond what we already have in the app.

## Frontend Plan (Next.js app)

1. **Locate and wire up existing buttons**

- Identify the `Support` and `Feedback` buttons in `apps/web` (likely in layout, navigation, or a shared component).
- Confirm current behavior (no-op or placeholder) and plan to either:
- Open a modal with a form, or
- Navigate to dedicated routes like `/support` and `/feedback`.

2. **Design Support form UI/UX**

- Fields:
- Category (e.g., "Technical issue", "Billing", "Question"; hard-coded list).
- Subject (short text, required, max length).
- Description (multi-line, required, larger max length).
- Optional: checkbox to include extra context like current route or browser info, auto-collected on frontend.
- UX behavior:
- Show inline validation errors.
- Submit via `fetch`/custom hook to a new API route (e.g., `/api/support`).
- Show success toast and clear/close the form; show error state on failure.

3. **Design Feedback form UI/UX**

- Fields:
- Feedback type (e.g., "Bug report", "Feature request", "General feedback").
- Subject or short title (required).
- Feedback body (required).
- Optional rating (e.g., 1–5 stars) if it feels useful.
- UX behavior similar to Support form, but submitting to a different endpoint (e.g., `/api/feedback`).

4. **Shared form plumbing**

- Implement shared components/hooks for:
- Posting JSON to backend with proper auth headers (likely reusing existing API client patterns in `apps/web/app/api-hooks` or similar).
- A simple loading + disabled state for submit buttons.
- Reusable toast/notification pattern if not already in place.

## Backend Plan (NestJS API)

1. **API contracts (shared package)**

- Extend `packages/api-contracts` with DTO-like TypeScript interfaces for:
- `CreateSupportRequest` and `CreateFeedbackRequest` (fields mirroring the frontend forms).
- Export response types (e.g., simple `{ ok: true }`) to keep frontend strongly typed.

2. **New REST endpoints**

- In `apps/api/src`:
- Add a `SupportController` (e.g., `POST /support`) and `FeedbackController` (e.g., `POST /feedback`).
- Ensure endpoints are guarded by existing auth (e.g., `JwtAuthGuard` or equivalent used elsewhere in the app).
- Request handling:
- Validate and sanitize incoming body according to DTOs.
- Attach user context (user id, character/account name, email if relevant) from the auth context.

3. **Discord webhook service**

- Create a dedicated service (e.g., `DiscordNotificationService`) in `apps/api/src/common` or a similar shared location.
- Responsibilities:
- Read webhook URLs from environment variables, e.g.:
- `DISCORD_SUPPORT_WEBHOOK_URL`
- `DISCORD_FEEDBACK_WEBHOOK_URL`
- Format messages for Discord in a consistent, readable way (using embeds or structured text):
- Include user identity and relevant in-app context.
- Include form fields (category/type, subject, description/body, rating if any).
- Timestamp and environment (prod/stage).
- Perform `fetch`/HTTP POST with timeout and error handling.
- Decide on logging behavior if webhook delivery fails (log error, but still respond with a generic error to frontend).

4. **Endpoint implementation using webhook service**

- In `SupportController` and `FeedbackController`:
- Map incoming DTOs + user context into a message payload consumed by `DiscordNotificationService`.
- Call appropriate method (`sendSupportRequest`, `sendFeedback`), which picks the correct webhook.
- Return simple success/failure responses to clients.

5. **Security & rate limiting**

- Reuse existing rate-limiting/throttling approach if present in `apps/api`.
- If none exist, optionally add a light per-user throttle decorator for these endpoints to avoid spam/abuse.
- Ensure no raw Discord webhook URLs are ever sent back to the client.

## Configuration & Environment

1. **Env variables**

- Add new env var entries (with documentation) to:
- Root `.env.example.md` / relevant env docs.
- Any app-specific env examples.
- Variables:
- `DISCORD_SUPPORT_WEBHOOK_URL`
- `DISCORD_FEEDBACK_WEBHOOK_URL`

2. **Docs update**

- Add a short section to an existing doc (e.g., `AUTH_ARCHITECTURE.md` or create a new `SUPPORT_FEEDBACK.md`) explaining:
- What the endpoints do.
- How to configure Discord webhooks and create the channels.
- Expected message format in Discord.

## Testing Plan

1. **Unit/Integration tests (backend)**

- Tests for `DiscordNotificationService`:
- Formats payloads correctly for both support and feedback.
- Handles HTTP failure (timeouts, non-2xx) gracefully.
- Tests for controllers:
- Reject invalid payloads.
- Require authentication.
- Call the service with the right data when valid.

2. **Frontend behavior tests**

- If using Vitest/React Testing Library:
- Test that the Support and Feedback buttons open the correct forms.
- Test client-side validation (required fields, max lengths).
- Mock API responses to test success and error UX.

3. **Manual end-to-end checks**

- In dev/stage with test webhooks:
- Submit sample support and feedback forms.
- Verify that messages land in the correct Discord channels with expected content.
- Verify errors are surfaced nicely to the user if Discord/webhook is misconfigured.

## Future Enhancements (Not in this phase)

- Add Discord OAuth-based account linking for admins and power users, storing Discord IDs for richer integrations.
- DM specific admins based on category or routing rules, not just channel broadcasts.
- Add optional DB storage for support tickets/feedback to enable in-app history and analytics.
- Add a simple in-app admin view for recent support requests and feedback, in addition to Discord channels.

### To-dos

- [ ] Wire existing Support and Feedback buttons to open dedicated forms (modal or pages) in the Next.js frontend.
- [ ] Implement Support and Feedback form UIs with validation and shared submission logic to call backend endpoints.
- [ ] Extend api-contracts package with typed request/response interfaces for support and feedback submissions.
- [ ] Add authenticated NestJS endpoints for support and feedback that accept validated DTOs and enrich payloads with user context.
- [ ] Implement DiscordNotificationService in the API to send formatted messages to support and feedback webhooks from environment variables.
- [ ] Add DISCORD_SUPPORT_WEBHOOK_URL and DISCORD_FEEDBACK_WEBHOOK_URL to env examples and write a short setup doc for configuring Discord webhooks.
- [ ] Write unit/integration tests for DiscordNotificationService and support/feedback controllers, including auth and error handling.
- [ ] Write frontend tests for form behavior, validation, and API success/error flows for support and feedback.