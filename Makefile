.PHONY: help dev build test lint typecheck e2e clean migrate deploy-local setup-env build-images push-ecr aws-setup

# Default target
help:
	@echo "CashSouk P2P Platform - Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              Start development environment (docker-compose)"
	@echo "  make setup-env        Copy environment templates to apps"
	@echo "  make migrate          Run database migrations locally"
	@echo ""
	@echo "Testing:"
	@echo "  make test             Run unit tests"
	@echo "  make e2e              Run E2E tests with Playwright"
	@echo "  make lint             Run ESLint"
	@echo "  make typecheck        Run TypeScript type checking"
	@echo ""
	@echo "Building:"
	@echo "  make build            Build all apps"
	@echo "  make build-images     Build all Docker images locally"
	@echo "  make deploy-local     Test production build locally"
	@echo ""
	@echo "AWS Deployment:"
	@echo "  make aws-setup        Set up AWS infrastructure (ECR, logs)"
	@echo "  make push-ecr         Push images to AWS ECR"
	@echo "  make migrate-prod     Run migrations in production"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            Stop containers and clean up"
	@echo "  make clean-all        Full cleanup (including volumes)"

# Development
dev:
	@echo "⚠️  Note: For local development, use pnpm (not Docker) for better performance."
	@echo ""
	@echo "Start PostgreSQL:"
	@echo "  docker run -d --name cashsouk-postgres \\"
	@echo "    -e POSTGRES_PASSWORD=password \\"
	@echo "    -e POSTGRES_DB=cashsouk_dev \\"
	@echo "    -p 5432:5432 postgres:15-alpine"
	@echo ""
	@echo "Then run apps in separate terminals:"
	@echo "  pnpm --filter @cashsouk/api dev"
	@echo "  pnpm --filter @cashsouk/landing dev"
	@echo "  pnpm --filter @cashsouk/investor dev"
	@echo "  pnpm --filter @cashsouk/issuer dev"
	@echo "  pnpm --filter @cashsouk/admin dev"
	@echo ""
	@echo "For production testing with Docker, use: make deploy-local"

setup-env:
	@echo "Setting up environment files..."
	@for app in landing investor issuer admin api; do \
		if [ ! -f apps/$$app/.env.local ]; then \
			echo "Copying .env.local for $$app..."; \
			cp env-templates/$$app.env.local apps/$$app/.env.local; \
		else \
			echo "✓ .env.local already exists for $$app"; \
		fi; \
	done
	@echo ""
	@echo "✓ Environment files ready"
	@echo "Edit apps/*/.env.local to add your configuration"

migrate:
	@echo "Running database migrations..."
	./scripts/migrate.sh local

# Testing
test:
	@echo "Running unit tests..."
	pnpm -w test

e2e:
	@echo "Running E2E tests..."
	pnpm -w e2e

lint:
	@echo "Running linter..."
	pnpm -w lint

typecheck:
	@echo "Running type checker..."
	pnpm -w typecheck

# Building
build:
	@echo "Building all apps..."
	pnpm -w build

build-images:
	@echo "Building Docker images..."
	./scripts/build-all.sh

build-images-no-cache:
	@echo "Building Docker images (no cache)..."
	./scripts/build-all.sh --no-cache

deploy-local:
	@echo "Starting production build locally..."
	@if [ ! -f apps/api/.env.prod ]; then \
		echo "Error: Production environment files not found"; \
		echo "Run 'make setup-env-prod' first"; \
		exit 1; \
	fi
	docker-compose -f docker-compose.prod.yml up -d
	@echo "✓ Production services started locally"
	@echo ""
	@echo "Access points:"
	@echo "  Landing:  http://localhost:3000"
	@echo "  Issuer:   http://localhost:3001"
	@echo "  Investor: http://localhost:3002"
	@echo "  Admin:    http://localhost:3003"
	@echo "  API:      http://localhost:4000"

setup-env-prod:
	@echo "Setting up production environment files..."
	@for app in landing investor issuer admin api; do \
		if [ ! -f apps/$$app/.env.prod ]; then \
			echo "Copying .env.prod for $$app..."; \
			cp env-templates/$$app.env.prod apps/$$app/.env.prod; \
		else \
			echo "✓ .env.prod already exists for $$app"; \
		fi; \
	done
	@echo ""
	@echo "✓ Production environment files ready"
	@echo "Edit apps/*/.env.prod to add your configuration"

# AWS
aws-setup:
	@echo "Setting up AWS infrastructure..."
	./scripts/setup-aws.sh

push-ecr:
	@echo "Pushing images to AWS ECR..."
	./scripts/push-to-ecr.sh

migrate-prod:
	@echo "Running migrations in production..."
	@if [ -z "$$PRIVATE_SUBNET_IDS" ] || [ -z "$$ECS_SECURITY_GROUP" ]; then \
		echo "Error: Required environment variables not set"; \
		echo "Set PRIVATE_SUBNET_IDS and ECS_SECURITY_GROUP first"; \
		exit 1; \
	fi
	./scripts/migrate.sh production

# Cleanup
clean:
	@echo "Stopping services and cleaning up..."
	docker-compose down
	docker-compose -f docker-compose.prod.yml down
	@echo "✓ Services stopped"

clean-all:
	@echo "Full cleanup (including volumes)..."
	docker-compose down -v
	docker-compose -f docker-compose.prod.yml down -v
	@echo "✓ Full cleanup complete"

# Install dependencies
install:
	@echo "Installing dependencies..."
	pnpm install --frozen-lockfile
	@echo "✓ Dependencies installed"

# Format code
format:
	@echo "Formatting code..."
	pnpm -w format

format-check:
	@echo "Checking code formatting..."
	pnpm -w format:check

# Combined checks (useful for pre-commit)
check: lint typecheck test
	@echo "✓ All checks passed"

# Full CI check
ci: install check e2e
	@echo "✓ Full CI check passed"

