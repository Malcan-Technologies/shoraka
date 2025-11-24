# ✅ AWS Setup Checklist - Do This First!

Before running any deployment scripts, you need to set up AWS authentication on your local machine.

## 🎯 Step-by-Step Checklist

### ☐ Step 1: Get AWS Account Access

You need:

- [ ] AWS account (create one at aws.amazon.com if needed)
- [ ] IAM user with admin permissions (or permissions to create IAM roles, ECR, ECS)
- [ ] Do NOT use root account credentials

### ☐ Step 2: Create AWS Access Keys

1. [ ] Log in to AWS Console
2. [ ] Go to **IAM** → **Users** → Click your username
3. [ ] Click **Security credentials** tab
4. [ ] Click **Create access key**
5. [ ] Choose **"Command Line Interface (CLI)"**
6. [ ] Click **Next**, then **Create access key**
7. [ ] **IMPORTANT:** Copy both:
   - Access Key ID (looks like: `AKIAIOSFODNN7EXAMPLE`)
   - Secret Access Key (looks like: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
8. [ ] Download the CSV file (backup) or keep the browser tab open

### ☐ Step 3: Install AWS CLI

**Mac:**

```bash
brew install awscli
```

**Windows:**
Download from: https://aws.amazon.com/cli/

**Linux:**

```bash
sudo apt install awscli -y
# or
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Verify installation:**

```bash
aws --version
```

Should show: `aws-cli/2.x.x` or similar

### ☐ Step 4: Configure AWS CLI

Run this command:

```bash
aws configure
```

**When prompted, enter:**

```
AWS Access Key ID [None]: <paste your Access Key ID>
AWS Secret Access Key [None]: <paste your Secret Access Key>
Default region name [None]: ap-southeast-5
Default output format [None]: json
```

**Example:**

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: ap-southeast-5
Default output format [None]: json
```

### ☐ Step 5: Test AWS CLI Works

Run this command:

```bash
aws sts get-caller-identity
```

**Expected output:**

```json
{
  "UserId": "AIDAIOSFODNN7EXAMPLE",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

**If you see this, you're ready!** ✅

**If you get an error:**

- "Unable to locate credentials" → Rerun `aws configure`
- "Invalid security token" → Double-check your access keys
- "Access Denied" → Your IAM user needs more permissions

### ☐ Step 6: Create AWS Infrastructure

**Choose one approach:**

#### Option A: Automated CLI Script ⚡ (RECOMMENDED)

Fast, automated, no mistakes:

```bash
cd /Users/ivan/Documents/Shoraka
./scripts/complete-aws-setup.sh YOUR_GITHUB_USERNAME/Shoraka
```

**Example:**

```bash
./scripts/complete-aws-setup.sh ivan/Shoraka
```

Takes 3 minutes. Creates all AWS resources automatically.

#### Option B: Manual AWS Console 🖱️

Prefer clicking through AWS web interface?

See: **[docs/deployment/manual-aws-console-setup.md](./docs/deployment/manual-aws-console-setup.md)**

Takes 30-45 minutes. Good for learning.

#### Not Sure Which?

See: **[docs/deployment/SETUP_COMPARISON.md](./docs/deployment/SETUP_COMPARISON.md)**

**Quick recommendation:**

- 🏃 Want fast? → Use CLI script
- 🎓 Want to learn? → Use manual console
- 🤷 Not sure? → Use CLI script (it's faster and safer)

### ☐ Step 7: Copy the Output

The script will output:

```
Add GitHub Secret:
  Name:  AWS_DEPLOY_ROLE_ARN
  Value: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
```

**Copy this ARN!** You'll add it as a GitHub secret in the next step.

---

## 🔒 Security Notes

### ✅ Safe to Do:

- Store credentials in `~/.aws/credentials` (created by `aws configure`)
- Keep AWS access keys private
- Use credentials on your local machine for setup

### ❌ NEVER Do:

- Commit AWS credentials to Git
- Share AWS access keys
- Put access keys in GitHub secrets (we use OIDC instead!)
- Use root account credentials
- Hardcode credentials in code

---

## 🤔 FAQ

**Q: Where do I get AWS Access Keys?**
A: AWS Console → IAM → Users → Your username → Security credentials → Create access key

**Q: Do I need a credit card for AWS?**
A: Yes, AWS requires payment info, but most services have free tier. ECS Fargate costs will apply.

**Q: What region should I use?**
A: `ap-southeast-5` (Malaysia) - already configured in the setup

**Q: Can I use my root AWS account?**
A: No! Create an IAM user with admin permissions instead. This is a security best practice.

**Q: Will this put my AWS keys in GitHub?**
A: No! Your AWS keys stay on your machine. GitHub uses OIDC (temporary tokens) to deploy.

**Q: What if I don't have admin permissions?**
A: Ask your AWS admin to grant you permissions to create:

- IAM roles and policies
- ECR repositories
- ECS clusters
- CloudWatch log groups
- OIDC providers

**Q: Do I need to do this every time I deploy?**
A: No! Only once for initial setup. After that, GitHub Actions deploys automatically.

---

## 📊 What Happens After Setup?

```
You (Local Machine)
    ↓
  aws configure (your credentials)
    ↓
  Run setup script
    ↓
  Creates AWS resources:
    • IAM Roles (3)
    • ECR Repos (5)
    • ECS Cluster
    • CloudWatch Logs
    • OIDC Provider
    ↓
  You add GitHub secret (AWS_DEPLOY_ROLE_ARN)
    ↓
  Push code to GitHub
    ↓
  GitHub Actions uses OIDC to deploy
    ↓
  Running on AWS! 🎉
```

---

## ✅ Final Checklist

Before proceeding to deployment, verify:

- [ ] AWS CLI installed (`aws --version` works)
- [ ] AWS configured (`aws configure` completed)
- [ ] Test works (`aws sts get-caller-identity` shows your account)
- [ ] Setup script ran successfully (`./scripts/complete-aws-setup.sh`)
- [ ] You have the `AWS_DEPLOY_ROLE_ARN` value

**All checked?** Proceed to **DEPLOYMENT_QUICKSTART.md** for the next steps!

---

## 🆘 Still Stuck?

1. Check **docs/deployment/aws-authentication-explained.md** for detailed auth flow
2. Verify your IAM permissions in AWS Console
3. Try creating a new access key
4. Make sure you're using IAM user, not root account
