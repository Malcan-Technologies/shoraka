# Environment Variables Guide

This document describes all environment variables used across the CashSouk platform.

## Overview

- **Local Development**: Uses `.env.local` files
- **Production**: Uses AWS SSM Parameter Store / Secrets Manager
- **Templates**: Located in `env-templates/` directory

## Setup Instructions

### Local Development

```bash
# Copy all templates at once
make setup-env

# Or manually copy each file
cp env-templates/api.env.local apps/api/.env.local
cp env-templates/landing.env.local apps/landing/.env.local
cp env-templates/investor.env.local apps/investor/.env.local
cp env-templates/issuer.env.local apps/issuer/.env.local
cp env-templates/admin.env.local apps/admin/.env.local
```

### Production (AWS)

Environment variables are stored in AWS Systems Manager Parameter Store and Secrets Manager:

```
/cashsouk/prod/api/DATABASE_URL           → Secrets Manager
/cashsouk/prod/api/JWT_SECRET             → Secrets Manager
/cashsouk/prod/api/ALLOWED_ORIGINS        → SSM Parameter
/cashsouk/prod/cognito/USER_POOL_ID       → SSM Parameter
/cashsouk/prod/s3/BUCKET_NAME             → SSM Parameter
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for AWS setup details.

---

## API Environment Variables

### Required (Critical)

| Variable          | Description                  | Example (Dev)                                                | Example (Prod)             |
| ----------------- | ---------------------------- | ------------------------------------------------------------ | -------------------------- |
| `NODE_ENV`        | Environment mode             | `development`                                                | `production`               |
| `PORT`            | Server port                  | `4000`                                                       | `3000`                     |
| `DATABASE_URL`    | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/cashsouk_dev` | From Secrets Manager       |
| `JWT_SECRET`      | JWT signing secret           | `dev-secret-...`                                             | From Secrets Manager       |
| `ALLOWED_ORIGINS` | CORS allowed origins         | `http://localhost:3000,...`                                  | `https://cashsouk.com,...` |

### Optional (Recommended)

| Variable                  | Description              | Default  | Notes               |
| ------------------------- | ------------------------ | -------- | ------------------- |
| `JWT_EXPIRES_IN`          | Access token expiration  | `15m`    | Short-lived tokens  |
| `JWT_REFRESH_EXPIRES_IN`  | Refresh token expiration | `7d`     | Long-lived tokens   |
| `LOG_LEVEL`               | Logging level            | `info`   | Use `debug` for dev |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window        | `900000` | 15 minutes          |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window  | `100`    | Adjust per needs    |

### AWS Integration

| Variable                | Description           | Notes                         |
| ----------------------- | --------------------- | ----------------------------- |
| `AWS_REGION`            | AWS region            | `ap-southeast-5` (Malaysia)   |
| `AWS_ACCESS_KEY_ID`     | AWS access key        | Not needed in ECS (IAM role)  |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key        | Not needed in ECS (IAM role)  |
| `S3_BUCKET`             | S3 bucket for uploads | e.g., `cashsouk-prod-uploads` |
| `S3_PREFIX`             | S3 key prefix         | e.g., `uploads/`              |

### Cognito

| Variable                | Description    | Example                    |
| ----------------------- | -------------- | -------------------------- |
| `COGNITO_USER_POOL_ID`  | User pool ID   | `ap-southeast-5_XXXXXXXXX` |
| `COGNITO_APP_CLIENT_ID` | App client ID  | From Cognito console       |
| `COGNITO_REGION`        | Cognito region | `ap-southeast-5`           |
| `JWT_ISSUER`            | JWT issuer URL | `https://cognito-idp...`   |

### Email Service

| Variable        | Description                      | Notes                                                        |
| --------------- | -------------------------------- | ------------------------------------------------------------ |
| `SMTP_HOST`     | SMTP server                      | Use AWS SES in production                                    |
| `SMTP_PORT`     | SMTP port                        | `587` (TLS)                                                  |
| `SMTP_USER`     | SMTP username                    | From SES SMTP credentials                                    |
| `SMTP_PASSWORD` | SMTP password                    | From Secrets Manager                                         |
| `EMAIL_FROM`    | Sender email                     | `noreply@cashsouk.com`                                       |
| `SES_REGION`    | Region for `@aws-sdk/client-ses` | Default `ap-southeast-2`; identity must exist in this region |

Issuer director CTOS RegTank onboarding: after a successful RegTank create call, the API stores `verifyLink` on `ctos_party_supplements.onboarding_json` and sends the link with SES using `EMAIL_FROM` and the default AWS credential chain (ECS task role or env keys for local dev).

