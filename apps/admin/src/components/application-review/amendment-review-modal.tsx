"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@heroicons/react/24/outline";
import { getReviewTabLabel } from "./review-registry";
import {
  getSectionForScopeKey,
  getSectionSortIndex,
  getItemDisplayNameFromScopeKey,
} from "@cashsouk/types";

export interface PendingAmendmentItem {
  id: string;
  scope: string;
  scope_key: string;
  remark: string;
  item_type: string | null;
  item_id: string | null;
  author?: { first_name: string; last_name: string };
}

export interface AmendmentReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PendingAmendmentItem[];
  onRemove: (scope: string, scopeKey: string) => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  isRemovePending?: boolean;
  isSubmitPending?: boolean;
}

export function AmendmentReviewModal({
  open,
  onOpenChange,
  items,
  onRemove,
  onSubmit,
  isRemovePending,
  isSubmitPending,
}: AmendmentReviewModalProps) {
  const pending = isRemovePending || isSubmitPending;

  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      { sectionRemark: PendingAmendmentItem | null; items: PendingAmendmentItem[] }
    >();
    for (const item of items) {
      const sectionKey =
        item.scope === "section" ? item.scope_key : getSectionForScopeKey(item.scope_key);
      if (!map.has(sectionKey)) {
        map.set(sectionKey, { sectionRemark: null, items: [] });
      }
      const entry = map.get(sectionKey)!;
      if (item.scope === "section") {
        entry.sectionRemark = item;
      } else {
        entry.items.push(item);
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => getSectionSortIndex(a) - getSectionSortIndex(b))
      .map(([sectionKey, data]) => ({
        sectionKey,
        sectionLabel: getReviewTabLabel(sectionKey),
        ...data,
      }));
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pending Amendments</DialogTitle>
          <DialogDescription>
            Amendments are grouped by section. Review or remove below. Click Proceed to send all
            amendments to the issuer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending amendments.</p>
          ) : (
            <div className="space-y-4 max-h-[32rem] overflow-y-auto">
              {grouped.map(({ sectionKey, sectionLabel, sectionRemark, items: sectionItems }) => (
                <div
                  key={sectionKey}
                  className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                >
                  <div className="text-base font-semibold">{sectionLabel}</div>

                  {sectionRemark && (
                    <div className="pl-4 space-y-2 border-l-2 border-border">
                      <AmendmentRow
                        item={sectionRemark}
                        getLabel={() => ""}
                        pending={!!pending}
                        onRemove={onRemove}
                      />
                    </div>
                  )}

                  {sectionItems.length > 0 && (
                    <div className="pl-4 space-y-3 border-l-2 border-border">
                      {sectionItems.map((item) => (
                        <AmendmentRow
                          key={item.id}
                          item={item}
                          getLabel={() => getItemDisplayNameFromScopeKey(item.scope_key)}
                          pending={!!pending}
                          onRemove={onRemove}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={items.length === 0 || isSubmitPending}
          >
            {isSubmitPending ? "Submitting..." : "Proceed & Send Amendments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmendmentRow({
  item,
  getLabel,
  pending,
  onRemove,
}: {
  item: PendingAmendmentItem;
  getLabel: () => string;
  pending: boolean;
  onRemove: (scope: string, scopeKey: string) => void | Promise<void>;
}) {
  const label = getLabel();

  return (
    <div className="rounded-lg bg-background/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {label && (
            <div className="text-sm font-semibold text-foreground">{label}</div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.remark}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
          onClick={() => onRemove(item.scope, item.scope_key)}
          disabled={pending}
          aria-label="Remove amendment"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
