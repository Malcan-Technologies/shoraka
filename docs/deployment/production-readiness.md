# Production Readiness Checklist

This document outlines all steps required to prepare the CashSouk platform for production deployment.

## Pre-Deployment Checklist

### 1. Security & Secrets

- [ ] **Remove hardcoded credentials**
  - [ ] Update `docker-compose.prod.yml` to use environment variables for database credentials
  - [ ] Never commit `.env.prod` files to git (verify `.gitignore` includes them)
  - [ ] Use secrets management (AWS Secrets Manager, HashiCorp Vault, or Docker secrets)

- [ ] **Environment Variables**
  - [ ] Create `.env.prod` files for all services from templates in `env-templates/`
  - [ ] Set strong `JWT_SECRET` (minimum 32 characters, cryptographically random)
  - [ ] Set `SESSION_SECRET` (minimum 32 characters)
  - [ ] Configure `DATABASE_URL` with production RDS endpoint
  - [ ] Set `ALLOWED_ORIGINS` to production frontend URLs only
  - [ ] Verify `NODE_ENV=production` in all services
  - [ ] Configure AWS Cognito production credentials
  - [ ] Set payment gateway production API keys
  - [ ] Configure SMTP credentials for email service

- [ ] **Database Security**
  - [ ] Change default PostgreSQL password
  - [ ] Use strong database password (minimum 16 characters, mixed case, numbers, symbols)
  - [ ] Restrict database port (5432) to internal network only (remove public port mapping in production)
  - [ ] Enable SSL/TLS for database connections
  - [ ] Configure database backup strategy

### 2. Docker Compose Configuration

- [x] **Resource Limits**
  - [x] Set CPU and memory limits for all services
  - [x] Configure resource reservations

- [x] **Health Checks**
  - [x] Add health checks to all services
  - [x] Configure appropriate intervals and timeouts
  - [x] Fix API port mapping (4000:4000 instead of 4000:3000)

- [x] **Service Dependencies**
  - [x] Use `depends_on` with health check conditions
  - [x] Ensure services wait for dependencies to be healthy

- [ ] **Network Security**
  - [ ] Remove unnecessary port exposures (use reverse proxy)
  - [ ] Configure firewall rules
  - [ ] Use internal networks for service-to-service communication

- [ ] **Logging**
  - [ ] Configure centralized logging (CloudWatch, ELK, etc.)
  - [ ] Set log retention policies
  - [ ] Ensure structured logging (Pino) is configured

### 3. Database Migrations

- [ ] **Prisma Migrations**
  - [ ] Run `pnpm prisma migrate deploy` to apply all migrations
  - [ ] Verify migration status: `pnpm prisma migrate status`
  - [ ] Test rollback procedures
  - [ ] Create database backup before migration

- [ ] **Database Indexes**
  - [ ] Verify all indexes are created
  - [ ] Run `EXPLAIN ANALYZE` on critical queries
  - [ ] Monitor slow query log

- [ ] **Seed Data**
  - [ ] **DO NOT** run seed scripts in production
  - [ ] Verify no seed data is included in production builds

### 4. Application Configuration

- [ ] **API Configuration**
  - [ ] Verify `DISABLE_AUTH` is NOT set or is `false`
  - [ ] Configure rate limiting (IP + user-based)
  - [ ] Enable CORS for production domains only
  - [ ] Configure Helmet security headers
  - [ ] Set up request correlation IDs

- [ ] **Frontend Configuration**
  - [ ] Set `NEXT_PUBLIC_API_URL` to production API URL
  - [ ] Configure production Cognito domain
  - [ ] Verify all build-time environment variables are set
  - [ ] Test SSR and static asset serving

- [ ] **Error Handling**
  - [ ] Ensure production error responses don't expose stack traces
  - [ ] Configure error monitoring (Sentry, etc.)
  - [ ] Set up alerting for critical errors

### 5. Infrastructure

