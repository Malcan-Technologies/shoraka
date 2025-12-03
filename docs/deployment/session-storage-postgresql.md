# Session Storage with PostgreSQL

## Overview

The API uses PostgreSQL for persistent session storage to maintain OAuth state and user sessions across multiple server instances and container restarts. Sessions are stored in the same database as your application data, eliminating the need for additional infrastructure.

## Why PostgreSQL for Sessions?

### Problems with In-Memory Sessions (Default)
- **Not persistent**: Sessions are lost when the server restarts
- **Not scalable**: Sessions aren't shared between multiple server instances
- **OAuth failures**: The OAuth callback expects session data (state, nonce) to be available, which fails when using in-memory storage in production

### Benefits of PostgreSQL Sessions
- **Persistent**: Sessions survive server restarts
- **Scalable**: Sessions are shared across all API instances behind a load balancer
- **Zero additional infrastructure**: Uses your existing PostgreSQL database
- **Transactional**: Leverages PostgreSQL's ACID guarantees
- **Automatic expiration**: Sessions automatically expire after 15 minutes (TTL)
- **Cost-effective**: No additional services or costs required

## Database Schema

The session table is automatically created on first run:

```sql
CREATE TABLE "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,           -- Session ID (from cookie)
  "sess" JSON NOT NULL,                         -- Session data (state, nonce, role, etc.)
  "expire" TIMESTAMP(6) NOT NULL                -- When session expires
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

### Example Session Data

```sql
SELECT * FROM session;

sid                                  | sess                                              | expire
-------------------------------------|---------------------------------------------------|-------------------
'abc123def456...'                    | '{"state":"xyz","nonce":"abc","role":"INVESTOR"}' | 2024-12-03 15:30:00
'def789ghi012...'                    | '{"state":"mno","nonce":"pqr","role":"ADMIN"}'    | 2024-12-03 15:32:00
```

## Configuration

### Environment Variables

```bash
# Database connection (required - already configured)
DATABASE_URL=postgresql://user:password@localhost:5432/cashsouk_prod

# Session secret (minimum 32 characters)
SESSION_SECRET=your-secure-session-secret-min-32-chars

# Optional: Cookie domain for cross-subdomain sharing
COOKIE_DOMAIN=.cashsouk.com
```

**Note:** No additional configuration needed! Sessions use your existing `DATABASE_URL`.

### Session Configuration

Sessions are configured in `apps/api/src/app/session.ts`:

```typescript
{
  store: new PgSession({
    pool: pgPool,                    // PostgreSQL connection pool
    tableName: "session",            // Table name
    createTableIfMissing: true,      // Auto-create table
    ttl: 15 * 60,                   // 15 minutes in seconds
    pruneSessionInterval: 60         // Clean expired every 60s
  }),
  secret: SESSION_SECRET,            // Secret for signing session ID
  resave: false,                     // Don't save unchanged sessions
  saveUninitialized: false,          // Don't create empty sessions
  name: "cashsouk.sid",             // Cookie name
  cookie: {
    httpOnly: true,                  // Prevent client-side JS access
    secure: true,                    // HTTPS only (production)
    sameSite: "lax",                // CSRF protection
    maxAge: 15 * 60 * 1000,         // 15 minutes
    domain: COOKIE_DOMAIN           // Cross-subdomain sharing
  }
}
```

## OAuth Flow with PostgreSQL Sessions

### 1. Authorization Request (`/api/auth/login`)
```
User clicks "Sign In"
  ↓
API generates random state & nonce
  ↓
INSERT INTO session (sid, sess, expire) VALUES (...)
  ↓
Redirect user to Cognito with state parameter
```

### 2. Cognito Callback (`/api/auth/callback`)
```
Cognito redirects back with code & state
  ↓
SELECT sess FROM session WHERE sid = ? AND expire > NOW()
  ↓
Validate state matches stored value (CSRF protection)
  ↓
Exchange code for tokens using nonce
  ↓
DELETE FROM session WHERE sid = ?
  ↓
