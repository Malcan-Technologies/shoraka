"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAuthToken } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function AdminEditFinancialFieldDialog({
  open,
  onOpenChange,
  applicationId,
  calendarYear,
  fieldKey,
  fieldLabel,
  initialValue,
  columnKind,
  disabled,
  readOnly = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null | undefined;
  calendarYear: number | null;
  fieldKey: string | null;
  columnKind?: "ctos" | "unaudited" | "admin_input" | "admin_fallback_placeholder";
  fieldLabel: string;
  initialValue: number | null;
  disabled: boolean;
  readOnly?: boolean;
  onSaved: () => void;
}) {
  const { getAccessToken } = useAuthToken();
  const [saving, setSaving] = React.useState(false);
  const [raw, setRaw] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setSaving(false);
    setRaw(initialValue == null ? "" : String(initialValue));
  }, [open, initialValue, fieldKey, calendarYear]);

  const onSave = async () => {
    if (!applicationId || calendarYear == null || !fieldKey) return;
    if (disabled || readOnly) return;
    const value = Number(raw.trim().replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      toast.error("Enter a numeric value");
      return;
    }
    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      const res = await fetch(
        `${API_URL}/v1/applications/${encodeURIComponent(applicationId)}/admin-financial-statements/field`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ financialYear: calendarYear, fieldKey, columnKind, value }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? json?.message ?? `Request failed (${res.status})`);
      }
      toast.success(`Saved ${fieldLabel}`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialValue == null ? "+ Add" : "Edit"} {fieldLabel}</DialogTitle>
          <DialogDescription>
            {calendarYear != null ? `FY${calendarYear}. ` : ""}
            Calculated metrics stay read-only and update from this raw value.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="admin-financial-field-value">{fieldLabel}</Label>
          <Input
            id="admin-financial-field-value"
            inputMode="decimal"
            type="number"
            step="any"
            value={raw}
            disabled={disabled || readOnly || saving}
            onChange={(event) => setRaw(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {readOnly ? null : (
            <Button type="button" onClick={onSave} disabled={disabled || saving}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
