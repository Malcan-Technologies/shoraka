# Create Migration ECR Repository

You need to create the ECR repository for the migration container.

## Option 1: AWS CLI (Quick)

```bash
aws ecr create-repository \
  --repository-name cashsouk-migrate \
  --region ap-southeast-5 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

## Option 2: AWS Console

1. Go to **ECR Console**: https://ap-southeast-5.console.aws.amazon.com/ecr/repositories
2. Click **"Create repository"**
3. Repository name: `cashsouk-migrate`
4. Enable **Tag immutability**: Enabled (recommended)
5. Enable **Scan on push**: Enabled (recommended)
6. Encryption: **AES-256**
7. Click **"Create repository"**

---

That's it! The repository will be created and GitHub Actions will be able to push to it.