### File Upload

| Variable             | Description        | Default            |
| -------------------- | ------------------ | ------------------ |
| `MAX_FILE_SIZE_MB`   | Max upload size    | `10`               |
| `ALLOWED_FILE_TYPES` | Allowed extensions | `pdf,jpg,jpeg,png` |

### Payment Gateway (Curlec / Razorpay Malaysia)

Server-only — never expose `CURLEC_KEY_SECRET` or `CURLEC_WEBHOOK_SECRET` to clients. Loaded by `apps/api/src/config/curlec.ts`.

| Variable | Description | Example (Dev) | Example (Prod) |
|---|---|---|---|
| `CURLEC_KEY_ID` | Curlec API key ID | `rzp_test_...` | `rzp_live_...` (Secrets Manager) |
| `CURLEC_KEY_SECRET` | Curlec API secret | From Curlec dashboard | Secrets Manager |
| `CURLEC_WEBHOOK_SECRET` | Webhook HMAC signing secret | From Curlec dashboard webhook config | Secrets Manager |
| `CURLEC_API_BASE_URL` | Curlec REST API base URL | `https://api.razorpay.com` | Confirm Malaysia prod URL with Curlec |

The public key id is returned in order-create API responses — frontends do not need a `NEXT_PUBLIC_CURLEC_*` variable.

See also: `docs/integrations/payment-gateway-curlec-ops-runbook.md`, `docs/integrations/payment-gateway-curlec-plan-as-built.md`.

> **Note:** Legacy `PAYMENT_GATEWAY_*` placeholders in older docs are superseded by `CURLEC_*`.

## Frontend Environment Variables (Next.js)

### Common Variables (All Portals)

| Variable                        | Description       | Example (Dev)           | Example (Prod)                  |
| ------------------------------- | ----------------- | ----------------------- | ------------------------------- |
| `NODE_ENV`                      | Environment       | `development`           | `production`                    |
| `NEXT_PUBLIC_API_URL`           | API endpoint      | `http://localhost:4000` | `https://api.cashsouk.com`      |
| `NEXT_PUBLIC_COGNITO_DOMAIN`    | Cognito domain    | Leave empty for dev     | `https://cashsouk-prod.auth...` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito client ID | Leave empty for dev     | From Cognito console            |
| `NEXT_PUBLIC_COGNITO_REGION`    | Cognito region    | `ap-southeast-5`        | `ap-southeast-5`                |

### Production-Only Variables

| Variable                     | Description           | Example                       |
| ---------------------------- | --------------------- | ----------------------------- |
| `NEXT_PUBLIC_CLOUDFRONT_URL` | CDN URL for assets    | `https://assets.cashsouk.com` |
| `NEXT_PUBLIC_GA_TRACKING_ID` | Google Analytics ID   | `G-XXXXXXXXXX`                |
| `NEXT_PUBLIC_SENTRY_DSN`     | Sentry error tracking | From Sentry console           |
| `NEXT_PUBLIC_BUILD_ID`       | Build identifier      | Injected by CI/CD             |
| `NEXT_PUBLIC_COMMIT_SHA`     | Git commit SHA        | Injected by CI/CD             |

### Feature Flags

Different per portal:

**Landing:**

- `NEXT_PUBLIC_ENABLE_SIGNUP` - Enable/disable signup flow

**Investor:**

- `NEXT_PUBLIC_ENABLE_INVESTMENTS` - Enable investment flow
- `NEXT_PUBLIC_MIN_INVESTMENT_AMOUNT` - Minimum investment amount

**Issuer:**

- `NEXT_PUBLIC_ENABLE_LOAN_REQUESTS` - Enable loan request flow
- `NEXT_PUBLIC_MAX_LOAN_AMOUNT` - Maximum loan amount

**Admin:**

- `NEXT_PUBLIC_ENABLE_USER_MANAGEMENT` - Enable user management
- `NEXT_PUBLIC_ENABLE_LOAN_APPROVAL` - Enable loan approval flow

---

## Important Notes

### Security Best Practices

1. **Never commit `.env.local` or `.env.prod` files to Git**
   - Already gitignored
   - Use templates in `env-templates/`

2. **Use strong secrets in production**
   - `JWT_SECRET` should be 64+ characters, randomly generated
   - Rotate secrets regularly

3. **AWS Credentials**
   - Never hardcode AWS keys
   - Use IAM roles in ECS (credentials auto-injected)
   - For local testing, use AWS CLI profiles

4. **Secrets Management**
   - Store sensitive values in AWS Secrets Manager
   - Reference them in ECS task definitions
   - Never log secret values

