# EVE SSO Authentication Migration Guide

## Overview

The application has been migrated from cookie-based authentication to a modern JWT-based system using NextAuth (Auth.js) for user sign-in and NestJS passport strategies for API authentication.

## Quick Start

### 1. Set Up Environment Variables

Create or update your `.env` file with the following:

```env
# EVE SSO Application (get from https://developers.eveonline.com)
EVE_CLIENT_ID=your_client_id_here
EVE_CLIENT_SECRET=your_secret_here

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# API Configuration
API_URL=http://localhost:4000
PORT=4000

# Existing required variables
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
ENCRYPTION_KEY=your_encryption_key_for_tokens
ESI_USER_AGENT=YourApp/1.0 (contact@example.com)

# Job Control (optional)
ENABLE_JOBS=false  # Disable in local dev
JOB_SYSTEM_TOKENS_ENABLED=true
```

### 2. Install Dependencies

```powershell
# Install all dependencies
pnpm install

# Or install individually
cd apps/web; pnpm install
cd apps/api; pnpm install
```

### 3. Run Database Migrations

The schema changes have already been migrated, but ensure your database is up to date:

```powershell
cd apps/api
pnpm prisma generate
pnpm prisma migrate deploy
```

### 4. Start the Applications

Terminal 1 - API:

```powershell
cd apps/api
pnpm start:dev
```

Terminal 2 - Web:

```powershell
cd apps/web
pnpm dev
```

## Testing the New Authentication

### Manual Testing

#### 1. Test Unauthenticated Access

```powershell
# Should return 401
curl http://localhost:4000/auth/me
```

#### 2. Test Public Endpoints

```powershell
# Should work without auth
curl http://localhost:4000/auth/login
```

#### 3. Test with NextAuth (once frontend is wired)

1. Navigate to `http://localhost:3000` in your browser
2. Click "Sign in with EVE Online"
3. Complete the EVE SSO flow
4. You should be redirected back with a session
5. API calls from Next.js should include `Authorization: Bearer <token>` header

### Automated Testing

Run the E2E tests:

```powershell
cd apps/api
pnpm test:e2e eve-auth
```

Expected results:

- ✅ Unauthenticated requests to protected routes return 401
- ✅ Invalid Bearer tokens are rejected
- ✅ Role guards work correctly (ADMIN vs USER)
- ✅ Token health fields are present in database
- ✅ SYSTEM character support works

## Migration Checklist

### Backend (NestJS) - ✅ COMPLETED

- [x] Prisma schema updated with `managedBy`, `notes`, and token health fields
- [x] Migration created and applied
- [x] JWT strategy implemented for EVE Bearer token validation
- [x] Auth guards updated to use passport
- [x] Role guard updated to read from `req.user`
- [x] Token refresh service created
- [x] Admin endpoints for token management
- [x] Background job for SYSTEM character token refresh
- [x] CORS configured for Authorization header
- [x] E2E tests created

### Frontend (Next.js) - ⏳ TODO

- [ ] Wire up NextAuth sign-in button
- [ ] Update API call wrappers to forward Bearer tokens
- [ ] Remove old cookie-based auth UI
- [ ] Update character management pages
- [ ] Add token health status UI for admins
- [ ] Test complete user flow

### Deployment - ⏳ TODO

- [ ] Store `EVE_CLIENT_SECRET` in secret manager
- [ ] Generate and store `NEXTAUTH_SECRET`
- [ ] Update CORS origins for production domain
- [ ] Set `NEXTAUTH_URL` to production URL
- [ ] Enable jobs in production (`ENABLE_JOBS=true`)
- [ ] Monitor token refresh failures
- [ ] Set up alerts for authentication errors

## Architecture Overview

### Authentication Flow

```
1. User clicks "Sign in with EVE Online" (Next.js)
   ↓
2. NextAuth redirects to EVE SSO
   ↓
3. User authorizes, EVE redirects back with code
   ↓
4. NextAuth exchanges code for access_token
   ↓
5. NextAuth stores token in JWT session
   ↓
6. Next.js makes API calls: Authorization: Bearer <eve_access_token>
   ↓
7. NestJS validates token with CCP's JWKS
   ↓
8. Request proceeds with req.user populated
```

### Token Refresh Flow

```
1. ESI call needs to be made
   ↓
2. Code calls esiTokenService.getAccessToken(characterId)
   ↓
3. Service checks if token is expired
   ↓
4. If expired, uses refresh_token to get new access_token
   ↓
5. Updates DB with new tokens and health status
   ↓
6. Returns valid access_token for ESI call
```

## API Changes

### New Endpoints

- `GET /auth/me` - Get current user from Bearer token (uses `@CurrentUser()`)
- `GET /admin/characters/:id/token/status` - View token health (ADMIN only)
- `DELETE /admin/characters/:id/token` - Revoke character token (ADMIN only)

### Updated Endpoints

