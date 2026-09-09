import type { ComponentType } from "react";
import type { AdminPermission } from "@cashsouk/types";

export type QueueUrgency = "default" | "warning" | "urgent";

export type QuickActionQueue = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  count: number;
  countLabel: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  variant: QueueUrgency;
  isLoading: boolean;
};

const VARIANT_RANK: Record<QueueUrgency, number> = {
  urgent: 0,
  warning: 1,
  default: 2,
};

export function canSeeDefaultEligibleQueue(can: (permission: AdminPermission) => boolean) {
  return can("notes.view") && can("notes.default.manage");
}

export function urgencyVariant(count: number, urgentAt: number, warnAt: number): QueueUrgency {
  if (count > urgentAt) return "urgent";
  if (count > warnAt) return "warning";
  return "default";
}

export function sortQueuesByPriority(queues: QuickActionQueue[]): QuickActionQueue[] {
  return [...queues].sort((a, b) => {
    const rank = VARIANT_RANK[a.variant] - VARIANT_RANK[b.variant];
    if (rank !== 0) return rank;
    return (b.count ?? 0) - (a.count ?? 0);
  });
}

export function queuesNeedingAttention(queues: QuickActionQueue[]): QuickActionQueue[] {
  return sortQueuesByPriority(
    queues.filter((queue) => !queue.isLoading && queue.count > 0)
  );
}

export function formatQueueCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function queueProgressPercent(count: number, maxCount: number): number {
  if (maxCount <= 0) return 0;
  return Math.min(100, (count / maxCount) * 100);
}

export function queueCardTone(queue: Pick<QuickActionQueue, "id" | "variant">): "rejected" | "action" {
  if (queue.id === "default-eligible") return "rejected";
  if (queue.variant === "urgent") return "rejected";
  return "action";
}

export function dashboardQueueDescription(input: {
  ready: boolean;
  queueCount: number;
  attentionCount: number;
  totalOpenItems: number;
}): string {
  if (!input.ready) {
    return "Review queues and platform health from your dashboard.";
  }
  if (input.queueCount === 0) {
    return "No queues available for your role.";
  }
  if (input.attentionCount === 0) {
    return "All queues are clear.";
  }
  if (input.attentionCount === 1) {
    return input.totalOpenItems === 1
      ? "1 item needs attention."
      : `${input.totalOpenItems} items need attention.`;
  }
  return `${input.totalOpenItems} items across ${input.attentionCount} queues need attention.`;
}
