"use client";

import * as React from "react";
import { toast } from "sonner";
import { useAuthToken } from "@cashsouk/config";
import {
  APPLICATION_COMREP_DETAIL_KEYS,
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
  FINANCIAL_FIELD_LABELS,
} from "@cashsouk/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type AdminFinancialStatementStatementType = "AUDITED" | "NOT_AUDITED" | "MANAGEMENT_ACCOUNTS";

function parseNumberInput(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function AdminAddFinancialStatementDialog({
  open,
  onOpenChange,
  applicationId,
  calendarYear,
  disabled,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null | undefined;
  calendarYear: number | null;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { getAccessToken } = useAuthToken();
  const [saving, setSaving] = React.useState(false);
  const [statementType, setStatementType] =
    React.useState<AdminFinancialStatementStatementType>("AUDITED");
  const [values, setValues] = React.useState<Record<string, string>>({});

  const FORM_KEYS = React.useMemo(() => {
    const keys = [
      ...APPLICATION_CORE_MONEY_KEYS,
      ...APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
      ...APPLICATION_COMREP_DETAIL_KEYS,
    ];
    return [...new Set(keys)];
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setSaving(false);
    setStatementType("AUDITED");
    setValues({});
  }, [open, calendarYear]);

  const yearLabel = calendarYear != null ? `FY${calendarYear}` : "FY";

  const onSave = async () => {
    if (!applicationId || calendarYear == null) return;
    if (disabled) return;
    setSaving(true);
    try {
      const rawFinancialInputs: Record<string, unknown> = {};
      for (const key of FORM_KEYS) {
        const s = values[key] ?? "";
        const n = parseNumberInput(s);
        if (n == null) continue;
        rawFinancialInputs[key] = n;
      }

      const accessToken = await getAccessToken();
      const res = await fetch(
        `${API_URL}/v1/applications/${encodeURIComponent(
          applicationId
        )}/admin-financial-statements/fallback`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            financialYear: calendarYear,
            statementType,
            rawFinancialInputs,
          }),
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          json?.error?.message ?? json?.message ?? `Request failed (${res.status})`;
        throw new Error(message);
      }
      if (!json?.success) {
        throw new Error(json?.error?.message ?? "Save failed");
      }
      toast.success(`Saved ${yearLabel} as Admin Input`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>+ Add Financial Statement</DialogTitle>
          <DialogDescription>
            Add a missing historical year ({yearLabel}) using Admin fallback. CTOS / issuer data will remain authoritative.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Statement type</Label>
            <Select value={statementType} onValueChange={(v) => setStatementType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUDITED">Audited</SelectItem>
                <SelectItem value="NOT_AUDITED">Not audited</SelectItem>
                <SelectItem value="MANAGEMENT_ACCOUNTS">Management accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-xl border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {FORM_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`admin-fs-${key}`} className="text-meta">
                    {FINANCIAL_FIELD_LABELS[key] ?? key}
                  </Label>
                  <Input
                    id={`admin-fs-${key}`}
                    inputMode="decimal"
                    type="number"
                    step="any"
                    placeholder="—"
                    value={values[key] ?? ""}
                    disabled={disabled || saving}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={disabled || saving || applicationId == null || calendarYear == null}>
            {saving ? "Saving..." : "Save financial statement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

