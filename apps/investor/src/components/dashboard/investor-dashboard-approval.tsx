"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ClockIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { HELP_CENTER_URL } from "@cashsouk/config";
import { formatMytDateTime } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import {
  approvalPipelineStages,
  type ApprovalPipelineStageStatus,
} from "@/investments/dashboard-state";

function stageTone(status: ApprovalPipelineStageStatus) {
  if (status === "done") return "border-status-success-text text-foreground";
  if (status === "current") return "border-status-submitted-text text-status-submitted-text";
  return "border-border text-muted-foreground";
}

export function InvestorDashboardApproval({
  onboardingStatus,
  amlApproved,
  submittedAt,
}: {
  onboardingStatus: string;
  amlApproved?: boolean | null;
  submittedAt?: string | null;
}) {
  const stages = approvalPipelineStages({ onboardingStatus, amlApproved });
  const submittedLabel = formatMytDateTime(submittedAt);

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden rounded-2xl border-status-submitted-text/30 bg-gradient-to-br from-status-submitted-bg via-card to-card shadow-sm">
        <CardContent className="p-8">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-status-submitted-bg text-status-submitted-text">
              <ClockIcon className="h-6 w-6" />
            </span>
            <div className="min-w-[15rem] flex-1">
              <StatusBadge label="Under review" status="submitted" size="sm" showDot />
              <h2 className="mt-2.5 text-section-title text-primary">
                Your account is with our compliance team
              </h2>
              <p className="mt-2 max-w-[62ch] text-body leading-7 text-muted-foreground">
                Everything you needed to submit is in. We run AML screening and a final review
                before your wallet is enabled.
              </p>
              {submittedLabel ? (
                <div className="mt-5">
                  <p className="text-meta text-muted-foreground">Submitted</p>
                  <p className="mt-0.5 text-ui font-medium">{submittedLabel}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-4 gap-y-3 border-t border-status-submitted-text/20 pt-6">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className={cn(
                  "flex min-w-[9rem] flex-1 items-center gap-2.5 border-t-2 pt-2.5",
                  stageTone(stage.status)
                )}
              >
                {stage.status === "done" ? (
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-status-success-text" />
                ) : stage.status === "current" ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-submitted-text">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  </span>
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
                )}
                <span
                  className={cn(
                    "text-ui",
                    stage.status === "current" && "font-medium text-status-submitted-text"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-7">
          <h3 className="text-card-title text-primary">While you wait</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <WaitCard
              title="Read how notes work"
              body="Tenor, expected return, and what happens if an issuer pays late."
              href={HELP_CENTER_URL}
              label="Open help centre"
              external
            />
            <WaitCard
              title="Add your bank account"
              body="Withdrawals go only to a verified account in your name."
              href="/profile"
              label="Go to organisation"
            />
            <WaitCard
              title="Invite a colleague"
              body="Give another person on your team access to this account."
              href="/profile"
              label="Manage people"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WaitCard({
  title,
  body,
  href,
  label,
  external,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
  external?: boolean;
}) {
  const linkClass = "mt-3 inline-block text-ui font-medium text-primary";
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-ui font-medium text-foreground">{title}</p>
      <p className="mt-1.5 text-ui leading-6 text-muted-foreground">{body}</p>
      {external ? (
        <a href={href} target="_blank" rel="noreferrer noopener" className={linkClass}>
          {label} →
        </a>
      ) : (
        <Link href={href} className={linkClass}>
          {label} →
        </Link>
      )}
    </div>
  );
}
