# Production GitHub Secrets Setup

This document lists **all GitHub secrets** you need to add for production deployment.

## 📍 Where to Add Secrets

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/YOUR_REPO`
2. Click **Settings**
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**

---

## 🔑 Required GitHub Secrets

### 1. AWS Authentication

#### `AWS_DEPLOY_ROLE_ARN`

**Value:**

```
arn:aws:iam::652821469470:role/GitHubActionsECRPushRole
```

**Purpose:** Allows GitHub Actions to authenticate with AWS via OIDC and deploy to ECR/ECS.

---

### 2. Frontend Build Variables (Next.js - Build Time)

These are **build-time** environment variables that get baked into the Next.js bundles. They must be available during Docker build.

#### `NEXT_PUBLIC_API_URL`

**Value:**

```
https://api.cashsouk.com
```

**Purpose:** API endpoint URL for all frontend applications (Landing, Investor, Issuer, Admin).

**Used by:** All 4 frontend services (Landing, Investor, Issuer, Admin)

---

## 🔒 Optional Secrets (Add When Needed)

### Cognito Authentication (When Implementing Auth)

#### `NEXT_PUBLIC_COGNITO_DOMAIN`

**Value:** `https://cashsouk-prod.auth.ap-southeast-5.amazoncognito.com`

#### `NEXT_PUBLIC_COGNITO_CLIENT_ID`

**Value:** Get from AWS Cognito User Pool

#### `NEXT_PUBLIC_COGNITO_REGION`

**Value:** `ap-southeast-5`

---

### Analytics (Optional)

#### `NEXT_PUBLIC_GA_TRACKING_ID`

**Value:** Your Google Analytics tracking ID (e.g., `G-XXXXXXXXXX`)

#### `NEXT_PUBLIC_HOTJAR_ID`

**Value:** Your Hotjar site ID

---

### Error Tracking (Optional)

#### `NEXT_PUBLIC_SENTRY_DSN`

**Value:** Your Sentry DSN URL

#### `SENTRY_AUTH_TOKEN`

**Value:** Sentry auth token for source maps upload

---

## 🚀 Backend Runtime Configuration (AWS Secrets Manager)

**Important:** Backend (API) secrets are **NOT stored in GitHub**. They are stored in **AWS Secrets Manager** and injected at runtime via ECS Task Definition.

The following are configured in AWS, not GitHub:

### ✅ Already Configured (No Action Needed):

1. **Database Connection** - Already configured in `infra/ecs-task-definition-api.json`
   - Individual secrets pulled from RDS master secret: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
   - API automatically constructs `DATABASE_URL` from these at runtime

### ✅ Already Configured (No Action Needed):

2. **CORS Configuration** - Already added to `infra/ecs-task-definition-api.json`
   - `ALLOWED_ORIGINS` - `https://cashsouk.com,https://investor.cashsouk.com,https://issuer.cashsouk.com,https://admin.cashsouk.com`

### 📝 Add Later (When Implementing Features):

1. **JWT Secrets** (When implementing custom auth)
   - `JWT_SECRET` - Strong random secret
   - `JWT_EXPIRES_IN` - `15m`
   - `JWT_REFRESH_EXPIRES_IN` - `7d`

2. **AWS Services**
   - `AWS_REGION` - `ap-southeast-5`
   - `S3_BUCKET` - Your S3 bucket name
   - `S3_PREFIX` - `uploads/`

3. **Cognito** (When implementing auth)
   - `COGNITO_USER_POOL_ID`
   - `COGNITO_CLIENT_ID`
   - `COGNITO_REGION`

4. **Email (SES)**
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `EMAIL_FROM`

5. **Payment Gateway** (When integrating payments)
   - `PAYMENT_GATEWAY_API_KEY`
   - `PAYMENT_GATEWAY_SECRET`
   - `PAYMENT_GATEWAY_WEBHOOK_SECRET`

---

## ✅ Minimum Setup for Production Deployment

To deploy all services to production, you need **2 GitHub secrets**:

1. ✅ `AWS_DEPLOY_ROLE_ARN` - For AWS authentication
2. ✅ `NEXT_PUBLIC_API_URL` - For frontend API calls

