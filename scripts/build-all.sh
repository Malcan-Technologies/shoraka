#!/bin/bash
# Build all Docker images locally for testing

set -e

echo "================================================"
echo "Building all CashSouk Docker images"
echo "================================================"

# Parse arguments
BUILD_ARG=""
if [ "$1" = "--no-cache" ]; then
  BUILD_ARG="--no-cache"
  echo "Building with --no-cache flag"
fi

echo ""

# Build landing
echo "1/5 Building landing image..."
docker build $BUILD_ARG -f docker/landing.Dockerfile -t cashsouk-landing:local .
echo "✓ Landing image built"
echo ""

# Build investor
echo "2/5 Building investor image..."
docker build $BUILD_ARG -f docker/portal-investor.Dockerfile -t cashsouk-investor:local .
echo "✓ Investor image built"
echo ""

# Build issuer
echo "3/5 Building issuer image..."
docker build $BUILD_ARG -f docker/portal-issuer.Dockerfile -t cashsouk-issuer:local .
echo "✓ Issuer image built"
echo ""

# Build admin
echo "4/5 Building admin image..."
docker build $BUILD_ARG -f docker/portal-admin.Dockerfile -t cashsouk-admin:local .
echo "✓ Admin image built"
echo ""

# Build API
echo "5/5 Building API image..."
docker build $BUILD_ARG -f docker/api.Dockerfile -t cashsouk-api:local .
echo "✓ API image built"
echo ""

echo "================================================"
echo "All images built successfully!"
echo "================================================"
echo ""
echo "Available images:"
docker images | grep cashsouk | grep local
echo ""
echo "To test production build locally:"
echo "  docker-compose -f docker-compose.prod.yml up"
echo ""
echo "To push to ECR (requires AWS credentials):"
echo "  ./scripts/push-to-ecr.sh"

