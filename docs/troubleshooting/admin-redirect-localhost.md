# Troubleshooting: Admin Portal Redirects to localhost:3000

## Problem

After signing in as an ADMIN user, you are redirected to `localhost:3000` instead of staying on the admin portal (`admin.cashsouk.com`).

## Root Cause

The landing page's environment variables are not configured correctly in production. Specifically, the `NEXT_PUBLIC_ADMIN_URL` environment variable is either:
1. Not set (defaults to `http://localhost:3000`)
2. Set to the wrong value

## How the OAuth Callback Flow Works

```
1. User signs in → Backend OAuth callback receives code
2. Backend exchanges code for tokens
3. Backend redirects to: env.FRONTEND_URL/callback (landing page)
   Example: https://www.cashsouk.com/callback?token=...&role=ADMIN

4. Landing page callback reads the role from URL
5. Landing page redirects to appropriate portal's callback:
   - ADMIN → NEXT_PUBLIC_ADMIN_URL/callback
   - INVESTOR → NEXT_PUBLIC_INVESTOR_URL/callback
   - ISSUER → NEXT_PUBLIC_ISSUER_URL/callback

6. Portal callback stores token in memory
7. Portal callback redirects to dashboard or onboarding
```

## Solution

### Step 1: Update Landing Page Environment Variables

The landing page needs these environment variables set in production:

```bash
# Frontend URLs
NEXT_PUBLIC_FRONTEND_URL=https://www.cashsouk.com

# Portal URLs (for OAuth callback redirects)
NEXT_PUBLIC_ADMIN_URL=https://admin.cashsouk.com
NEXT_PUBLIC_INVESTOR_URL=https://investor.cashsouk.com
NEXT_PUBLIC_ISSUER_URL=https://issuer.cashsouk.com
```

### Step 2: Deploy Updated Environment Variables

#### Option A: GitHub Secrets (Recommended)

1. Go to GitHub Repository → Settings → Secrets and variables → Actions
2. Find the secret `LANDING_ENV_PROD`
3. Click "Update" and add the portal URL environment variables
4. Re-deploy the landing page

#### Option B: AWS ECS Task Definition

If you're setting environment variables directly in ECS:

1. Go to AWS ECS Console
2. Find your landing page task definition
3. Create a new revision with the updated environment variables
4. Update the service to use the new task definition revision

#### Option C: AWS Systems Manager Parameter Store

If using SSM for environment variables:

1. Go to AWS Systems Manager → Parameter Store
2. Update parameters for the landing page:
   ```
   /cashsouk/prod/landing/NEXT_PUBLIC_ADMIN_URL
   /cashsouk/prod/landing/NEXT_PUBLIC_INVESTOR_URL
   /cashsouk/prod/landing/NEXT_PUBLIC_ISSUER_URL
   ```
3. Restart the landing page service to pick up new values

### Step 3: Verify Other Portals

While you're at it, make sure ALL portals have the correct environment variables:

**Admin Portal** (`apps/admin`):
```bash
NEXT_PUBLIC_FRONTEND_URL=https://www.cashsouk.com
NEXT_PUBLIC_API_URL=https://api.cashsouk.com
```

**Investor Portal** (`apps/investor`):
```bash
NEXT_PUBLIC_FRONTEND_URL=https://www.cashsouk.com
NEXT_PUBLIC_ISSUER_URL=https://issuer.cashsouk.com
NEXT_PUBLIC_API_URL=https://api.cashsouk.com
```

**Issuer Portal** (`apps/issuer`):
```bash
NEXT_PUBLIC_FRONTEND_URL=https://www.cashsouk.com
NEXT_PUBLIC_INVESTOR_URL=https://investor.cashsouk.com
NEXT_PUBLIC_API_URL=https://api.cashsouk.com
```

## Testing After Fix

1. **Test ADMIN login**:
   - Go to `https://admin.cashsouk.com`
   - Click "Sign In"
   - Authenticate with ADMIN credentials
   - **Expected**: Redirected to `https://admin.cashsouk.com` (dashboard)
   - **NOT**: `localhost:3000`

2. **Test INVESTOR login**:
   - Go to `https://investor.cashsouk.com` or landing page
   - Sign in as INVESTOR
   - **Expected**: Redirected to `https://investor.cashsouk.com`

3. **Test ISSUER login**:
   - Go to `https://issuer.cashsouk.com` or landing page
   - Sign in as ISSUER
   - **Expected**: Redirected to `https://issuer.cashsouk.com`

## Related Files

- Landing page callback: `apps/landing/src/app/callback/page.tsx` (lines 8-10, 40-46)
- Backend OAuth callback: `apps/api/src/modules/auth/cognito.routes.ts` (line 584)
- Admin auth hook: `apps/admin/src/lib/auth.ts` (line 7)
- Environment template: `env-templates/landing.env.prod`

## Prevention

To avoid this issue in the future:

1. ✅ **Updated** `env-templates/landing.env.prod` to include portal URLs
2. Always validate environment variables in production deployments
3. Use the environment templates as a checklist when deploying
4. Consider adding startup health checks that verify critical env vars are set correctly

## Logs to Check

If you're still having issues, check these logs:

**Backend logs** (look for OAuth callback):
```json
{
  "msg": "Redirecting to portal callback with tokens in URL",
  "redirectUrl": "https://www.cashsouk.com/callback?token=...",
  "activeRole": "ADMIN"
}
```

**Browser console** (landing page):
```
Check that ADMIN_URL is correct when landing page redirects
```

**Browser Network tab**:
```
1. Backend callback: 302 redirect to https://www.cashsouk.com/callback
2. Landing callback: 302 redirect to https://admin.cashsouk.com/callback
3. Admin callback: 302 redirect to https://admin.cashsouk.com/
```

If any of these steps redirects to `localhost:3000`, that's where the environment variable is misconfigured.

