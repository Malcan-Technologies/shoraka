#!/bin/bash
set -e

# RDS Database Setup Script for CashSouk
# This script:
# 1. Creates application database user
# 2. Sets up proper permissions
# 3. Runs Prisma migrations
# 4. Creates AWS Secrets Manager secret for the app

echo "🚀 Setting up CashSouk RDS Database..."

# Configuration
RDS_HOST="cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com"
RDS_PROXY_HOST="cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com"
DB_NAME="cashsouk"
MASTER_USER="cashsouk_admin"
MASTER_PASS='O|u*d)HN9?0UL8h$9Z7p01JlQ?L|'
APP_USER="cashsouk_app"
APP_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

echo "📝 Generated app user password: $APP_PASS"
echo ""

# Test connection
echo "🔌 Testing connection to RDS..."
if ! PGPASSWORD="$MASTER_PASS" psql -h "$RDS_HOST" -U "$MASTER_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
    echo "❌ Cannot connect to RDS. Please check:"
    echo "   1. Security group allows your IP address"
    echo "   2. RDS is publicly accessible (or you're connected via VPN)"
    echo "   3. Master credentials are correct"
    exit 1
fi
echo "✅ Connection successful!"
echo ""

# Create app user and set permissions
echo "👤 Creating application user '$APP_USER'..."
PGPASSWORD="$MASTER_PASS" psql -h "$RDS_HOST" -U "$MASTER_USER" -d "$DB_NAME" <<SQL
-- Create app user (ignore error if exists)
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$APP_USER') THEN
        CREATE USER $APP_USER WITH PASSWORD '$APP_PASS';
    END IF;
END
\$\$;

-- Grant database-level permissions
GRANT CONNECT ON DATABASE $DB_NAME TO $APP_USER;

-- Grant schema permissions
GRANT USAGE, CREATE ON SCHEMA public TO $APP_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $APP_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $APP_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $APP_USER;

-- Ensure future objects are also granted
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT ALL ON TABLES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT ALL ON SEQUENCES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT ALL ON FUNCTIONS TO $APP_USER;

-- Verify user creation
SELECT usename, usesuper, usecreatedb FROM pg_user WHERE usename = '$APP_USER';
SQL

echo "✅ User '$APP_USER' created with permissions!"
echo ""

# Run Prisma migrations
echo "📦 Running Prisma migrations..."
cd "$(dirname "$0")/../apps/api"

# Create .env file with master credentials for migration
cat > .env.migration <<ENV
DATABASE_URL="postgresql://${MASTER_USER}:${MASTER_PASS}@${RDS_HOST}:5432/${DB_NAME}?schema=public"
ENV

# URL-encode the password for Prisma (handles special characters)
ENCODED_PASS=$(printf %s "$MASTER_PASS" | jq -sRr @uri)

# Run migrations using master user (has DDL permissions)
DATABASE_URL="postgresql://${MASTER_USER}:${ENCODED_PASS}@${RDS_HOST}:5432/${DB_NAME}?schema=public" pnpm prisma migrate deploy

rm .env.migration
echo "✅ Migrations completed!"
echo ""

# Create AWS Secrets Manager secret for application
echo "🔐 Creating AWS Secrets Manager secret for application..."

SECRET_NAME="prod/cashsouk/db"
SECRET_VALUE=$(cat <<JSON
{
  "username": "$APP_USER",
  "password": "$APP_PASS",
  "engine": "postgres",
  "host": "$RDS_PROXY_HOST",
  "port": 5432,
  "dbname": "$DB_NAME",
  "dbInstanceIdentifier": "cashsouk-prod-db"
}
JSON
)

# Check if secret exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region ap-southeast-5 > /dev/null 2>&1; then
    echo "⚠️  Secret '$SECRET_NAME' already exists. Updating..."
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_VALUE" \
        --region ap-southeast-5
else
    echo "Creating new secret '$SECRET_NAME'..."
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "CashSouk production database credentials (app user via RDS Proxy)" \
        --secret-string "$SECRET_VALUE" \
        --region ap-southeast-5
fi

SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region ap-southeast-5 --query ARN --output text)

echo "✅ Secret created!"
echo ""

# Generate DATABASE_URL for application
DATABASE_URL="postgresql://${APP_USER}:${APP_PASS}@${RDS_PROXY_HOST}:5432/${DB_NAME}?schema=public&connection_limit=5"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Database setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo "  • Master user: $MASTER_USER (for admin/migrations)"
echo "  • App user: $APP_USER (for ECS application)"
echo "  • Database: $DB_NAME"
echo "  • Proxy endpoint: $RDS_PROXY_HOST"
echo ""
echo "🔐 AWS Secrets Manager:"
echo "  • Secret name: $SECRET_NAME"
echo "  • Secret ARN: $SECRET_ARN"
echo ""
echo "🔗 Connection strings:"
echo ""
echo "  App (via Proxy - USE THIS IN ECS):"
echo "  $DATABASE_URL"
echo ""
echo "  Direct (for migrations/admin):"
echo "  postgresql://${MASTER_USER}:[MASTER_PASS]@${RDS_HOST}:5432/${DB_NAME}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo "  1. Update ECS task definition to use secret: $SECRET_ARN"
echo "  2. Grant ECS task role permission to read this secret"
echo "  3. Deploy your API to ECS"
echo ""
echo "💾 Credentials saved to: ./rds-setup-summary.txt"

# Save summary to file
cat > "$(dirname "$0")/../rds-setup-summary.txt" <<SUMMARY
CashSouk RDS Database Setup Summary
Generated: $(date)

CREDENTIALS:
-----------
Master User: $MASTER_USER
Master Password: $MASTER_PASS
App User: $APP_USER
App Password: $APP_PASS

ENDPOINTS:
----------
Direct RDS: $RDS_HOST
RDS Proxy: $RDS_PROXY_HOST
Database: $DB_NAME

AWS SECRETS:
-----------
Secret Name: $SECRET_NAME
Secret ARN: $SECRET_ARN

CONNECTION STRINGS:
------------------
App (Proxy): $DATABASE_URL
Master (Direct): postgresql://${MASTER_USER}:${MASTER_PASS}@${RDS_HOST}:5432/${DB_NAME}

SUMMARY

echo "✅ Done!"

