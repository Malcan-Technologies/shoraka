"use client";

import type { RecipientSigningDocument } from "@cashsouk/types";
import { StatusBadge, type StatusToken } from "@cashsouk/ui";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

type SigningDocumentMenuProps = {
  items: RecipientSigningDocument[];
  onSelect: (documentId: string) => void;
};

function assignmentBadge(status: string): { status: StatusToken; label: string } {
  if (status === "SIGNED") return { status: "success", label: "Signed" };
  if (status === "DECLINED") return { status: "rejected", label: "Declined" };
  return { status: "action", label: "To sign" };
}

function canStartSigning(status: string): boolean {
  return status !== "SIGNED" && status !== "DECLINED";
}

export function SigningDocumentMenu({ items, onSelect }: SigningDocumentMenuProps) {
  return (
    <ul className="space-y-2">
      {items.map(({ document, assignment }) => {
        const badge = assignmentBadge(assignment.status);
        const selectable = canStartSigning(assignment.status);
        const rowClassName = cn(
          "flex w-full items-center gap-3 rounded-xl border border-border bg-muted/20 p-4 text-left text-ui",
          selectable && "hover:bg-muted/40"
        );
        const content = (
          <>
            <span className="min-w-0 flex-1 font-medium text-foreground">{document.name}</span>
            <StatusBadge status={badge.status} label={badge.label} />
            {selectable ? (
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <span className="inline-block h-5 w-5 shrink-0" aria-hidden="true" />
            )}
          </>
        );

        return (
          <li key={assignment.id}>
            {selectable ? (
              <button type="button" className={rowClassName} onClick={() => onSelect(document.id)}>
                {content}
              </button>
            ) : (
              <div className={rowClassName}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
