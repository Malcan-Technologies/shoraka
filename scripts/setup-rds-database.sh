#!/bin/bash
set -euo pipefail

# RDS database setup for CashSouk.
# Creates the application role (if missing), applies DML-only grants, optionally
# runs Prisma migrations as the admin role, and upserts cashsouk/app-database-url.
#
# Runtime (API ECS task) uses cashsouk/app-database-url (cashsouk_app).
# Migrations (ECS migrate task) use cashsouk/database-url (cashsouk_admin) and
# are not overwritten here.
#
# Target architecture: production RDS is private. Operator laptops, bastions,
# and VPNs have no route. Run this from ECS (API or migrate task network), which
# is the only application path that retains TCP 5432.

echo "Setting up CashSouk RDS database (app role least privilege)..."

AWS_REGION="${AWS_REGION:-ap-southeast-5}"
# ECS uses the task role. Do not default a named profile — that fails in ECS
# (no cashsouk profile on the task). Set AWS_PROFILE only on a host that has it.
AWS_PROFILE="${AWS_PROFILE:-${AWS_DEFAULT_PROFILE:-}}"
RDS_HOST="${RDS_HOST:-cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com}"
RDS_PROXY_HOST="${RDS_PROXY_HOST:-cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com}"
# Runtime secret host must stay the private instance endpoint that pentest verified
# for API ECS. RDS Proxy remains an allowed SG source for pooling, but do not
# rewrite cashsouk/app-database-url to the proxy by default — both live secrets
# currently use RDS_HOST. Override APP_DB_HOST only when intentionally pointing
# runtime at the proxy.
APP_DB_HOST="${APP_DB_HOST:-$RDS_HOST}"
DB_NAME="${DB_NAME:-cashsouk}"
MASTER_USER="${MASTER_USER:-cashsouk_admin}"
MASTER_SECRET_ID="${MASTER_SECRET_ID:-rds!db-71798d0b-adc4-4acb-a5e7-0a3275e77182}"
APP_USER="${APP_USER:-cashsouk_app}"
APP_SECRET_NAME="${APP_SECRET_NAME:-cashsouk/app-database-url}"
MIGRATE_SECRET_NAME="cashsouk/database-url"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"

aws_sm() {
  if [ -n "$AWS_PROFILE" ]; then
    aws --profile "$AWS_PROFILE" --region "$AWS_REGION" secretsmanager "$@"
  else
    aws --region "$AWS_REGION" secretsmanager "$@"
  fi
}

if [ -z "${MASTER_PASS:-}" ]; then
  MASTER_SECRET_JSON=$(aws_sm get-secret-value \
    --secret-id "$MASTER_SECRET_ID" \
    --query SecretString \
    --output text)
  MASTER_PASS=$(printf '%s' "$MASTER_SECRET_JSON" | jq -r '.password // empty')
  unset MASTER_SECRET_JSON
fi

if [ -z "${MASTER_PASS:-}" ]; then
  echo "Master password is not available. Set MASTER_PASS or allow Secrets Manager access to $MASTER_SECRET_ID."
  echo "Run from the ECS API or migrate task network; operator laptops, bastions, and VPNs have no route to private RDS."
  exit 1
fi

psql_admin() {
  PGPASSWORD="$MASTER_PASS" psql -h "$RDS_HOST" -U "$MASTER_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

echo "Testing connection to RDS..."
if ! psql_admin -c "SELECT version();" > /dev/null; then
  echo "Cannot connect to RDS."
  echo "Target architecture: production RDS is private; operator laptops have no direct route."
  echo "Run this script from the ECS API or migrate task network. Operator laptops, bastions, and VPNs have no route to private RDS."
  exit 1
fi
echo "Connection successful."
echo ""

APP_ROLE_EXISTS=$(psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}'" | tr -d '[:space:]')
APP_PASS="${APP_PASS:-}"

if [ "$APP_ROLE_EXISTS" != "1" ]; then
  if [ -z "$APP_PASS" ]; then
    APP_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
  fi
  echo "Creating application role '$APP_USER'..."
  psql_admin -v app_pass="$APP_PASS" <<SQL
CREATE USER ${APP_USER} LOGIN PASSWORD :'app_pass';
SQL
else
  echo "Application role '$APP_USER' already exists."
  if [ -n "$APP_PASS" ]; then
    echo "Refusing to rotate '$APP_USER' from this script."
    echo "ALTER USER before updating Secrets Manager and restarting ECS would desync running API tasks."
    echo "Leave APP_PASS unset to apply grants only. Coordinate password rotation separately."
    exit 1
  fi
fi

echo "Applying DML-only grants (no CREATE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN)..."
psql_admin <<SQL
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${APP_USER};

REVOKE ALL ON SCHEMA public FROM ${APP_USER};
GRANT USAGE ON SCHEMA public TO ${APP_USER};
REVOKE CREATE ON SCHEMA public FROM ${APP_USER};

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${APP_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_USER};
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM ${APP_USER};

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${APP_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER};

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM ${APP_USER};

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${APP_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};
SQL

echo "Grants applied."
echo ""

if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "Running Prisma migrations as admin (DDL). Production deploys should use the ECS migrate task."
  ENCODED_MASTER_PASS=$(printf %s "$MASTER_PASS" | jq -sRr @uri)
  (
    cd "$(dirname "$0")/../apps/api"
    DATABASE_URL="postgresql://${MASTER_USER}:${ENCODED_MASTER_PASS}@${RDS_HOST}:5432/${DB_NAME}?schema=public" \
      pnpm prisma migrate deploy
  )
  unset ENCODED_MASTER_PASS
  echo "Migrations completed."
  echo ""
fi

if [ -n "$APP_PASS" ]; then
  echo "Upserting runtime secret $APP_SECRET_NAME (will not modify $MIGRATE_SECRET_NAME)..."
  ENCODED_APP_PASS=$(printf %s "$APP_PASS" | jq -sRr @uri)
  APP_DATABASE_URL="postgresql://${APP_USER}:${ENCODED_APP_PASS}@${APP_DB_HOST}:5432/${DB_NAME}?schema=public&connection_limit=5&sslmode=require"
  unset ENCODED_APP_PASS

  if aws_sm describe-secret --secret-id "$APP_SECRET_NAME" > /dev/null 2>&1; then
    aws_sm update-secret \
      --secret-id "$APP_SECRET_NAME" \
      --secret-string "$APP_DATABASE_URL" \
      --description "CashSouk API runtime DATABASE_URL (cashsouk_app, DML only)" \
      > /dev/null
  else
    aws_sm create-secret \
      --name "$APP_SECRET_NAME" \
      --description "CashSouk API runtime DATABASE_URL (cashsouk_app, DML only)" \
      --secret-string "$APP_DATABASE_URL" \
      > /dev/null
  fi
  unset APP_DATABASE_URL
  echo "Runtime secret upserted."
else
  echo "APP_PASS unset and role already existed; grants were applied without rotating $APP_SECRET_NAME."
fi

unset MASTER_PASS
unset APP_PASS

echo ""
echo "Database setup complete."
echo "  Admin/migrations secret: $MIGRATE_SECRET_NAME (unchanged; ECS migrate task)"
echo "  App/runtime secret: $APP_SECRET_NAME (API ECS task DATABASE_URL)"
echo "  App role: $APP_USER (USAGE on schema; SELECT/INSERT/UPDATE/DELETE on tables; USAGE/SELECT on sequences)"
echo "  Target network: private RDS; operator laptops have no direct route"
echo ""
