"use client";

import * as React from "react";
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export function ProfileCard({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function ProfileEditToggle({
  canEdit,
  isEditing,
  onEdit,
  onCancel,
}: {
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  if (!canEdit) return null;
  if (isEditing) {
    return (
      <Button variant="outline" size="sm" onClick={onCancel} className="gap-2 rounded-xl">
        <XMarkIcon className="h-4 w-4" />
        Cancel
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onEdit} className="gap-2 rounded-xl">
      <PencilIcon className="h-4 w-4" />
      Edit
    </Button>
  );
}

export function displayProfileValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}
