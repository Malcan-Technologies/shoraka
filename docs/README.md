# CashSouk Documentation

Complete documentation for the CashSouk P2P Lending Platform.

## Quick Links

- 🚀 **[Local Development Setup](./guides/local-development-setup.md)** - Start coding in 5 minutes
- 📦 **[Deployment Guide](./deployment/deployment-guide.md)** - Push to deploy
- 🎨 **[Brand Guidelines](../BRANDING.md)** - Design system

## Documentation Structure

### 📚 Guides (For Developers)

Step-by-step guides for common tasks:

- **[Local Development Setup](./guides/local-development-setup.md)** - ⭐ Start here
- **[Development Workflow](./guides/development.md)** - Day-to-day tasks
- **[Database Workflow](./guides/database-workflow.md)** - Working with Prisma
- **[Authentication](./guides/authentication.md)** - Auth implementation (planned)
- **[Environment Variables](./guides/environment-variables.md)** - Configuration reference
- **[Notification Testing Guide](./guides/notifications/notification-testing-guide.md)** - Notification trigger map and test steps

### 📋 Application Flow

Feature guides for the issuer application wizard:

- **[Issuer Applications Dashboard](./guides/application-management/issuer-applications-dashboard.md)** - User flow, statuses, document download, invoice lock
- **[Amendment Flow](./guides/application-flow/amendment-flow.md)** - Amendment flow debugging (remarks, resubmit, stepper, tab locking)
- **[Financial Statements Step](./guides/application-flow/financial-statements-step.md)** - Application step architecture and data flow

### 📋 Application Lifecycle & Logging

Plain-text guides for application status rules and log events:

- **[Status Reference](./guides/application/status-reference.md)** - What each status means
- **[Admin Stage Simple](./guides/application/admin-stage-simple.md)** - Admin stage status in kid form
- **[Lifecycle Possibilities](./guides/application/lifecycle-possibilities.md)** - All status combinations (contract, invoices, result)
- **[Logging Scenarios](./guides/application/logging-scenarios.md)** - UI button to event type mapping
- **[Logging Guide](./guides/application/logging-guide.md)** - Full scenarios, DB storage, kid-level explanation

### 🛠️ Admin

Admin portal and activity timeline:

- **[Activity Timeline](./guides/admin/activity-timeline.md)** - Application log creation, remark at top-level, event labels/icons
- **[CTOS financial summary display](./guides/admin/ctos-financial-summary-display.md)** - CTOS-first cells and fallback formulas in application review

### 🏗️ Architecture

Understanding the codebase and infrastructure:

- **[Project Structure](./architecture/project-structure.md)** - Monorepo organization
- **[AWS Infrastructure](./architecture/aws-infrastructure.md)** - Cloud architecture

### 🚀 Deployment (For Developers & DevOps)

Production deployment and operations:

- **[Deployment Guide](./deployment/deployment-guide.md)** - ⭐ Push to deploy (Developer-focused)
- **[GitHub Actions Setup](./deployment/github-actions-setup.md)** - CI/CD configuration (DevOps)
- **[AWS Infrastructure](./deployment/manual-aws-console-setup.md)** - AWS setup (DevOps)
- **[Optimization Guide](./deployment/deployment-optimization.md)** - Speed improvements

### 🔗 Integrations

Third-party service integrations:

- **[RegTank KYC Integration](./integrations/regtank-kyc-integration.md)** - KYC/KYB onboarding via RegTank

### 🎨 Design

UI and branding guidelines:

- **[Brand Guidelines](../BRANDING.md)** - Design system and standards

## Getting Help

### For Developers

1. **Start coding:** [Local Development Setup](./guides/local-development-setup.md)
2. **Deploy your code:** [Deployment Guide](./deployment/deployment-guide.md)
3. **Understand the codebase:** [Project Structure](./architecture/project-structure.md)
4. **Database changes:** [Database Workflow](./guides/database-workflow.md)

### For DevOps

1. **AWS setup:** [Manual AWS Console Setup](./deployment/manual-aws-console-setup.md)
2. **CI/CD setup:** [GitHub Actions Setup](./deployment/github-actions-setup.md)
3. **Architecture:** [AWS Infrastructure](./architecture/aws-infrastructure.md)
4. **Optimization:** [Deployment Optimization](./deployment/deployment-optimization.md)

### For Designers

1. **Design system:** [Brand Guidelines](../BRANDING.md)
2. **UI components:** `packages/ui` - shadcn/ui based components

## Documentation Principles

This documentation follows these principles:

1. **Concise** - No redundant information
2. **Practical** - Real examples, not theory
3. **Up-to-date** - Updated with code changes
4. **Accessible** - Easy to find and navigate
5. **Complete** - Covers all aspects

## Contributing to Docs

When adding features:

1. Update relevant guides (don't create new files unnecessarily)
2. Keep examples working and tested
3. Update this index if adding new sections

## Version History

- **v1.0** - Initial documentation consolidation
- Platform rebranded from Shoraka to CashSouk
- Comprehensive AWS deployment setup
- Development workflow established
