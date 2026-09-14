#!/bin/bash

set -e

echo "🔐 Creating migrate/admin DATABASE_URL secret in AWS Secrets Manager..."
echo ""
echo "This creates cashsouk/database-url for the ECS migrate task (cashsouk_admin)."
echo "API runtime must use cashsouk/app-database-url instead; do not point the API task here."
echo ""

# Get RDS endpoint
echo "📋 Fetching RDS endpoint..."
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier cashsouk-db \
  --region ap-southeast-5 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

if [ -z "$RDS_ENDPOINT" ]; then
  echo "❌ Could not find RDS instance 'cashsouk-db'"
  exit 1
fi

echo "✅ RDS Endpoint: $RDS_ENDPOINT"
echo ""

# Prompt for database credentials
read -p "Enter database username (default: cashsouk_admin): " DB_USER
DB_USER=${DB_USER:-cashsouk_admin}

read -sp "Enter database password: " DB_PASSWORD
echo ""

read -p "Enter database name (default: cashsouk): " DB_NAME
DB_NAME=${DB_NAME:-cashsouk}

read -p "Enter database port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:${DB_PORT}/${DB_NAME}?schema=public"

echo ""
echo "📦 Creating secret 'cashsouk/database-url' in Secrets Manager..."

# Create the secret (this will be a plain string, not JSON)
aws secretsmanager create-secret \
  --name "cashsouk/database-url" \
  --description "PostgreSQL connection string for CashSouk migrations (cashsouk_admin)" \
  --secret-string "$DATABASE_URL" \
  --region ap-southeast-5

echo ""
echo "✅ Secret created successfully!"
echo ""
echo "📋 Secret ARN (for reference):"
aws secretsmanager describe-secret \
  --secret-id "cashsouk/database-url" \
  --region ap-southeast-5 \
  --query 'ARN' \
  --output text

echo ""
echo "Done. The ECS migrate task should keep this secret."
echo "API task DATABASE_URL must remain cashsouk/app-database-url."
echo ""