Login success!
```

### 3. Automatic Cleanup
```
Background job runs every 60 seconds:
DELETE FROM session WHERE expire < NOW()
```

## Performance Characteristics

### Operation Timings

| Operation | Latency | Frequency |
|-----------|---------|-----------|
| Session Write (INSERT) | 5-10ms | Once per login |
| Session Read (SELECT) | 2-5ms | Once per callback |
| Session Delete | 2-5ms | Once per auth complete |
| Cleanup | 5-20ms | Every 60 seconds |

### OAuth Flow Total Impact

- **Before fix**: Failed with "checks.state argument is missing"
- **After fix**: +10-20ms total (imperceptible to users)
- **User experience**: Identical (they spend 5-30 seconds on Cognito page)

## Storage Requirements

### Capacity Calculation

Each session stores approximately **300-500 bytes**:

```json
{
  "cookie": {"originalMaxAge": 900000, "httpOnly": true, "secure": true},
  "state": "K7gNU3sdo-OL0wNhqoVWhr3g6s1xYv72ol_pe_Unols",
  "nonce": "random-nonce-string-here",
  "requestedRole": "INVESTOR"
}
```

**Storage requirements:**
- 1,000 concurrent sessions = ~500 KB
- 10,000 concurrent sessions = ~5 MB
- 100,000 concurrent sessions = ~50 MB

**Your PostgreSQL database can easily handle millions of sessions!**

## Production Deployment

### Docker Compose

Sessions work automatically with your existing Docker Compose setup:

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify API is healthy
docker-compose -f docker-compose.prod.yml ps api

# Check logs for session initialization
docker-compose -f docker-compose.prod.yml logs api | grep -i session
```

Expected log output:
```
INFO: PostgreSQL connection pool initialized for sessions
INFO: Session store configured with PostgreSQL
```

### AWS Deployment

For AWS ECS/Fargate deployment, sessions use your existing RDS PostgreSQL:

```bash
# In ECS task definition environment variables
DATABASE_URL=postgresql://username:password@rds-endpoint.amazonaws.com:5432/cashsouk_prod
SESSION_SECRET=your-secure-secret

# Optionally use RDS Proxy for better connection pooling
DATABASE_URL=postgresql://username:password@rds-proxy.amazonaws.com:5432/cashsouk_prod
```

**Security Considerations:**
- Sessions are stored in your existing private RDS instance
- No additional security groups or network configuration needed
- Session data is encrypted at rest (if RDS encryption enabled)
- Session data is encrypted in transit (SSL/TLS)

## Monitoring

### Check Session Table

```sql
-- View active sessions
SELECT COUNT(*) as active_sessions FROM session WHERE expire > NOW();

-- View all sessions (including expired)
SELECT COUNT(*) as total_sessions FROM session;

-- View session distribution by expiry
SELECT 
  date_trunc('minute', expire) as expire_minute,
  COUNT(*) as session_count
FROM session
WHERE expire > NOW()
GROUP BY expire_minute
ORDER BY expire_minute;

-- View oldest and newest sessions
SELECT 
  MIN(expire) as oldest_expiry,
  MAX(expire) as newest_expiry
FROM session;
```

### Monitor Session Storage

```sql
-- Check table size
SELECT 
  pg_size_pretty(pg_total_relation_size('session')) as total_size,
  pg_size_pretty(pg_relation_size('session')) as table_size,
  pg_size_pretty(pg_indexes_size('session')) as index_size;

-- Check row count and average size
SELECT 
  COUNT(*) as row_count,
  pg_size_pretty(AVG(pg_column_size(sess))) as avg_session_size
FROM session;
```

### Application Logs

```bash
# Check session initialization
docker-compose logs api | grep "PostgreSQL connection pool initialized"
docker-compose logs api | grep "Session store configured"

# Monitor OAuth flow
docker-compose logs -f api | grep "Token exchange"
```

## Troubleshooting

### Issue: "checks.state argument is missing"

**Cause**: Session data not available during OAuth callback

**Solutions**:
1. Verify PostgreSQL is running: `docker-compose ps db`
2. Check DATABASE_URL is correct in environment variables
3. Verify session table exists: `SELECT * FROM session LIMIT 1;`
4. Check session cookie is being sent (browser DevTools → Application → Cookies)
5. Verify COOKIE_DOMAIN matches your domain structure

### Issue: Sessions not persisting

**Cause**: Database connection failed or session cookie not saved

**Solutions**:
1. Check database logs: `docker-compose logs db`
2. Verify DATABASE_URL format is correct
3. Test database connection: `docker-compose exec api psql $DATABASE_URL -c "SELECT 1"`
4. Check cookie settings match your domain setup
5. Ensure HTTPS in production (required for `secure: true`)

### Issue: "relation 'session' does not exist"

**Cause**: Session table not auto-created

