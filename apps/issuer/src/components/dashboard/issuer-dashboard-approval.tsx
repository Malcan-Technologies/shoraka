"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ClockIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

const READY_ITEMS = [
  {
    title: "An unpaid invoice",
    body: "Issued, not yet due, to a paymaster with a solid payment record.",
  },
  {
    title: "Latest financial statements",
    body: "Two most recent financial years, audited if available.",
  },
  {
    title: "Bank statements",
    body: "Last six months for your main operating account.",
  },
  {
    title: "Signatory ready",
    body: "Facility agreements are signed digitally by an authorised director.",
  },
];

const REVIEW_STEPS = ["Documents received", "SSM verified", "Credit assessment", "Final approval"] as const;

function ReviewStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "current" | "upcoming";
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-2.5 border-t-2 pt-2.5",
        state === "done" && "border-status-success-text",
        state === "current" && "border-status-submitted-text",
        state === "upcoming" && "border-border"
      )}
    >
      {state === "done" ? (
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-status-success-text" aria-hidden />
      ) : state === "current" ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-submitted-text">
          <span className="h-1.5 w-1.5 rounded-full bg-card" />
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
      )}
      <span
        className={cn(
          "text-ui",
          state === "current" && "font-medium text-status-submitted-text",
          state === "upcoming" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function IssuerDashboardApproval({
  submittedLabel,
  reviewIndex,
}: {
  submittedLabel: string | null;
  reviewIndex: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden rounded-2xl border-status-submitted-text/30 bg-gradient-to-br from-status-submitted-bg to-card shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-status-submitted-bg text-status-submitted-text">
              <ClockIcon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <StatusBadge label="Under review" status="submitted" size="sm" />
              <h2 className="mt-2.5 text-section-title text-primary">We are verifying your business</h2>
              <p className="mt-2 max-w-[62ch] text-pretty text-ui leading-6 text-muted-foreground">
                SSM records, directors and shareholders, and your bank details are being checked. Nothing
                more is needed from you unless we ask.
              </p>
              {submittedLabel ? (
                <div className="mt-5">
                  <p className="text-meta text-muted-foreground">Submitted</p>
                  <p className="mt-0.5 text-ui font-medium">{submittedLabel}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-status-submitted-text/20 pt-6">
            {REVIEW_STEPS.map((label, index) => {
              const state =
                index < reviewIndex ? "done" : index === reviewIndex ? "current" : "upcoming";
              return <ReviewStep key={label} label={label} state={state} />;
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-7">
          <h3 className="text-card-title">Get ready to apply</h3>
          <p className="mt-1 text-ui text-muted-foreground">
            Have these to hand and your first application takes minutes.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {READY_ITEMS.map((item) => (
              <div key={item.title} className="rounded-xl border border-border p-4">
                <p className="text-ui font-medium">{item.title}</p>
                <p className="mt-1.5 text-ui leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
