# AWS Setup: CLI Script vs Manual Console

Quick comparison to help you choose the best approach for setting up AWS infrastructure.

## 📊 Quick Comparison

| Factor | CLI Script | Manual Console |
|--------|-----------|----------------|
| **Time** | ⚡ 3 minutes | 🕐 30-45 minutes |
| **Difficulty** | Easy (if AWS CLI configured) | Medium (lots of steps) |
| **Error prone** | ✅ Low (automated) | ⚠️ Higher (manual entry) |
| **Learning** | 📖 Learn automation | 🎓 Learn AWS deeply |
| **Repeatable** | ✅ Yes (run script again) | ❌ No (manual each time) |
| **Prerequisites** | AWS CLI + credentials | Just AWS account + browser |
| **Best for** | Production, teams, repeat setups | Learning, first time, visual preference |

## 🎯 Decision Guide

### Choose **CLI Script** if:

✅ You want the fastest setup  
✅ You're comfortable with command line  
✅ You want infrastructure as code  
✅ You might recreate this in other accounts/regions  
✅ You want to automate everything  
✅ You're setting up for a team  
✅ You value consistency and repeatability  

**👉 Use:** `./scripts/complete-aws-setup.sh`

---

### Choose **Manual Console** if:

✅ You're new to AWS and want to learn  
✅ You prefer visual interfaces  
✅ You want to understand each component  
✅ You want to see exactly what's being created  
✅ You're setting up for learning/education  
✅ You don't want to install AWS CLI  
✅ You like clicking through wizards  

**👉 Use:** [Manual Setup Guide](./manual-aws-console-setup.md)

---

## 🔄 Hybrid Approach (Best of Both Worlds)

**Week 1 - Learn:**
1. Follow manual console guide
2. Take notes on what each component does
3. Understand IAM roles, policies, trust relationships
4. See how services connect

**Week 2 - Automate:**
1. Delete everything you created manually (optional)
2. Run the CLI script
3. Compare script output to what you created
4. Understand how automation works

**Benefits:**
- ✅ Deep understanding from manual setup
- ✅ Fast automation for future setups
- ✅ Best learning experience

---

## 📝 What Gets Created (Both Methods)

Both approaches create the exact same resources:

### IAM Roles (3)

1. **ecsTaskExecutionRole**
   - Purpose: ECS service pulls images and writes logs
   - Trusted by: `ecs-tasks.amazonaws.com`
   - Policies: AmazonECSTaskExecutionRolePolicy, AmazonSSMReadOnlyAccess

2. **ecsTaskRole**
   - Purpose: Your application accesses AWS services
   - Trusted by: `ecs-tasks.amazonaws.com`
   - Policies: CashSoukECSTaskPolicy (custom - S3, Cognito, SSM access)

3. **GitHubActionsDeployRole**
   - Purpose: GitHub Actions deploys your app
   - Trusted by: GitHub OIDC provider (only your repo!)
   - Policies: GitHubActionsDeployPolicy (custom - ECR, ECS, IAM passRole)

### ECR Repositories (5)

- `cashsouk-api` - API Docker images
- `cashsouk-landing` - Landing page images
- `cashsouk-investor` - Investor portal images
- `cashsouk-issuer` - Issuer portal images
- `cashsouk-admin` - Admin portal images

### ECS Cluster (1)

- `cashsouk-prod` - Fargate cluster for running containers

### CloudWatch Log Groups (6)

- `/aws/ecs/cashsouk-api` - API logs
- `/aws/ecs/cashsouk-landing` - Landing logs
- `/aws/ecs/cashsouk-investor` - Investor logs
- `/aws/ecs/cashsouk-issuer` - Issuer logs
- `/aws/ecs/cashsouk-admin` - Admin logs
- `/aws/ecs/cashsouk-migrations` - Migration logs

### OIDC Provider (1)

- `token.actions.githubusercontent.com` - GitHub OIDC authentication

---

## 💰 Cost Comparison

**Setup itself:** FREE (both methods)

**Resources created:** FREE (no running costs until you deploy containers)

**After deployment:**
- ECS Fargate: ~$0.04/vCPU-hour + ~$0.004/GB-hour
- ECR storage: ~$0.10/GB-month
- CloudWatch logs: ~$0.50/GB ingested
- Data transfer: varies

**Estimate:** ~$50-100/month for basic production setup (5 small containers)

---

## ⚠️ Common Mistakes (Manual Setup)

If you choose manual setup, watch out for:

1. **Wrong Account ID** in trust policies
2. **Wrong GitHub repo name** in GitHubActionsDeployRole trust policy
3. **Typos in resource names** (must match exactly)
4. **Wrong region** (must be ap-southeast-5)
5. **Missing policies** on roles
6. **Wrong OIDC thumbprint** (must click "Get thumbprint")

**CLI script avoids all these mistakes automatically!**

---

## 🎓 Learning Path

### Beginner to AWS?

**Week 1:** Manual console setup (learn)
- Read AWS docs as you go
- Understand IAM, ECR, ECS concepts
- Take screenshots

**Week 2:** CLI script (automate)
- Compare with manual setup
- Read the script to understand automation
- Practice infrastructure as code

### Experienced with AWS?

**Day 1:** CLI script (fast track)
- Run script, deploy immediately
- Review script code to understand resources
- Customize as needed

---

## 🔍 What to Use for Different Environments

| Environment | Recommended Approach | Why |
|-------------|---------------------|-----|
| **Production** | CLI Script | Fast, repeatable, documented |
| **Staging** | CLI Script | Same config as production |
| **Development** | CLI Script | Quick setup/teardown |
| **Learning** | Manual Console | Understand concepts |
| **Demo** | CLI Script | Fast setup for demos |
| **Client Setup** | CLI Script | Professional, consistent |

---

## ✅ My Recommendation

### 👨‍💻 If you're a developer who wants to ship fast:
**Use the CLI script.** Save time, reduce errors, move on to building features.

### 🎓 If you're learning AWS:
**Start with manual console.** Understand the "why" behind each resource. Then use the script for future projects.

### 🏢 If you're setting up for a team:
**Use the CLI script.** Document it, version control it, make it repeatable for all team members.

---

## 📚 Next Steps

**Chose CLI Script?**
1. Run `./scripts/complete-aws-setup.sh ivan/Shoraka`
2. Continue with DEPLOYMENT_QUICKSTART.md Step 3

**Chose Manual Console?**
1. Follow [manual-aws-console-setup.md](./manual-aws-console-setup.md)
2. Return to DEPLOYMENT_QUICKSTART.md Step 3 when done

**Not sure?**
1. Read AWS_SETUP_CHECKLIST.md first
2. Try manual console for learning
3. Use CLI script for actual production deployment

---

## 🤔 Still Deciding?

**Ask yourself:**
- Do I have AWS CLI installed? → Yes? Use script
- Is this my first time with AWS? → Yes? Try manual first
- Am I deploying to production? → Yes? Use script
- Do I want to learn AWS deeply? → Yes? Try manual first
- Am I in a hurry? → Yes? Use script
- Will I recreate this setup? → Yes? Use script

**When in doubt, use the CLI script.** You can always explore the AWS console after to see what was created.

