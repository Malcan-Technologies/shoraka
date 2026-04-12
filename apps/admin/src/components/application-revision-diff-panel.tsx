"use client";

/**
 * Renders APPLICATION_RESUBMITTED metadata.resubmit_changes (field diff UI only).
 * Keeps comparison copy out of admin-activity-timeline.tsx.
 */

import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export type ResubmitFieldChangeItem = {
  path: string;
  section_key: string;
  section_label: string;
  field_label?: string;
  previous_value?: string;
  next_value?: string;
};

export type ResubmitChangesMetadata = {
  section_keys?: string[];
  section_labels?: string[];
  contract_updated?: boolean;
  invoices_updated?: boolean;
  activity_summary?: string;
  field_changes?: ResubmitFieldChangeItem[];
};

function isCompactResubmitScalarDisplay(a: string, b: string): boolean {
  const maxLen = 52;
  if (a.length > maxLen || b.length > maxLen) return false;
  if (a.includes("\n") || b.includes("\n")) return false;
  if (a.startsWith("{") || b.startsWith("{")) return false;
  if (a.startsWith("[") || b.startsWith("[")) return false;
  return true;
}

function resubmitChangeFieldTitle(fc: ResubmitFieldChangeItem): string {
  if (fc.field_label && fc.field_label.trim().length > 0) {
    return fc.field_label.trim();
  }
  const segments = fc.path.split(/[.[\]]/).filter((s) => s.length > 0);
  const nonNumeric = segments.filter((s) => !/^\d+$/.test(s));
  const leaf = nonNumeric.length > 0 ? nonNumeric[nonNumeric.length - 1]! : "Field";
  return leaf
    .split("_")
    .map((w) =>
      w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

function groupFieldChanges(
  fieldChanges: ResubmitFieldChangeItem[]
): [string, ResubmitFieldChangeItem[]][] {
  const acc: Record<string, ResubmitFieldChangeItem[]> = {};
  for (const fc of fieldChanges) {
    const k = fc.section_label || fc.section_key;
    if (!acc[k]) acc[k] = [];
    acc[k].push(fc);
  }
  return Object.entries(acc);
}

export function ApplicationRevisionResubmitPanel({
  resubmitChanges,
}: {
  resubmitChanges: ResubmitChangesMetadata;
}) {
  const fieldCount = Array.isArray(resubmitChanges.field_changes)
    ? resubmitChanges.field_changes.length
    : 0;
  const showSectionListOnly =
    Array.isArray(resubmitChanges.section_labels) &&
    resubmitChanges.section_labels.length > 0 &&
    fieldCount === 0;

  return (
    <div className="mt-3 rounded-xl border bg-muted/20 p-4 text-[11px] space-y-2">
      <p className="text-[11px] font-semibold text-foreground">
        Compared to last submission
      </p>

      {showSectionListOnly && Array.isArray(resubmitChanges.section_labels) && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Pages / sections touched</p>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-foreground/90">
            {resubmitChanges.section_labels.map((label, i) => (
              <li key={`${label}-sum-${i}`}>{label}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(resubmitChanges.field_changes) && resubmitChanges.field_changes.length > 0 ? (
        <div>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {groupFieldChanges(resubmitChanges.field_changes).map(([sectionLabel, items]) => (
              <div
                key={sectionLabel}
                className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 space-y-2"
              >
                <div className="border-b border-border pb-1.5 mb-0.5">
                  <p className="text-[11px] font-semibold text-foreground">{sectionLabel}</p>
                </div>
                <div className="space-y-2">
                  {items.map((fc, idx) => {
                    const prev =
                      fc.previous_value != null ? String(fc.previous_value) : null;
                    const next = fc.next_value != null ? String(fc.next_value) : null;
                    const hasPair = prev != null && next != null;
                    const title = resubmitChangeFieldTitle(fc);
                    const compact =
                      hasPair && isCompactResubmitScalarDisplay(prev, next);

                    return (
                      <div
                        key={`${fc.path}-${idx}`}
                        className="border-b border-border/40 pb-2 last:border-0 last:pb-0"
                      >
                        <p className="text-[11px] font-semibold text-foreground mb-1">{title}</p>
                        {!hasPair ? (
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Values are not available for this older log entry.
                          </p>
                        ) : compact ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="text-[11px] font-normal font-sans line-through opacity-90 max-w-full sm:max-w-[min(100%,18rem)] whitespace-normal break-words text-left h-auto py-1 px-2"
                            >
                              {prev}
                            </Badge>
                            <ArrowRightIcon
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <Badge
                              variant="default"
                              className="text-[11px] font-normal font-sans max-w-full sm:max-w-[min(100%,18rem)] whitespace-normal break-words text-left h-auto py-1 px-2"
                            >
                              {next}
                            </Badge>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                Before
                              </p>
                              <p className="text-[11px] leading-relaxed text-foreground/85 whitespace-pre-wrap break-words line-through decoration-foreground/45">
                                {prev}
                              </p>
                            </div>
                            <div className="flex justify-center">
                              <ArrowRightIcon
                                className="h-3.5 w-3.5 text-muted-foreground"
                                aria-hidden
                              />
                            </div>
                            <div className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                After
                              </p>
                              <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                {next}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        !(
          Array.isArray(resubmitChanges.section_labels) && resubmitChanges.section_labels.length > 0
        ) && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            No differences were detected when comparing to the previous revision snapshot.
          </p>
        )
      )}
    </div>
  );
}
