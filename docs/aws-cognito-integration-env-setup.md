# AWS Cognito Integration - Environment Variables Setup

## Backend API (`apps/api/.env`)

Add the following environment variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/cognito_auth

# Cognito Configuration
COGNITO_USER_POOL_ID=ap-southeast-5_Ugz3vHRnm
COGNITO_CLIENT_ID=4es0361hj0r66iv7da3hhm8ftk
COGNITO_CLIENT_SECRET=1vkj665jmq0m0ahlocfetb9mdm2gau3qns5cf3kcbg999bm1qcs2
COGNITO_DOMAIN=https://ap-southeast-5ugz3vhrnm.auth.ap-southeast-5.amazoncognito.com
COGNITO_REGION=ap-southeast-5
REDIRECT_URI=http://localhost:4000/api/auth/callback

# JWT
JWT_SECRET=693672d58d1cbddc6a3f518568abc3395c92951a1600241a8df985b84d2c6926

# Session
SESSION_SECRET=<generate-a-secure-random-string-min-32-chars>

# Frontend URLs
FRONTEND_URL=http://localhost:3000
INVESTOR_URL=http://localhost:3001
ISSUER_URL=http://localhost:3002
ADMIN_URL=http://localhost:3003

# Server
PORT=4000
NODE_ENV=development

# CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```

## Landing App (`apps/landing/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_INVESTOR_URL=http://localhost:3001
NEXT_PUBLIC_ISSUER_URL=http://localhost:3002
NEXT_PUBLIC_ADMIN_URL=http://localhost:3003
```

## Investor Portal (`apps/investor/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Issuer Portal (`apps/issuer/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Admin Portal (`apps/admin/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Production Environment Variables

For production, update the URLs to:

- `COGNITO_DOMAIN=https://auth.cashsouk.com` (or your custom Cognito domain)
- `REDIRECT_URI=https://api.cashsouk.com/api/auth/callback`
- `FRONTEND_URL=https://www.cashsouk.com`
- `INVESTOR_URL=https://www.investor.cashsouk.com`
- `ISSUER_URL=https://www.issuer.cashsouk.com`
- `ADMIN_URL=https://www.admin.cashsouk.com`
- `COOKIE_DOMAIN=.cashsouk.com` (for cross-subdomain cookie sharing)

## Session Storage

Sessions are stored in PostgreSQL using the existing `DATABASE_URL`. A `session` table will be automatically created on first run.
- `ALLOWED_ORIGINS=https://www.cashsouk.com,https://www.investor.cashsouk.com,https://www.issuer.cashsouk.com,https://www.admin.cashsouk.com`

## Required Dependencies

Make sure to install the new dependencies:

```bash
cd apps/api
pnpm install
```

This will install:
- `openid-client` - For OpenID Connect client
- `express-session` - For session management
- `@types/express-session` - TypeScript types

## Next Steps

1. Install dependencies: `pnpm install` in the API directory
2. Update environment variables in all apps
3. Configure Cognito User Pool in AWS Console:
   - Set up custom domain (auth.cashsouk.com) if needed
   - Configure OAuth scopes: `openid`, `email`, `profile`
   - Add callback URL: `http://localhost:4000/api/auth/callback` (dev) and `https://api.cashsouk.com/api/auth/callback` (prod)
   - Configure social identity providers (Google, Apple, Meta) if needed
   - **Optional:** Add `FRONTEND_URL` to "Sign out URL(s)" if you want to use Cognito's logout endpoint with redirect
4. **IAM Permissions (Production):**
   - Grant the ECS task role permission for `cognito-idp:AdminUserGlobalSignOut` on the Cognito User Pool
   - This allows the API to invalidate Cognito sessions server-side during logout
   - If not granted, logout will still work but only clears local tokens/cookies
5. Test the authentication flow

