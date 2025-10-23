# Production Deployment Guide

## Railway Deployment with Database Reset

Since significant schema changes have been made, you'll need to reset the production database before deploying.

### Option 1: Using the Reset Script (Recommended)

1. **Get your Railway database connection string:**

   ```bash
   # In Railway dashboard, go to your PostgreSQL service
   # Copy the DATABASE_URL from the Variables tab
   ```

2. **Install dependencies locally:**

   ```bash
   cd apps/api
   pnpm install
   ```

3. **Run the reset script:**

   ```bash
   cd apps/api
   pnpm db:reset-prod "your-railway-database-url"
   ```

   This will:
   - ⚠️ Drop all existing tables
   - 🗑️ Remove the Prisma migrations table
   - 📦 Run all migrations from scratch
   - ✅ Leave you with a clean, up-to-date schema

4. **Deploy to Railway:**
   - Push your code to the connected Git repository
   - Railway will automatically build and deploy

### Option 2: Manual Railway Database Reset

1. **In Railway Dashboard:**
   - Go to your PostgreSQL service
   - Click on the "Data" tab
   - Delete all tables manually, OR
   - Delete the entire database service and create a new one

2. **Update DATABASE_URL:**
   - If you created a new database, update the `DATABASE_URL` in your API service variables

3. **Deploy:**
   - Push your code
   - Railway will run migrations automatically on first deploy

### Option 3: Add Migration Step to Railway Build

Update your Railway build command to include migration deployment:

```bash
cd apps/api; pnpm install --frozen-lockfile; pnpm prisma generate; pnpm prisma migrate deploy; pnpm build
```

**Note:** This only works if the database is already empty or has compatible schema. For major schema changes, use Option 1 or 2 first.

## Current Railway Configuration

### Build Command:

```bash
cd apps/api; pnpm install --frozen-lockfile; pnpm prisma generate; pnpm build
```

### Start Command:

```bash
cd apps/api; pnpm start:prod
```

## Post-Deployment Steps

After successful deployment:

1. **Verify the database schema:**
   - Use Prisma Studio or a database client
   - Check that all tables and columns exist

2. **Create initial data:**
   - Add EVE character(s) with ADMIN role
   - Link LOGISTICS character(s)
   - Import initial static data if needed

3. **Test basic functionality:**
   - Authentication
   - Character linking
   - Wallet imports
   - Cycle creation

## Environment Variables Required

Ensure these are set in Railway:

### Required:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `EVE_CLIENT_ID` - EVE Online OAuth client ID
- `EVE_CLIENT_SECRET` - EVE Online OAuth client secret
- `EVE_CALLBACK_URL` - OAuth callback URL (https://your-domain.com/api/auth/callback)

### Optional:

- `NODE_ENV=production`
- `PORT` (Railway sets this automatically)

## Troubleshooting

### "Table does not exist" errors

- Run the reset script again
- Ensure migrations ran successfully during build

### "Migration failed" errors

- Check if the database has existing data that conflicts
- Use Option 1 (reset script) to start fresh

### Connection timeout errors

- Verify DATABASE_URL is correct
- Check Railway database service is running
- Ensure API service has network access to database

## Rollback Plan

If deployment fails:

1. Revert code to previous working commit
2. Trigger Railway redeploy
3. If database is corrupted, restore from Railway backup:
   - Go to PostgreSQL service → Backups
   - Restore to a previous snapshot
