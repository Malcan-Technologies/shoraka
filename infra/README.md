# AWS Infrastructure Setup Guide

This guide walks you through setting up the complete AWS infrastructure for the CashSouk P2P lending platform.

## Prerequisites

- AWS Account with admin access
- AWS CLI v2 installed and configured
- Terraform or AWS Console access
- Domain name registered (for Route 53)

## Architecture Overview

```
Internet
   ↓
CloudFront + WAF
   ↓
Application Load Balancer (ALB)
   ↓
┌──────────────────────────────────────┐
│  ECS Fargate Services (5)            │
│  - cashsouk-landing                   │
│  - cashsouk-investor                  │
│  - cashsouk-issuer                    │
│  - cashsouk-admin                     │
│  - cashsouk-api                       │
└──────────────────────────────────────┘
   ↓
RDS Proxy → RDS PostgreSQL (Multi-AZ)
```

## Setup Steps

### 1. VPC & Networking

Create a VPC with the following specifications:

```bash
# VPC
CIDR: 10.0.0.0/16
Region: ap-southeast-5 (Malaysia)

# Subnets (across 3 AZs)
Public Subnets:
- 10.0.1.0/24 (ap-southeast-5a)
- 10.0.2.0/24 (ap-southeast-5b)
- 10.0.3.0/24 (ap-southeast-5c)

Private Subnets:
- 10.0.11.0/24 (ap-southeast-5a)
- 10.0.12.0/24 (ap-southeast-5b)
- 10.0.13.0/24 (ap-southeast-5c)

Database Subnets:
- 10.0.21.0/24 (ap-southeast-5a)
- 10.0.22.0/24 (ap-southeast-5b)
- 10.0.23.0/24 (ap-southeast-5c)
```

**AWS CLI Commands:**

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --region ap-southeast-5 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=cashsouk-prod-vpc}]' \
  --query 'Vpc.VpcId' \
  --output text)

# Enable DNS
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=cashsouk-prod-igw}]' \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# Create subnets (repeat for each AZ)
# Public subnets, private subnets, database subnets
# See full script in scripts/setup-aws.sh
```

### 2. Security Groups

```bash
# ALB Security Group
ALB_SG=$(aws ec2 create-security-group \
  --group-name cashsouk-prod-alb-sg \
  --description "Security group for CashSouk ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow HTTPS from internet
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow HTTP (for redirect)
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# ECS Security Group
ECS_SG=$(aws ec2 create-security-group \
  --group-name cashsouk-prod-ecs-sg \
  --description "Security group for CashSouk ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow traffic from ALB
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG

# RDS Security Group
RDS_SG=$(aws ec2 create-security-group \
  --group-name cashsouk-prod-rds-sg \
  --description "Security group for CashSouk RDS" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow PostgreSQL from ECS
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG
```

### 3. Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name cashsouk-prod-alb \
  --subnets subnet-xxx subnet-yyy subnet-zzz \  # Your public subnet IDs
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Create target groups (one per service)
TG_LANDING=$(aws elbv2 create-target-group \
  --name cashsouk-prod-tg-landing \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Repeat for investor, issuer, admin, api target groups

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:ap-southeast-5:xxx:certificate/xxx \
  --default-actions Type=fixed-response,FixedResponseConfig={StatusCode=404}

# Add host-based routing rules (see full script)
```

### 4. ECR Repositories

```bash
# Create ECR repositories
for repo in landing investor issuer admin api; do
  aws ecr create-repository \
    --repository-name cashsouk-$repo \
    --region ap-southeast-5 \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256
  
  # Set lifecycle policy (keep last 10 images)
  aws ecr put-lifecycle-policy \
    --repository-name cashsouk-$repo \
    --lifecycle-policy-text '{
      "rules": [{
        "rulePriority": 1,
        "description": "Keep last 10 images",
        "selection": {
          "tagStatus": "any",
          "countType": "imageCountMoreThan",
          "countNumber": 10
        },
        "action": {
          "type": "expire"
        }
      }]
    }'
done
```

### 5. ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name cashsouk-prod \
  --region ap-southeast-5 \
  --configuration executeCommandConfiguration={
    logging=OVERRIDE,
    logConfiguration={
      cloudWatchLogGroupName=/ecs/cashsouk-prod,
      cloudWatchEncryptionEnabled=true
    }
  } \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

### 6. IAM Roles

**Task Execution Role** (for ECS to pull images and logs):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Attach policies:
- `AmazonECSTaskExecutionRolePolicy`
- Custom policy for Secrets Manager read

**Task Role** (for application to access AWS services):

Policies needed:
- S3 read/write to uploads bucket
- SSM Parameter Store read
- Secrets Manager read
- CloudWatch Logs write

**GitHub Actions Deployer Role** (for OIDC):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/cashsouk:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

### 7. RDS PostgreSQL

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name cashsouk-prod-db-subnet \
  --db-subnet-group-description "CashSouk production database subnet group" \
  --subnet-ids subnet-db1 subnet-db2 subnet-db3 \
  --tags Key=Name,Value=cashsouk-prod-db-subnet

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier cashsouk-prod-postgres \
  --db-instance-class db.t4g.medium \
  --engine postgres \
  --engine-version 15.5 \
  --master-username cashsoukdmin \
  --master-user-password 'CHANGE_THIS_PASSWORD' \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name cashsouk-prod-db-subnet \
  --multi-az \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --db-name cashsouk_prod \
  --tags Key=Name,Value=cashsouk-prod-postgres
```

**RDS Proxy** (for connection pooling):

```bash
# Create RDS Proxy
aws rds create-db-proxy \
  --db-proxy-name cashsouk-prod-rds-proxy \
  --engine-family POSTGRESQL \
  --auth AuthScheme=SECRETS,SecretArn=arn:aws:secretsmanager:ap-southeast-5:xxx:secret:rds-db-credentials \
  --role-arn arn:aws:iam::xxx:role/RDSProxyRole \
  --vpc-subnet-ids subnet-db1 subnet-db2 subnet-db3 \
  --require-tls
```

### 8. S3 Buckets

```bash
# Uploads bucket
aws s3api create-bucket \
  --bucket cashsouk-prod-uploads-ACCOUNT_ID-ap-southeast-5 \
  --region ap-southeast-5 \
  --create-bucket-configuration LocationConstraint=ap-southeast-5

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket cashsouk-prod-uploads-ACCOUNT_ID-ap-southeast-5 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms"
      },
      "BucketKeyEnabled": true
    }]
  }'

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket cashsouk-prod-uploads-ACCOUNT_ID-ap-southeast-5 \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket cashsouk-prod-uploads-ACCOUNT_ID-ap-southeast-5 \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 9. Cognito User Pool