**Backend configuration is already done!** ✅

- Database credentials automatically pulled from RDS master secret
- `ALLOWED_ORIGINS` already configured in ECS task definition

---

## 📋 Quick Setup Checklist

### GitHub Secrets (Add in GitHub Settings → Secrets)

- [ ] `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::652821469470:role/GitHubActionsECRPushRole` (Already added ✅)
- [ ] `NEXT_PUBLIC_API_URL` = `https://api.cashsouk.com` (Need to add)

### AWS Configuration (Already Configured ✅)

- [x] Database connection (configured in `infra/ecs-task-definition-api.json`)
- [x] API `ALLOWED_ORIGINS` (configured in `infra/ecs-task-definition-api.json`)

### Later (When Implementing Features)

- [ ] Cognito secrets (GitHub + AWS)
- [ ] Analytics tracking IDs (GitHub)
- [ ] Payment gateway credentials (AWS)
- [ ] Email/SMTP configuration (AWS)

---

## 🔐 Security Best Practices

### ✅ DO:

- Store all sensitive backend secrets in AWS Secrets Manager
- Use GitHub Secrets only for build-time variables
- Rotate secrets regularly
- Use strong, randomly generated secrets for JWT, etc.
- Enable AWS Secrets Manager rotation for database credentials

### ❌ DON'T:

- Hardcode secrets in code
- Commit `.env` files to Git
- Share secrets via Slack/email
- Use weak or predictable secrets
- Store production secrets in GitHub Secrets (only build-time vars)

---

## 🔄 How It Works

### Build Time (GitHub Actions)

1. GitHub Actions reads **`NEXT_PUBLIC_*`** secrets
2. Creates `.env.production` files for Next.js builds
3. Builds Docker images with environment variables baked in
4. Pushes images to ECR

### Runtime (ECS)

1. ECS Task Definition references **AWS Secrets Manager** secrets
2. Container starts with runtime environment variables injected
3. API connects to database, S3, SES, etc. using runtime secrets
4. Frontend calls API at `NEXT_PUBLIC_API_URL`

---

## 📝 Environment Variable Reference

| Variable              | GitHub Secret           | AWS Secret       | Used By                          |
| --------------------- | ----------------------- | ---------------- | -------------------------------- |
| `NEXT_PUBLIC_API_URL` | ✅ Yes (build-time)     | ❌ No            | Landing, Investor, Issuer, Admin |
| `DATABASE_URL`        | ❌ No                   | ✅ Yes (runtime) | API                              |
| `ALLOWED_ORIGINS`     | ❌ No                   | ✅ Yes (runtime) | API                              |
| `JWT_SECRET`          | ❌ No                   | ✅ Yes (runtime) | API                              |
| `COGNITO_*`           | ✅ Yes (NEXT*PUBLIC*\*) | ✅ Yes (backend) | Frontend + API                   |
| `S3_BUCKET`           | ❌ No                   | ✅ Yes (runtime) | API                              |

---

## 🆘 Troubleshooting

### CORS Error in Production

**Problem:** Frontend can't call API due to CORS error

**Solution:** Ensure `ALLOWED_ORIGINS` is set in API ECS Task Definition:

```bash
ALLOWED_ORIGINS=https://cashsouk.com,https://investor.cashsouk.com,https://issuer.cashsouk.com,https://admin.cashsouk.com
```

### API Can't Connect to Database

**Problem:** API container can't connect to RDS

**Solution:** Check ECS Task Definition has database credentials from AWS Secrets Manager:

- Either: `DATABASE_URL` secret
- Or: Individual `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` secrets

### Frontend Shows "http://localhost:4000" in Production

**Problem:** `NEXT_PUBLIC_API_URL` not set correctly during build

**Solution:** Verify GitHub secret `NEXT_PUBLIC_API_URL` is set to `https://api.cashsouk.com`

---

## 📚 Related Documentation

- [AWS Secrets Manager Setup](./RDS_SETUP_GUIDE.md)
- [ECS Database Connection](./ECS_DATABASE_CONNECTION_GUIDE.md)
- [Deployment Guide](./docs/deployment/deployment.md)
- [Environment Variables Guide](./docs/guides/environment-variables.md)
