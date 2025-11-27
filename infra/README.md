# ECS Task Definitions

This directory contains ECS Fargate task definitions for all Shoraka services.

## Task Definitions

- `ecs-task-definition-landing.json` - Landing page service
- `ecs-task-definition-investor.json` - Investor portal service
- `ecs-task-definition-issuer.json` - Issuer portal service
- `ecs-task-definition-admin.json` - Admin dashboard service
- `ecs-task-definition-api.json` - API service
- `ecs-task-definition-migrate.json` - Database migration runner (one-shot task)

## Configuration

Before deploying, update the following placeholders in each file:

1. **ACCOUNT_ID**: Your AWS account ID
2. **ARNs**: Update role ARNs for execution and task roles
3. **Secrets**: Verify SSM Parameter Store paths match your setup

## Portal Services (landing, investor, issuer, admin)

All portal services use similar configuration:

- **CPU**: 512 (0.5 vCPU)
- **Memory**: 1024 MB
- **Port**: 3000 (internal)
- **Health Check**: HTTP GET on `/` (accepts statusCode < 500)

### Environment Variables (via SSM):

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_CLOUDFRONT_URL`

## API Service

- **CPU**: 1024 (1 vCPU)
- **Memory**: 2048 MB
- **Port**: 4000 (internal)
- **Health Check**: HTTP GET on `/healthz` (requires statusCode === 200)

### Environment Variables (via SSM/Secrets Manager):

- `DATABASE_URL` (Secret)
- `RDS_PROXY_ENDPOINT`
- `S3_BUCKET`
- `S3_PREFIX`
- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`
- `JWT_ISSUER`
- `ALLOWED_ORIGINS`

## Migrations Task

Special one-shot task for running Prisma migrations:

- **CPU**: 256 (0.25 vCPU)
- **Memory**: 512 MB
- **Command**: `cd apps/api && npx prisma migrate deploy`
- **No health check** (exits after completion)

### Usage:

```bash
aws ecs run-task \
  --cluster default \
  --task-definition cashsouk-migrations:1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-xxx],
    securityGroups=[sg-xxx],
    assignPublicIp=DISABLED
  }"
```

## Registering Task Definitions

```bash
# Register all task definitions
for file in ecs-task-definition-*.json; do
  # Update ACCOUNT_ID placeholder
  sed "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g" $file > /tmp/$file
  
  # Register with ECS
  aws ecs register-task-definition --cli-input-json file:///tmp/$file
done
```

## CloudWatch Logs

Each service writes logs to its own log group:

- `/ecs/cashsouk-landing`
- `/ecs/cashsouk-investor`
- `/ecs/cashsouk-issuer`
- `/ecs/cashsouk-admin`
- `/ecs/cashsouk-api`
- `/ecs/cashsouk-migrations`

Create log groups before first deployment:

```bash
for service in landing investor issuer admin api migrations; do
  aws logs create-log-group --log-group-name /ecs/cashsouk-$service --region ap-southeast-5
  aws logs put-retention-policy --log-group-name /ecs/cashsouk-$service --retention-in-days 30
done
```

## Task Roles

### Execution Role

Allows ECS to:
- Pull images from ECR
- Write to CloudWatch Logs
- Read secrets from Secrets Manager/SSM

### Task Role (API only)

Allows application to:
- Read/write S3 bucket
- Read SSM parameters
- Write CloudWatch metrics (optional)

### Task Role (Portals)

Minimal permissions:
- Write CloudWatch metrics (optional)

## Health Checks

All services have container-level health checks:

- **Interval**: 30 seconds
- **Timeout**: 5 seconds
- **Retries**: 3
- **Start Period**: 60 seconds (allows app warmup)

**Portal Services**: Accept any non-server-error response (`statusCode < 500`)
**API Service**: Requires exact 200 status on `/healthz` endpoint

ALB also performs target group health checks independently.

## Updating Task Definitions

When making changes:

1. Edit the JSON file
2. Register new revision:
   ```bash
   aws ecs register-task-definition --cli-input-json file://ecs-task-definition-api.json
   ```
3. Update service to use new revision:
   ```bash
   aws ecs update-service \
     --cluster default \
     --service api-cashsouk-09ff \
     --task-definition default-api-cashsouk-09ff:2  # new revision number
   ```

Or use GitHub Actions workflow which automates this process.

## Troubleshooting

### Task fails to start

Check CloudWatch logs for startup errors:

```bash
aws logs tail /ecs/cashsouk-api --follow
```

### Environment variables not loading

Verify SSM parameters exist:

```bash
aws ssm get-parameter --name /cashsouk/prod/cognito/client-id
```

### Permission denied errors

Check task role has necessary permissions:

```bash
aws iam get-role-policy --role-name ecsTaskRole --policy-name S3Access
```

## Best Practices

1. **Never hardcode secrets** - always use Secrets Manager/SSM
2. **Tag revisions** - use meaningful descriptions
3. **Test locally first** - use `docker-compose.prod.yml`
4. **Monitor resource usage** - adjust CPU/memory if needed
5. **Enable container insights** - for advanced monitoring
