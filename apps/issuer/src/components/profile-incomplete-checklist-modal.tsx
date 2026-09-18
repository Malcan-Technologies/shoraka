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
import type { IssuerProfileIncompleteChecklistModel } from "@/lib/profile-incomplete-checklist";
import { buildIssuerProfileSectionLink } from "@/lib/profile-incomplete-checklist";

export function ProfileIncompleteChecklistModal({
  open,
  onOpenChange,
  model,
  onProfileSectionClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: IssuerProfileIncompleteChecklistModel | null;
  onProfileSectionClick?: (href: string) => void;
}) {
  const sections = model?.sections ?? [];
  const firstLink = sections.length > 0 ? buildIssuerProfileSectionLink({ id: sections[0].id, href: sections[0].href }) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete your profile before submitting</DialogTitle>
          <DialogDescription>
            Your profile is missing required information. Review the items below and jump directly to the relevant profile sections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profile items are missing.</p>
          ) : (
            sections.map((section) => (
              <div key={section.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-ui font-medium">{section.label}</p>
                    <p className="text-sm text-muted-foreground">{section.missingCount} missing item{section.missingCount === 1 ? "" : "s"}</p>
                  </div>
                  <a
                    className="text-sm font-medium text-primary hover:underline"
                    href={buildIssuerProfileSectionLink({ id: section.id, href: section.href })}
                    onClick={(e) => {
                      e.preventDefault();
                      const href = buildIssuerProfileSectionLink({ id: section.id, href: section.href });
                      onOpenChange(false);
                      onProfileSectionClick?.(href);
                    }}
                  >
                    Go to section
                  </a>
                </div>

                <ul className="mt-3 space-y-1 text-sm">
                  {section.items.map((item, idx) => (
                    <li key={`${item.label}-${idx}`} className="text-muted-foreground">
                      {item.personName ? <span className="text-foreground">{item.personName}: </span> : null}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {firstLink ? (
            <a
              className="w-full"
              href={firstLink}
              onClick={(e) => {
                e.preventDefault();
                onOpenChange(false);
                onProfileSectionClick?.(firstLink);
              }}
            >
              <Button className="w-full" type="button">
                Go to profile
              </Button>
            </a>
          ) : null}
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