- All protected endpoints now require `Authorization: Bearer <token>` header
- Routes marked with `@Public()` decorator are accessible without auth
- Routes marked with `@Roles('ADMIN')` require ADMIN user role

### Deprecated (but still functional)

- Old cookie-based login endpoints (`/auth/login`, `/auth/callback`)
  - These still work for backward compatibility
  - Should be phased out once frontend is updated

## Database Schema Changes

### New Fields in `EveCharacter`

```prisma
managedBy CharacterManagedBy @default(USER) // USER or SYSTEM
notes     String?                             // Optional notes
```

### New Fields in `CharacterToken`

```prisma
lastRefreshAt  DateTime? // Last successful refresh
refreshFailAt  DateTime? // Last failed refresh
refreshFailMsg String?   // Error message from last failure
```

### New Enum

```prisma
enum CharacterManagedBy {
  USER    // Linked to a user account
  SYSTEM  // Backend system character
}
```

## Troubleshooting

### "Invalid JWT Token"

**Cause**: Token is expired, malformed, or signature doesn't match CCP's JWKS.

**Solution**:

- Ensure `EVE_CLIENT_ID` and `EVE_CLIENT_SECRET` match your EVE application
- Check token expiry; NextAuth should refresh automatically
- Verify the token is a valid EVE access token, not a NextAuth session token

### "owner_hash_changed" Error

**Cause**: Character was transferred to a different account.

**Solution**:

- This is expected when a character changes hands
- User must re-link the character to get new tokens
- Admin can check status at `/admin/characters/:id/token/status`

### CORS Errors

**Cause**: Next.js origin not in CORS allowlist.

**Solution**:

- Update `apps/api/src/main.ts` CORS config
- Add your domain to the `origin` array
- Ensure `Authorization` is in `allowedHeaders`

### Token Refresh Failures

**Cause**: Refresh token is invalid, expired, or character was transferred.

**Solution**:

- Check `refreshFailMsg` in database
- If "owner_hash_changed", character must be re-linked
- If "invalid_grant", refresh token may be revoked
- User needs to re-authorize the application

### Database Migration Errors

**Cause**: Existing data conflicts with new schema.

**Solution**:

```powershell
cd apps/api
pnpm prisma migrate reset  # ⚠️ This deletes all data
pnpm prisma migrate deploy
```

Or manually fix data and re-run:

```powershell
pnpm prisma migrate deploy
```

## Security Best Practices

### Production Deployment

1. **Secret Management**:

   - Store `EVE_CLIENT_SECRET` in AWS Secrets Manager, Azure Key Vault, etc.
   - Never commit secrets to git
   - Rotate secrets periodically

2. **Token Encryption**:

   - Use a strong `ENCRYPTION_KEY` (32+ random bytes)
   - Store in secret manager
   - Rotate key with a migration plan

3. **HTTPS**:

   - Always use HTTPS in production
   - Set `secure: true` on cookies
   - Use `sameSite: 'strict'` or `'lax'`

4. **Monitoring**:

   - Monitor `refreshFailAt` timestamps
   - Alert on repeated failures
   - Track "owner_hash_changed" events
   - Monitor authentication errors

5. **Rate Limiting**:
   - Consider rate limiting on `/auth/*` endpoints
   - Prevent brute force on token endpoints

## Next Steps

### Immediate (Required for functionality)

1. **Update Next.js API Routes**:

   - Modify all API calls to use Bearer tokens
   - Use `auth()` from `apps/web/auth.ts` to get session
   - Forward `session.accessToken` as `Authorization: Bearer <token>`

2. **Update Sign-In UI**:

   - Replace old login buttons with NextAuth sign-in
   - Use `signIn('eveonline')` from `next-auth/react`
   - Handle sign-out with `signOut()`

3. **Test Complete Flow**:
   - Sign in with EVE
   - Link additional characters
   - Make authenticated API calls
   - Verify admin endpoints work

### Future Enhancements

- [ ] Add character scopes management UI
- [ ] Support re-linking with additional scopes
- [ ] Add user profile pages showing linked characters
- [ ] Implement character switching (if needed)
- [ ] Add two-factor authentication option
- [ ] Implement refresh token rotation policy

## Support & Resources

- **EVE SSO Documentation**: https://docs.esi.evetech.net/docs/sso/
- **NextAuth Documentation**: https://next-auth.js.org/
- **Passport JWT**: http://www.passportjs.org/packages/passport-jwt/
- **Implementation Summary**: See `IMPLEMENTATION_SUMMARY.md`

## Questions?

If you encounter issues not covered in this guide:

1. Check the implementation summary for technical details
2. Review the E2E tests for usage examples
3. Check NestJS logs for authentication errors
4. Verify environment variables are set correctly
5. Ensure database migrations are applied

---

**Last Updated**: 2025-10-13
**Migration Status**: Backend ✅ Complete | Frontend ⏳ In Progress