### Next.js Environment Variables

**Important distinctions:**

1. **Build-time variables** (`NEXT_PUBLIC_*`)
   - Exposed to browser
   - Embedded in JavaScript bundle
   - Use for: API URLs, public config

2. **Server-side variables** (no `NEXT_PUBLIC_` prefix)
   - Only available on server
   - Use for: API keys, database URLs, secrets

### Validation

Environment variables should be validated at startup:

```typescript
// apps/api/src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  // ... more validations
});

export const env = envSchema.parse(process.env);
```

---

## AWS SSM Parameter Store Structure

### Production Parameters

```
/cashsouk/prod/
  ├── api/
  │   ├── ALLOWED_ORIGINS           (String)
  │   ├── AWS_REGION                (String)
  │   ├── S3_BUCKET                 (String)
  │   ├── S3_PREFIX                 (String)
  │   ├── COGNITO_USER_POOL_ID      (String)
  │   ├── COGNITO_APP_CLIENT_ID     (String)
  │   ├── COGNITO_REGION            (String)
  │   ├── LOG_LEVEL                 (String)
  │   ├── MAX_FILE_SIZE_MB          (String)
  │   └── ALLOWED_FILE_TYPES        (String)
  ├── secrets/
  │   ├── DATABASE_URL              (SecureString)
  │   ├── JWT_SECRET                (SecureString)
  │   ├── SMTP_PASSWORD             (SecureString)
  │   ├── CURLEC_KEY_ID             (SecureString)
  │   ├── CURLEC_KEY_SECRET         (SecureString)
  │   └── CURLEC_WEBHOOK_SECRET     (SecureString)
  └── frontend/
      ├── NEXT_PUBLIC_API_URL       (String)
      ├── NEXT_PUBLIC_COGNITO_DOMAIN (String)
      └── NEXT_PUBLIC_CLOUDFRONT_URL (String)
```

### Accessing in ECS

Task definition example:

```json
{
  "containerDefinitions": [
    {
      "name": "api",
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "/cashsouk/prod/secrets/DATABASE_URL"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "/cashsouk/prod/secrets/JWT_SECRET"
        }
      ],
      "environment": [
        {
          "name": "AWS_REGION",
          "value": "ap-southeast-5"
        },
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

---

## Troubleshooting

### "Environment variable not found"

**Cause:** Missing or misnamed variable

**Fix:**

```bash
# Check if .env.local exists
ls -la apps/api/.env.local

# Verify variable is set
grep JWT_SECRET apps/api/.env.local

# Ensure file is loaded (check app startup)
```

### "Invalid DATABASE_URL"

**Cause:** Incorrect connection string format

**Fix:**

```bash
# Correct format
DATABASE_URL=postgresql://user:password@host:port/database

# For Docker PostgreSQL (dev)
DATABASE_URL=postgresql://postgres:password@localhost:5432/cashsouk_dev

# For RDS (production)
DATABASE_URL=postgresql://dbuser:dbpass@rds-endpoint:5432/cashsouk_prod
```

### "CORS error in browser"

**Cause:** Frontend URL not in `ALLOWED_ORIGINS`

**Fix:**

```bash
# API .env.local
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003
```

---

## CI/CD Integration

GitHub Actions injects environment variables during deployment:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to ECS
  env:
    AWS_REGION: ap-southeast-5
    COMMIT_SHA: ${{ github.sha }}
  run: |
    # Variables are injected into task definition
    ./scripts/ecs-update.sh
```

Build-time variables for Next.js:

```yaml
- name: Build Landing
  env:
    NEXT_PUBLIC_API_URL: https://api.cashsouk.com
    NEXT_PUBLIC_COMMIT_SHA: ${{ github.sha }}
  run: pnpm --filter @cashsouk/landing build
```

---

## Quick Reference

### Local Development Checklist

- [ ] PostgreSQL running (`docker ps`)
- [ ] `.env.local` files copied for all apps
- [ ] `DATABASE_URL` points to localhost:5432
- [ ] `ALLOWED_ORIGINS` includes all localhost ports
- [ ] `JWT_SECRET` is set (any value for dev)

### Production Deployment Checklist

- [ ] All secrets in AWS Secrets Manager
- [ ] SSM parameters configured
- [ ] ECS task definitions reference correct parameters
- [ ] IAM role has permissions to read secrets
- [ ] `ALLOWED_ORIGINS` has production URLs
- [ ] `JWT_SECRET` is strong and rotated
- [ ] Database URL points to RDS

---

## Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - AWS deployment guide
- [architecture.md](./architecture.md) - System architecture
