"use client";

import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

export function OrganizationCardEditActions({
  canEdit,
  isEditing,
  canSave,
  isSaving,
  onEdit,
  onCancel,
  onSave,
}: {
  canEdit: boolean;
  isEditing: boolean;
  canSave: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!canEdit) return null;
  if (isEditing) {
    return (
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isSaving || !canSave}>
          Save
        </Button>
      </div>
    );
  }
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
      <PencilSquareIcon className="h-4 w-4" />
      Edit
    </Button>
  );
}
