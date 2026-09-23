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
import { FINANCIAL_FIELD_LABELS, type AdminFinancialReviewColumn, isAdminEditableRawFinancialKey } from "@cashsouk/types";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RawFieldState = {
  key: string;
  label: string;
  readOnly: boolean;
  initialValue: number | null;
  unavailableReason?: "not_provided_by_ctos" | "not_provided";
  source: "ctos" | "user_input" | "admin_input";
  editedByAdmin: boolean;
};

function formatRawFieldValue(n: number): string {
  // Raw financial fields are stored as numbers; show as integers for consistent UX with the table.
  return String(n);
}

function parseOptionalNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fieldProvenanceLabel(meta: {
  source: "ctos" | "user_input" | "admin_input";
  editedByAdmin: boolean;
}): string {
  if (meta.editedByAdmin && meta.source === "user_input") return "User Input · Edited by Admin";
  if (meta.source === "ctos") return "CTOS";
  if (meta.source === "user_input") return "User Input";
  return "Admin Input";
}

const MODAL_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Assets",
    keys: ["bsfatot", "othass", "bscatot", "bsclbank", "cashAndBank", "tradeReceivables"],
  },
  {
    title: "Liabilities",
    keys: [
      "curlib",
      "bsslltd",
      "bsclstd",
      "curlib_borrowing",
      "curlib_non_borrowing",
      "ncl_loan",
      "ncl_non_loan",
      "tradePayables",
    ],
  },
  {
    title: "Equity",
    keys: [
      "bsqpuc",
      "equity_share_application",
      "equity_share_premium",
      "equity_accumulated_profit",
      "equity_minority",
    ],
  },
  {
    title: "Profit & Loss",
    keys: ["turnover", "plnpbt", "plnpat", "plnetdiv", "pl_minority", "plyear", "netOperatingIncome"],
  },
  {
    title: "Costs",
    keys: ["costOfSales", "operating_cost", "admin_cost", "interest_cost", "other_cost"],
  },
  {
    title: "Cash Flow / Debt",
    keys: ["operatingCashFlow", "freeCashFlow", "annualDebtService"],
  },
];

export function AdminEditFinancialStatementDialog({
  open,
  onOpenChange,
  applicationId,
  calendarYear,
  resolvedColumn,
  disabled,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null | undefined;
  calendarYear: number | null;
  resolvedColumn: AdminFinancialReviewColumn | null;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { getAccessToken } = useAuthToken();
  const [saving, setSaving] = React.useState(false);

  const [fieldState, setFieldState] = React.useState<{
    byKey: Record<string, RawFieldState>;
    inputs: Record<string, string>;
  } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const column = resolvedColumn;
    if (!column || calendarYear == null) {
      setFieldState(null);
      return;
    }

    const byKey: Record<string, RawFieldState> = {};
    const inputs: Record<string, string> = {};

    for (const key of ADMIN_EDITABLE_RAW_FINANCIAL_KEYS) {
      if (!isAdminEditableRawFinancialKey(key)) continue;
      const field = column.fields[key];
      if (!field) continue;
      byKey[key] = {
        key,
        label: FINANCIAL_FIELD_LABELS[key] ?? key,
        readOnly: field.readOnly,
        initialValue: field.value,
        unavailableReason: field.unavailableReason,
        source: field.source,
        editedByAdmin: field.editedByAdmin,
      };
      inputs[key] = field.value == null ? "" : String(field.value);
    }

    setFieldState({ byKey, inputs });
  }, [open, resolvedColumn, calendarYear]);

  const onSave = React.useCallback(async () => {
    if (!applicationId || calendarYear == null || !resolvedColumn || !fieldState) return;
    if (disabled) return;

    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Not signed in");

      // Save sequentially for easier failure handling and predictable audit events.
      for (const key of Object.keys(fieldState.byKey)) {
        const meta = fieldState.byKey[key]!;
        if (meta.readOnly) continue;
        const rawInput = fieldState.inputs[key] ?? "";
        if (!rawInput.trim()) continue; // don't support clearing values in this UX

        const nextValue = parseOptionalNumericInput(rawInput);
        if (nextValue == null) {
          toast.error(`Enter a valid number for ${meta.label}`);
          return;
        }

        if (meta.initialValue === nextValue) continue;

        const res = await fetch(
          `${API_URL}/v1/applications/${encodeURIComponent(applicationId)}/admin-financial-statements/field`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ financialYear: calendarYear, fieldKey: key, value: nextValue }),
          }
        );

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error?.message ?? json?.message ?? `Request failed (${res.status})`);
        }
      }

      toast.success("Saved financial statement");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [applicationId, calendarYear, disabled, fieldState, getAccessToken, onOpenChange, onSaved, resolvedColumn]);

  const modalSourceLabel = (() => {
    if (!resolvedColumn) return "";
    if (resolvedColumn.primarySource === "ctos") return "CTOS";
    if (resolvedColumn.primarySource === "user_input") return "User Input";
    if (resolvedColumn.primarySource === "admin_input") return "Admin Input";
    return "";
  })();

  const yearPrimarySource = resolvedColumn?.primarySource ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{calendarYear != null ? `FY${calendarYear}` : "Financial Statement"}</DialogTitle>
          <DialogDescription>
            {calendarYear != null ? `Source: ${modalSourceLabel}. ` : ""}
            Calculated metrics stay read-only and update automatically from raw fields.
          </DialogDescription>
        </DialogHeader>

        {fieldState ? (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {MODAL_GROUPS.map((g) => {
              const keys = g.keys.filter((k) => fieldState.byKey[k] != null);
              if (keys.length === 0) return null;

              return (
                <div key={g.title} className="space-y-2">
                  <div className="text-meta font-normal text-muted-foreground">{g.title}</div>
                  <div className="grid gap-2">
                    {keys.map((key) => {
                      const meta = fieldState.byKey[key]!;
                      const showExceptionBadge =
                        meta.editedByAdmin || (yearPrimarySource != null && meta.source !== yearPrimarySource);

                      const helperText =
                        meta.unavailableReason === "not_provided_by_ctos"
                          ? "Not provided by CTOS"
                          : undefined;

                      const inputDisabled = disabled || meta.readOnly || saving;
                      return (
                        <div key={key} className="flex items-start justify-between gap-3">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <Label className="text-ui font-normal leading-snug">{meta.label}</Label>
                              {showExceptionBadge ? (
                                <span className="text-[11px] font-normal text-muted-foreground whitespace-nowrap">
                                  {fieldProvenanceLabel({ source: meta.source, editedByAdmin: meta.editedByAdmin })}
                                </span>
                              ) : null}
                            </div>

                            {helperText ? <div className="text-[11px] text-muted-foreground">{helperText}</div> : null}

                            {meta.readOnly ? (
                              <div className="pt-1 text-right font-medium tabular-nums">
                                {meta.initialValue == null ? "—" : formatRawFieldValue(meta.initialValue)}
                              </div>
                            ) : (
                              <div className="pt-1">
                                <Input
                                  inputMode="decimal"
                                  type="number"
                                  step="any"
                                  value={fieldState.inputs[key] ?? ""}
                                  disabled={inputDisabled}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setFieldState((prev) => {
                                      if (!prev) return prev;
                                      return { ...prev, inputs: { ...prev.inputs, [key]: next } };
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground">No financial statement data available.</div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={disabled || saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