- [ ] **Reverse Proxy / Load Balancer**
  - [ ] Configure nginx/traefik/ALB for routing
  - [ ] Set up SSL/TLS certificates (Let's Encrypt or ACM)
  - [ ] Configure HTTPS redirect
  - [ ] Set up domain names:
    - [ ] `api.cashsouk.com` → API service
    - [ ] `cashsouk.com` → Landing page
    - [ ] `investor.cashsouk.com` → Investor portal
    - [ ] `issuer.cashsouk.com` → Issuer portal
    - [ ] `admin.cashsouk.com` → Admin portal

- [ ] **Monitoring & Observability**
  - [ ] Set up application performance monitoring (APM)
  - [ ] Configure health check endpoints
  - [ ] Set up uptime monitoring
  - [ ] Configure log aggregation
  - [ ] Set up metrics collection (CPU, memory, disk, network)
  - [ ] Configure alerting thresholds

- [ ] **Backup & Disaster Recovery**
  - [ ] Configure automated database backups
  - [ ] Test backup restoration procedure
  - [ ] Document disaster recovery plan
  - [ ] Set backup retention policy (minimum 30 days)

### 6. Testing

- [ ] **Pre-Production Testing**
  - [ ] Run full test suite: `pnpm -w test`
  - [ ] Run E2E tests: `pnpm -w e2e`
  - [ ] Test authentication flows
  - [ ] Test critical user journeys
  - [ ] Load testing (minimum 100 concurrent users)
  - [ ] Security scanning (OWASP, Snyk, etc.)

- [ ] **Smoke Tests**
  - [ ] Health check endpoints respond correctly
  - [ ] API authentication works
  - [ ] Database connectivity verified
  - [ ] Frontend portals load correctly
  - [ ] Static assets serve correctly

### 7. Documentation

- [ ] **Operational Documentation**
  - [ ] Document deployment procedure
  - [ ] Document rollback procedure
  - [ ] Document environment variable requirements
  - [ ] Document database migration procedure
  - [ ] Document monitoring and alerting setup
  - [ ] Document incident response procedure

### 8. Compliance & Legal

- [ ] **Data Protection**
  - [ ] Verify PII is not logged
  - [ ] Configure data retention policies
  - [ ] Ensure GDPR compliance (if applicable)
  - [ ] Set up data encryption at rest and in transit

- [ ] **Audit & Logging**
  - [ ] Enable audit logging for admin actions
  - [ ] Configure log retention per compliance requirements
  - [ ] Set up log access controls

## Deployment Steps

1. **Pre-Deployment**
   ```bash
   # Verify environment files exist
   ls -la apps/*/.env.prod
   
   # Verify no secrets in git
   git grep -i "password\|secret\|key" -- "*.yml" "*.yaml" "*.ts" "*.tsx" | grep -v "env\|template"
   
   # Run tests
   pnpm -w test
   pnpm -w e2e
   ```

2. **Database Setup**
   ```bash
   # Backup existing database (if any)
   pg_dump -h localhost -U postgres cashsouk_prod > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Run migrations
   cd apps/api
   pnpm prisma migrate deploy
   ```

3. **Build Images**
   ```bash
   # Build all images
   docker-compose -f docker-compose.prod.yml build
   
   # Verify images
   docker images | grep cashsouk
   ```

4. **Deploy Services**
   ```bash
   # Start services
   docker-compose -f docker-compose.prod.yml up -d
   
   # Check health
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs -f
   ```

5. **Post-Deployment Verification**
   ```bash
   # Check health endpoints
   curl http://localhost:4000/healthz
   curl http://localhost:3000/api/health
   
   # Verify services are running
   docker-compose -f docker-compose.prod.yml ps
   
   # Check logs for errors
   docker-compose -f docker-compose.prod.yml logs | grep -i error
   ```

## Critical Security Reminders

⚠️ **NEVER:**
- Commit `.env.prod` files to git
- Use default passwords
- Expose database port publicly
- Enable `DISABLE_AUTH` in production
- Run seed scripts in production
- Log sensitive data (passwords, tokens, PII)
- Use development API keys in production

✅ **ALWAYS:**
- Use secrets management for sensitive values
- Enable authentication and authorization
- Use HTTPS/TLS everywhere
- Monitor logs for security events
- Keep dependencies updated
- Regular security audits

## Environment Variable Requirements

### Required for All Services
- `NODE_ENV=production`

### API Service (`apps/api/.env.prod`)
- `DATABASE_URL` (from secrets)
- `JWT_SECRET` (from secrets, min 32 chars)
- `SESSION_SECRET` (from secrets, min 32 chars)
- `ALLOWED_ORIGINS` (comma-separated production URLs)
- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`
- `COGNITO_REGION`
- `AWS_REGION`
- `S3_BUCKET`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`
- `PAYMENT_GATEWAY_API_KEY`, `PAYMENT_GATEWAY_SECRET`

### Frontend Services (`apps/*/.env.prod`)
- `NEXT_PUBLIC_API_URL` (production API URL)
- `NEXT_PUBLIC_COGNITO_DOMAIN` (if using custom domain)

## Rollback Procedure

If deployment fails:

1. **Stop new services**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Restore database** (if migrations were applied)
   ```bash
   psql -h localhost -U postgres cashsouk_prod < backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Revert to previous version**
   ```bash
   git checkout <previous-commit>
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Monitoring Checklist

After deployment, verify:

- [ ] All services show as "healthy" in health checks
- [ ] No errors in application logs
- [ ] Database connections are stable
- [ ] API response times are acceptable (< 200ms p95)
- [ ] Memory and CPU usage are within limits
- [ ] Disk space is sufficient
- [ ] SSL certificates are valid
- [ ] All endpoints are accessible
- [ ] Authentication flows work correctly
- [ ] Email notifications are being sent (if applicable)

## Support Contacts

- **Infrastructure Team**: [Contact Info]
- **Security Team**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

---

**Last Updated**: [Date]
**Version**: 1.0.0