```bash
# Create user pool
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name cashsouk-prod-users \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --auto-verified-attributes email \
  --mfa-configuration OPTIONAL \
  --account-recovery-setting '{
    "RecoveryMechanisms": [{
      "Priority": 1,
      "Name": "verified_email"
    }]
  }' \
  --region ap-southeast-5 \
  --query 'UserPool.Id' \
  --output text)

# Create app client
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $POOL_ID \
  --client-name cashsouk-web \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --supported-identity-providers COGNITO \
  --callback-urls https://cashsouk.com/callback https://investor.cashsouk.com/callback \
  --logout-urls https://cashsouk.com https://investor.cashsouk.com \
  --allowed-o-auth-flows code implicit \
  --allowed-o-auth-scopes openid email profile \
  --query 'UserPoolClient.ClientId' \
  --output text)

# Create domain
aws cognito-idp create-user-pool-domain \
  --domain cashsouk-prod \
  --user-pool-id $POOL_ID
```

### 10. Secrets Manager / SSM Parameter Store

Store all secrets and configuration:

```bash
# Database URL
aws secretsmanager create-secret \
  --name /cashsouk/prod/database-url \
  --description "CashSouk production database URL" \
  --secret-string "postgresql://user:pass@rds-proxy-endpoint:5432/cashsouk_prod" \
  --region ap-southeast-5

# Cognito details (as parameters)
aws ssm put-parameter \
  --name /cashsouk/prod/cognito/user-pool-id \
  --value $POOL_ID \
  --type String \
  --region ap-southeast-5

aws ssm put-parameter \
  --name /cashsouk/prod/cognito/client-id \
  --value $CLIENT_ID \
  --type String \
  --region ap-southeast-5

# S3 bucket name
aws ssm put-parameter \
  --name /cashsouk/prod/s3/bucket-name \
  --value cashsouk-prod-uploads-ACCOUNT_ID-ap-southeast-5 \
  --type String \
  --region ap-southeast-5
```

