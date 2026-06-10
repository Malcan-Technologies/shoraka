#!/usr/bin/env bash
# Waits for an ECS service's PRIMARY deployment rollout to complete.
# Replaces `aws ecs wait services-stable`, whose timing is not configurable
# (no --max-attempts/--delay support) and caps out at 10 minutes.
# Usage: ecs-wait-rollout.sh <cluster> <service> <region> [max_attempts] [delay_seconds]
set -euo pipefail

CLUSTER="$1"
SERVICE="$2"
REGION="$3"
MAX_ATTEMPTS="${4:-80}"
DELAY="${5:-15}"

for ((i = 1; i <= MAX_ATTEMPTS; i++)); do
  STATE="$(aws ecs describe-services \
    --cluster "$CLUSTER" \
    --services "$SERVICE" \
    --region "$REGION" \
    --query 'services[0].deployments[?status==`PRIMARY`] | [0].rolloutState' \
    --output text)"

  case "$STATE" in
    COMPLETED)
      echo "Rollout completed for $SERVICE after ~$(((i - 1) * DELAY))s"
      exit 0
      ;;
    FAILED)
      echo "Rollout FAILED for $SERVICE (deployment circuit breaker or task failures)"
      exit 1
      ;;
    *)
      echo "[$i/$MAX_ATTEMPTS] $SERVICE rollout state: $STATE; retrying in ${DELAY}s"
      sleep "$DELAY"
      ;;
  esac
done

echo "Timed out waiting for $SERVICE rollout after $((MAX_ATTEMPTS * DELAY))s"
exit 1
