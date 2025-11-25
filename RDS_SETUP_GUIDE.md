# RDS Database Setup Guide

## Prerequisites

Before running the setup script, ensure:

### 1. Security Group Configuration

Update your RDS security group (`cashsouk-rds-sg`) to allow your IP:

**AWS Console → EC2 → Security Groups → cashsouk-rds-sg → Edit inbound rules**

Add rule:
- Type: PostgreSQL
- Port: 5432
- Source: `My IP` (or your specific IP address)

### 2. AWS CLI Configured

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your Secret Access Key
# Default region: ap-southeast-5
# Default output format: json
```

### 3. Test Connection

```bash
psql -h cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com \
     -U cashsouk_admin \
     -d cashsouk
# Enter password when prompted: O|u*d)HN9?0UL8h$9Z7p01JlQ?L|
```

If this works, proceed to the next step.

---

## Run Setup Script

The automated script will:
1. ✅ Create application user (`cashsouk_app`) with limited permissions
2. ✅ Run all Prisma migrations to create your schema
3. ✅ Create AWS Secrets Manager secret for ECS
4. ✅ Generate connection strings

```bash
cd /Users/ivan/Documents/Shoraka
./scripts/setup-rds-database.sh
```

**Expected output:**
```
🚀 Setting up CashSouk RDS Database...
📝 Generated app user password: xxxxx
🔌 Testing connection to RDS...
✅ Connection successful!
👤 Creating application user 'cashsouk_app'...
✅ User 'cashsouk_app' created with permissions!
📦 Running Prisma migrations...
✅ Migrations completed!
🔐 Creating AWS Secrets Manager secret for application...
✅ Secret created!
✅ Database setup complete!
```

---

## Configure ECS Task Definition

After the script completes, update your ECS task definition to use the secret:

### Option 1: Reference the entire secret (Recommended)

```json
{
  "containerDefinitions": [
    {
      "name": "api",
      "secrets": [
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:prod/cashsouk/db:host::"
        },
        {
          "name": "DB_PORT",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:prod/cashsouk/db:port::"
        },
        {
          "name": "DB_USERNAME",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:prod/cashsouk/db:username::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:prod/cashsouk/db:password::"
        },
        {
          "name": "DB_NAME",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:prod/cashsouk/db:dbname::"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://$(DB_USERNAME):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?schema=public&connection_limit=5"
        }
      ]
    }
  ]
}
```

### Option 2: Use a Lambda to build DATABASE_URL (Advanced)

Create a Lambda that reads the secret and constructs the full `DATABASE_URL`, then stores it as a separate parameter.

---

## Grant ECS Task Role Permissions

Your ECS task role needs permission to read the database secret.

**IAM Console → Roles → [Your ECS Task Role] → Add permissions → Create inline policy**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-southeast-5:652821469470:secret:prod/cashsouk/db-*"
      ]
    }
  ]
}
```

---

## Local Development Setup

For local development, update your `apps/api/.env`:

```bash
# The script will output the full DATABASE_URL
# It will look something like:
DATABASE_URL="postgresql://cashsouk_app:xxxxxxxxx@cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432/cashsouk?schema=public&connection_limit=5"
```

**Or** create an SSH tunnel to RDS and use localhost:

```bash
# If you have a bastion host
ssh -L 5432:cashsouk-prod-db.c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com:5432 ec2-user@bastion-ip

# Then in .env
DATABASE_URL="postgresql://cashsouk_app:password@localhost:5432/cashsouk?schema=public"
```

---

## Testing the Setup

1. **Test Prisma connection:**
   ```bash
   cd apps/api
   pnpm prisma db pull
   # Should show your schema
   ```

2. **Test API locally:**
   ```bash
   cd apps/api
   pnpm dev
   # API should start without errors
   ```

3. **Verify tables created:**
   ```bash
   psql -h cashsouk-prod-proxy.proxy-c5ayu8mwom04.ap-southeast-5.rds.amazonaws.com \
        -U cashsouk_app \
        -d cashsouk \
        -c "\dt"
   # Should list: User, AccessLog, UserSession, etc.
   ```

---

## Troubleshooting

### Connection timeout
- Check security group allows your IP
- Check RDS is in public subnet (or you're connected via VPN/bastion)
- Verify endpoint is correct

### Authentication failed
- Double-check username and password
- Ensure you're using the correct user (master vs app)

### Migrations fail
- Ensure master user has DDL permissions (should by default)
- Check Prisma schema is valid: `pnpm prisma validate`

### ECS can't connect
- Verify ECS security group can reach RDS security group on port 5432
- Verify task role has Secrets Manager permissions
- Check CloudWatch logs for connection errors

---

## Summary

After running the script, you'll have:

✅ Production database ready with schema  
✅ Secure application user with limited permissions  
✅ RDS Proxy configured for connection pooling  
✅ Credentials stored in AWS Secrets Manager  
✅ ECS-ready configuration  

**Next:** Deploy your API to ECS and it will automatically connect to the database!