### 11. CloudFront Distribution

```bash
# Create CloudFront distribution (via console or CloudFormation)
# Origin: S3 bucket (for static assets)
# Behaviors: default to S3, /api/* to ALB
# WAF: Associate AWS Managed Rules
```

### 12. Route 53 DNS

```bash
# Create hosted zone (if not exists)
ZONE_ID=$(aws route53 create-hosted-zone \
  --name cashsouk.com \
  --caller-reference $(date +%s) \
  --query 'HostedZone.Id' \
  --output text)

# Create A records pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "cashsouk.com",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "ALB_HOSTED_ZONE_ID",
            "DNSName": "ALB_DNS_NAME",
            "EvaluateTargetHealth": true
          }
        }
      }
    ]
  }'

# Repeat for investor.cashsouk.com, issuer.cashsouk.com, admin.cashsouk.com, api.cashsouk.com
```

### 13. ACM Certificates

```bash
# Request certificate for *.cashsouk.com
CERT_ARN=$(aws acm request-certificate \
  --domain-name cashsouk.com \
  --subject-alternative-names "*.cashsouk.com" \
  --validation-method DNS \
  --region ap-southeast-5 \
  --query 'CertificateArn' \
  --output text)

# Validate via DNS (add CNAME records to Route 53)
aws acm describe-certificate --certificate-arn $CERT_ARN
```

### 14. Deploy ECS Task Definitions

See `infra/ecs/` directory for task definition templates.

Register each task definition:

```bash
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-landing.json
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-investor.json
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-issuer.json
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-admin.json
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-api.json
aws ecs register-task-definition --cli-input-json file://infra/ecs/task-def-migrations.json
```

### 15. Create ECS Services

```bash
# Example for landing service
aws ecs create-service \
  --cluster cashsouk-prod \
  --service-name cashsouk-landing \
  --task-definition cashsouk-landing:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-private1,subnet-private2],
    securityGroups=[$ECS_SG],
    assignPublicIp=DISABLED
  }" \
  --load-balancers "targetGroupArn=$TG_LANDING,containerName=landing,containerPort=3000" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}"

# Repeat for other services
```

### 16. GitHub Secrets Configuration

In your GitHub repository settings, add these secrets:

- `AWS_ACCOUNT_ID`: Your AWS account ID
- `PRIVATE_SUBNET_IDS`: Comma-separated private subnet IDs
- `ECS_SECURITY_GROUP`: ECS security group ID
- `DATABASE_URL`: Database connection string (for migrations)

### 17. CloudWatch Alarms

Set up alarms for monitoring:

```bash
# ALB 5XX errors
aws cloudwatch put-metric-alarm \
  --alarm-name cashsouk-prod-alb-5xx \
  --alarm-description "ALB 5XX errors" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=LoadBalancer,Value=app/cashsouk-prod-alb/xxx

# RDS CPU
# ECS Service CPU/Memory
# ... (see full monitoring setup)
```

## Post-Deployment

1. **Test Health Checks**: Verify all services are healthy in ECS
2. **Test DNS**: Confirm all subdomains resolve correctly
3. **Test SSL**: Verify HTTPS works on all domains
4. **Test Deployment**: Push a change to main and verify GitHub Actions deployment
5. **Set up Monitoring**: Configure CloudWatch dashboards
6. **Set up Alerts**: Test alarm notifications
7. **Document**: Update runbook with any custom configurations

## Cost Estimate (Monthly)

- ECS Fargate (5 services, 0.5vCPU, 1GB each): ~$50
- RDS (db.t4g.medium, Multi-AZ): ~$60
- ALB: ~$25
- VPC Endpoints: ~$7
- S3 + CloudFront: ~$10
- Data Transfer: ~$10
- **Total: ~$162/month**

## Troubleshooting

### Service won't start
- Check CloudWatch logs: `/ecs/cashsouk-{service}`
- Verify environment variables in task definition
- Check security groups allow traffic

### Database connection fails
- Verify RDS Proxy endpoint
- Check security group rules
- Confirm DATABASE_URL in Secrets Manager

### GitHub Actions deployment fails
- Verify IAM role trust policy
- Check ECR permissions
- Confirm subnet IDs and security groups in workflow

## Support

For questions or issues, refer to:
- AWS Documentation: https://docs.aws.amazon.com
- CashSouk Architecture: `../architecture.md`
- Internal wiki: [Add your wiki link]

