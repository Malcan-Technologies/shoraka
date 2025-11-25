# How to Get VPC Subnet and Security Group IDs

## Option 1: From Existing ECS Service (Easiest!)

Since you already have ECS services running, you can get the exact VPC config from them:

```bash
# Get VPC config from your API service
aws ecs describe-services \
  --cluster default \
  --services api-cashsouk-09ff \
  --region ap-southeast-5 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration' \
  --output json
```

This will show you:
```json
{
  "subnets": [
    "subnet-XXXXX",
    "subnet-YYYYY"
  ],
  "securityGroups": [
    "sg-ZZZZZ"
  ],
  "assignPublicIp": "DISABLED"
}
```

## Option 2: From AWS Console

### Find Subnets:

1. Go to **VPC Console**: https://console.aws.amazon.com/vpc/
2. Click **Subnets** in left sidebar
3. Filter by VPC: `vpc-029487f8dd6fd7166` (from your screenshot)
4. You need **2 private subnets** in different Availability Zones
5. Copy the subnet IDs (format: `subnet-XXXXX`)

Look for subnets named:
- Something like "private-subnet-1" or "PrivateSubnet1"
- Something like "private-subnet-2" or "PrivateSubnet2"

### Find Security Groups:

From your screenshot, you have these relevant security groups:

**For Migration Task (needs DB access):**
- `sg-0417ed3b972640d72` (cashsouk-rds-sg) - The RDS security group

**OR use the API security group (which already has RDS access):**
- `sg-0f699f7ae290e3979` (default-api-cashsouk-09ff)

## Option 3: Using AWS CLI

```bash
# List all subnets in your VPC
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-029487f8dd6fd7166" \
  --region ap-southeast-5 \
  --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

## What You Need

Based on your setup, you need to update these lines in both workflow files:

**Current (placeholder):**
```yaml
--network-configuration "awsvpcConfiguration={subnets=[subnet-0a1b2c3d4e5f6a7b8,subnet-0c9b8a7d6e5f4a3b2],securityGroups=[sg-0123456789abcdef0],assignPublicIp=DISABLED}"
```

**Update to (using your values):**
```yaml
--network-configuration "awsvpcConfiguration={subnets=[YOUR_SUBNET_1,YOUR_SUBNET_2],securityGroups=[sg-0f699f7ae290e3979],assignPublicIp=DISABLED}"
```

## Recommended Approach

**Run this command to get exact values from your running API service:**

```bash
aws ecs describe-services \
  --cluster default \
  --services api-cashsouk-09ff \
  --region ap-southeast-5 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration' \
  --output json
```

Copy the subnet IDs and security group from the output and use them in your workflows!

---

## Quick Check

Your migration task needs:
- ✅ **Subnets**: 2 private subnets from your VPC
- ✅ **Security Group**: `sg-0f699f7ae290e3979` (API security group - already has RDS access)
- ✅ **Assign Public IP**: DISABLED (runs in private subnet)
