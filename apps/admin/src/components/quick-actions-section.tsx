"use client";

import * as React from "react";
import { QuickActionCard } from "./quick-action-card";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";

interface QuickActionsSectionProps {
  loading?: boolean;
}

export function QuickActionsSection({ loading = false }: QuickActionsSectionProps) {
  // Placeholder data for pending onboarding approvals
  const pendingOnboardingCount = 5;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
        <p className="text-sm text-muted-foreground">Tasks that need your attention</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          title="Onboarding Approval"
          description="Review pending KYC/KYB applications"
          count={pendingOnboardingCount}
          countLabel="pending"
          href="/onboarding-approval"
          icon={ClipboardDocumentCheckIcon}
          variant={
            pendingOnboardingCount > 3
              ? "urgent"
              : pendingOnboardingCount > 0
                ? "warning"
                : "default"
          }
          loading={loading}
        />
        {/* Additional quick actions can be added here in the future */}
      </div>
    </section>
  );
}
