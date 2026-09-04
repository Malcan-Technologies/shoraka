# Environment Templates

This directory contains environment file templates for local development and production testing.

## Setup Instructions

### For Local Development

Copy the `.env.local` templates to each app directory:

```bash
cp env-templates/landing.env.local apps/landing/.env.local
cp env-templates/investor.env.local apps/investor/.env.local
cp env-templates/issuer.env.local apps/issuer/.env.local
cp env-templates/admin.env.local apps/admin/.env.local
cp env-templates/api.env.local apps/api/.env.local
```

Then edit each file to add your local configuration values.

### For Production Testing

Copy the `.env.prod` templates to each app directory:

```bash
cp env-templates/landing.env.prod apps/landing/.env.prod
cp env-templates/investor.env.prod apps/investor/.env.prod
cp env-templates/issuer.env.prod apps/issuer/.env.prod
cp env-templates/admin.env.prod apps/admin/.env.prod
cp env-templates/api.env.prod apps/api/.env.prod
```

Then edit each file to add your production-like configuration values (for local testing with `docker-compose.prod.yml`).

## Quick Setup Script

```bash
# Copy all development templates
for app in landing investor issuer admin api; do
  cp env-templates/$app.env.local apps/$app/.env.local
done

# Copy all production templates
for app in landing investor issuer admin api; do
  cp env-templates/$app.env.prod apps/$app/.env.prod
done
```

## Important Notes

- **Never commit `.env.local` or `.env.prod` files** - they are gitignored
- Fill in actual values after copying (Cognito IDs, S3 buckets, etc.)
- For AWS deployment, environment variables are injected via SSM/Secrets Manager (no files needed)
- Templates are safe to commit as they contain no secrets
- API Curlec credentials use account-specific `CURLEC_OPERATING_*` and `CURLEC_INVESTOR_POOL_*` vars plus shared `CURLEC_API_BASE_URL`.
- Plain support uses `PLAIN_API_KEY`, `PLAIN_CHAT_APP_ID`, and `PLAIN_CHAT_SECRET` on the API. Issuer, investor, and landing also set `NEXT_PUBLIC_PLAIN_CHAT_APP_ID` and `NEXT_PUBLIC_HELP_CENTER_URL`. Admin has no Plain vars (no chat widget). Do not put the API key or chat secret in `NEXT_PUBLIC_*` vars.

