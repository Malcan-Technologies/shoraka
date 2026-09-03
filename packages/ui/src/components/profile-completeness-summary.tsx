"use client";

import { StatusBadge } from "./status-badge";
import { cn } from "../lib/utils";

export type ProfileCompletenessSectionRow = {
  id: string;
  label: string;
  href?: string;
  missingCount: number;
  complete: boolean;
};

export function ProfileCompletenessSummary({
  percent,
  remaining,
  sections,
  onSectionClick,
  showCompleteSections = false,
  className,
}: {
  percent: number;
  remaining: number;
  sections: ProfileCompletenessSectionRow[];
  onSectionClick?: (section: ProfileCompletenessSectionRow) => void;
  showCompleteSections?: boolean;
  className?: string;
}) {
  const rows = showCompleteSections || remaining === 0
    ? sections
    : sections.filter((section) => section.missingCount > 0);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-body font-semibold">{percent}% complete</p>
        {remaining === 0 ? (
          <StatusBadge status="success" label="Complete" />
        ) : (
          <StatusBadge
            status="action"
            label={`${remaining} required ${remaining === 1 ? "item" : "items"} remaining`}
          />
        )}
      </div>
      {rows.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border bg-card">
          {rows.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                onClick={() => onSectionClick?.(section)}
              >
                <span className="text-ui font-medium">{section.label}</span>
                <span
                  className={cn(
                    "text-ui",
                    section.complete ? "text-muted-foreground" : "text-status-action-text"
                  )}
                >
                  {section.complete
                    ? "Complete"
                    : `${section.missingCount} missing`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
