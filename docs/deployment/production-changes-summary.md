# Production Changes Summary

## Changes Made to `docker-compose.prod.yml`

### ✅ Completed Updates

1. **Resource Limits & Reservations**
   - Added CPU and memory limits for all services
   - API: 2 CPU / 1GB memory limit, 1 CPU / 512MB reservation
   - Portals: 1 CPU / 512MB limit, 0.5 CPU / 256MB reservation
   - Database: 2 CPU / 2GB limit, 1 CPU / 1GB reservation

2. **Health Checks**
   - Fixed API port mapping (4000:4000 instead of 4000:3000)
   - Added health checks to all services
   - API: `/healthz` endpoint check
   - Portals: Root path (`/`) check using Node.js HTTP client
   - Database: `pg_isready` check

3. **Service Dependencies**
   - Updated `depends_on` to use health check conditions
   - Portals wait for API to be healthy
   - API waits for database to be healthy

4. **Database Configuration**
   - Added PostgreSQL performance tuning parameters
   - Added backup volume (`postgres_backups`)
   - Environment variables use `${VAR}` syntax for secrets
   - Added proper initialization arguments

5. **Build Arguments**
   - Added `NEXT_PUBLIC_API_URL` build arg for all portals
   - Defaults to `https://api.cashsouk.com` if not set

6. **Network Configuration**
   - Added IPAM subnet configuration
   - Better network isolation

7. **Environment Variables**
   - Added `NODE_ENV=production` to all services
   - Database credentials use environment variable substitution

## ⚠️ Critical Actions Required Before Production

### 1. **Secrets Management** (CRITICAL)

**Current Issue**: Database password is hardcoded in docker-compose.prod.yml

**Action Required**:
```bash
# Create a .env file at project root (DO NOT COMMIT)
POSTGRES_USER=your_prod_user
POSTGRES_PASSWORD=your_strong_password_here
POSTGRES_DB=cashsouk_prod
NEXT_PUBLIC_API_URL=https://api.cashsouk.com
```

**Better Approach**: Use Docker secrets or external secrets management:
```yaml
# In docker-compose.prod.yml, replace:
environment:
  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
  
# With Docker secrets (recommended for production):
secrets:
  - postgres_password
```

### 2. **Environment Files**

Create `.env.prod` files for each service from templates:

```bash
# Copy templates
cp env-templates/api.env.prod apps/api/.env.prod
cp env-templates/landing.env.prod apps/landing/.env.prod
cp env-templates/investor.env.prod apps/investor/.env.prod
cp env-templates/issuer.env.prod apps/issuer/.env.prod
cp env-templates/admin.env.prod apps/admin/.env.prod

# Edit each file with production values
# NEVER commit these files to git
```

### 3. **Database Security**

- [ ] Change default PostgreSQL password
- [ ] Use strong password (min 16 chars, mixed case, numbers, symbols)
- [ ] **Remove public port mapping** (5432) in production - use internal network only
- [ ] Enable SSL/TLS for database connections
- [ ] Configure database backup strategy

### 4. **Network Security**

- [ ] Remove or restrict public port mappings
- [ ] Use reverse proxy (nginx/traefik) for external access
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificates

### 5. **Port Exposure**

**Current**: All ports are exposed publicly
- `3000` - Landing
- `3001` - Issuer
- `3002` - Investor  
- `3003` - Admin
- `4000` - API
- `5432` - Database

**Recommended**: Remove port mappings and use reverse proxy:
```yaml
# Remove ports section or comment out:
# ports:
#   - "4000:4000"
```

### 6. **Database Migrations**

Before starting services:
```bash
# Run migrations
cd apps/api
pnpm prisma migrate deploy

# Verify
pnpm prisma migrate status
```

### 7. **Authentication**

Verify in `apps/api/.env.prod`:
- [ ] `DISABLE_AUTH` is NOT set or is `false`
- [ ] `JWT_SECRET` is set and strong (min 32 chars)
- [ ] `SESSION_SECRET` is set and strong (min 32 chars)

### 8. **CORS Configuration**

Verify `ALLOWED_ORIGINS` in `apps/api/.env.prod`:
```env
ALLOWED_ORIGINS=https://cashsouk.com,https://investor.cashsouk.com,https://issuer.cashsouk.com,https://admin.cashsouk.com
```

## Quick Start Commands

### 1. Prepare Environment
```bash
# Create .env files from templates
make setup-env-prod  # Or manually copy from env-templates/

# Set database password
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env
```

### 2. Build Images
```bash
docker-compose -f docker-compose.prod.yml build
```

### 3. Run Migrations
```bash
# Start database only
docker-compose -f docker-compose.prod.yml up -d db

# Wait for DB to be healthy
docker-compose -f docker-compose.prod.yml ps db

# Run migrations
cd apps/api
pnpm prisma migrate deploy
```

### 4. Start Services
```bash
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 5. Verify Health
```bash
# API health
curl http://localhost:4000/healthz

# Check all services
docker-compose -f docker-compose.prod.yml ps
```

## Testing Checklist

- [ ] All services show as "healthy"
- [ ] API `/healthz` returns 200
- [ ] Database connection works
- [ ] Frontend portals load
- [ ] Authentication flows work
- [ ] No errors in logs

## Files Modified

1. `docker-compose.prod.yml` - Production configuration updates
2. `docs/deployment/production-readiness.md` - Comprehensive checklist
3. `docs/deployment/production-changes-summary.md` - This file

## Next Steps

1. Review the full checklist in `docs/deployment/production-readiness.md`
2. Set up secrets management (Docker secrets, AWS Secrets Manager, etc.)
3. Configure reverse proxy for external access
4. Set up monitoring and alerting
5. Configure automated backups
6. Test deployment in staging environment first

---

**Important**: This docker-compose setup is suitable for production deployment, but you MUST:
- Use proper secrets management
- Remove public port exposures
- Set up reverse proxy/load balancer
- Configure SSL/TLS
- Set up monitoring
- Configure backups