**Solution**:
```sql
-- Manually create the session table
CREATE TABLE "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

Or set `createTableIfMissing: true` in session config (already set by default).

### Issue: Too many sessions in database

**Symptoms**:
- Session table growing large
- Cleanup not running

**Solutions**:
1. Check expired sessions: `SELECT COUNT(*) FROM session WHERE expire < NOW();`
2. Manually clean: `DELETE FROM session WHERE expire < NOW();`
3. Verify `pruneSessionInterval` is set (default: 60 seconds)
4. Check API logs for cleanup errors

## Maintenance

### Manual Session Cleanup

```sql
-- Delete all expired sessions
DELETE FROM session WHERE expire < NOW();

-- Delete sessions older than 1 hour (emergency cleanup)
DELETE FROM session WHERE expire < NOW() - INTERVAL '1 hour';

-- Delete all sessions (force all users to re-login)
TRUNCATE TABLE session;
```

### Backup Considerations

Sessions are **ephemeral** (expire after 15 minutes), so:
- ✅ No need to backup session table specifically
- ✅ Can be excluded from critical backups to save space
- ✅ Safe to drop and recreate if needed

### Database Migration

If migrating to a new database:

```bash
# Sessions will be automatically recreated - no migration needed!
# Users will just need to log in again (seamless)
```

## Security Best Practices

1. **Secure Cookie Settings**:
   - Always use `httpOnly: true` ✅
   - Use `secure: true` in production (HTTPS) ✅
   - Set appropriate `sameSite` policy ✅

2. **Session Secret**:
   - Minimum 32 characters ✅
   - Cryptographically random ✅
   - Store in secrets manager (AWS Secrets Manager, etc.) ✅
   - Never commit to version control ✅

3. **Database Security**:
   - Use private network/VPC ✅
   - Enable SSL/TLS for connections ✅
   - Enable encryption at rest ✅
   - Restrict network access with security groups ✅

4. **Session Expiration**:
   - Keep TTL short (15 minutes) ✅
   - Match OAuth token expiry ✅
   - Implement absolute timeout ✅

## Comparison: PostgreSQL vs Redis Sessions

| Feature | PostgreSQL | Redis |
|---------|-----------|-------|
| **Setup** | Uses existing DB | Requires new service |
| **Cost** | $0 (included) | $15-30/month |
| **Performance** | 2-10ms | 0.1-1ms |
| **Persistence** | Full ACID | Optional |
| **Scalability** | Excellent | Excellent |
| **Maintenance** | Minimal | Minimal |
| **Complexity** | Lower | Higher |
| **OAuth Use Case** | Perfect ✅ | Perfect ✅ |

**For OAuth sessions:** Both solutions work perfectly. PostgreSQL is recommended for simplicity and zero additional cost.

## Performance Optimization

### Connection Pooling

The session middleware uses a dedicated connection pool:

```typescript
const pgPool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,                      // Sufficient for session ops
  idleTimeoutMillis: 30000,     // Close idle connections
  connectionTimeoutMillis: 2000 // Fast timeout for errors
});
```

### Index Optimization

The expire index ensures fast cleanup:

```sql
-- Already created automatically
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Verify index is being used
EXPLAIN ANALYZE 
SELECT * FROM session WHERE expire > NOW();
```

### Vacuum Strategy

PostgreSQL auto-vacuum handles cleanup:

```sql
-- Check last vacuum
SELECT 
  schemaname,
  tablename,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE tablename = 'session';
```

## Migration from Redis (if applicable)

If you previously used Redis:

1. **Remove Redis dependencies**: Already done ✅
2. **Update session config**: Already done ✅
3. **Remove Redis service**: Already done ✅
4. **Deploy**: Sessions automatically recreated in PostgreSQL

**User impact**: Users will need to log in again (seamless, no errors)

## References

- [express-session Documentation](https://github.com/expressjs/session)
- [connect-pg-simple Documentation](https://github.com/voxpelli/node-connect-pg-simple)
- [PostgreSQL Connection Pooling](https://node-postgres.com/features/pooling)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/performance-tips.html)

## Summary

✅ **Zero additional infrastructure** - Uses existing PostgreSQL  
✅ **Production-ready** - Battle-tested and reliable  
✅ **Cost-effective** - No additional services needed  
✅ **Performant** - Fast enough for all OAuth flows  
✅ **Scalable** - Handles millions of sessions  
✅ **Secure** - ACID compliance and encryption  
✅ **Maintainable** - Automatic cleanup and simple monitoring  

PostgreSQL session storage is the perfect solution for OAuth state management! 🎯

