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
import { type AdminFinancialReviewColumn, isAdminEditableRawFinancialKey } from "@cashsouk/types";
import { ADMIN_EDITABLE_RAW_FINANCIAL_KEYS } from "@cashsouk/types";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

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

function parseOptionalNumericInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
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

const UI_FIELD_LABELS: Record<string, string> = {
  // Assets
  bsfatot: "Fixed Assets",
  othass: "Other Assets",
  bscatot: "Current Assets",
  bsclbank: "Non-current Assets",
  cashAndBank: "Cash & Bank",
  tradeReceivables: "Trade Receivables",
  // Liabilities
  curlib: "Current Liabilities",
  bsslltd: "Long-term Liabilities",
  bsclstd: "Non-current Liabilities",
  curlib_borrowing: "Current Borrowings",
  curlib_non_borrowing: "Other Current Liabilities",
  ncl_loan: "Non-current Loans",
  ncl_non_loan: "Other Non-current Liabilities",
  tradePayables: "Trade Payables",
  // Equity
  bsqpuc: "Paid-up Share Capital",
  equity_share_application: "Share Application Account (if applicable)",
  equity_share_premium: "Share Premium & Other Reserves (if applicable)",
  equity_accumulated_profit: "Accumulated Profit / Loss",
  equity_minority: "Equity Minority Interest (if applicable)",
  // Profit & Loss
  turnover: "Revenue / Turnover",
  grossProfit: "Gross Profit",
  ebitda: "EBITDA",
  plnpbt: "Profit / Loss Before Tax",
  plnpat: "Profit / Loss After Tax",
  plnetdiv: "Net Dividend",
  pl_minority: "P&L Minority Interest",
  plyear: "Profit / Loss of Year",
  netOperatingIncome: "Net Operating Income",
  // Costs
  costOfSales: "Cost of Sales",
  operating_cost: "Operating Costs",
  admin_cost: "Administrative Costs",
  interest_cost: "Interest Costs",
  other_cost: "Other Costs",
  // Cash Flow / Debt
  operatingCashFlow: "Operating Cash Flow",
  freeCashFlow: "Free Cash Flow",
  annualDebtService: "Annual Debt Service",
};

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
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    Assets: true,
    Liabilities: true,
    "Profit & Loss": true,
    Equity: false,
    Costs: false,
    "Cash Flow / Debt": false,
  });

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
        label: UI_FIELD_LABELS[key] ?? key,
        readOnly: field.readOnly,
        initialValue: field.value,
        unavailableReason: field.unavailableReason,
        source: field.source,
        editedByAdmin: field.editedByAdmin,
      };
      inputs[key] = field.value == null ? "" : String(field.value);
    }

    setFieldState({ byKey, inputs });
    setOpenSections({
      Assets: true,
      Liabilities: true,
      "Profit & Loss": true,
      Equity: false,
      Costs: false,
      "Cash Flow / Debt": false,
    });
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
            <div className="space-y-1">
              {calendarYear != null ? (
                <div className="text-muted-foreground">Source: {modalSourceLabel}</div>
              ) : null}
              <div className="text-muted-foreground">
                Calculated fields are read-only and update automatically from raw financial inputs.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {fieldState ? (
          <div className="space-y-4">
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border p-3">
              <div className="space-y-4">
                {MODAL_GROUPS.map((g) => {
                  const keys = g.keys.filter((k) => fieldState.byKey[k] != null);
                  if (keys.length === 0) return null;
                  const isOpen = openSections[g.title] ?? true;

                  return (
                    <div key={g.title} className="space-y-2">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 hover:bg-muted/30"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenSections((prev) => ({ ...prev, [g.title]: !isOpen }))
                        }
                      >
                        {isOpen ? (
                          <ChevronDownIcon className="h-4 w-4" aria-hidden />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" aria-hidden />
                        )}
                        <span className="text-sm font-semibold text-foreground">{g.title}</span>
                      </button>

                      {isOpen ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {keys.map((key) => {
                            const meta = fieldState.byKey[key]!;
                            const inputDisabled = disabled || meta.readOnly || saving;

                            const helperText =
                              meta.source === "ctos" && meta.readOnly
                                ? "From CTOS"
                                : meta.source === "ctos" && !meta.readOnly
                                  ? "Not provided by CTOS"
                                  : meta.editedByAdmin && meta.source === "admin_input"
                                    ? "Admin Input"
                                    : meta.source === "user_input" && meta.editedByAdmin
                                      ? "Edited by Admin"
                                      : undefined;

                            return (
                              <div key={key} className="space-y-1">
                                <Label
                                  htmlFor={`edit-fs-${key}`}
                                  className="text-meta font-normal leading-snug"
                                >
                                  {meta.label}
                                </Label>
                                {helperText ? (
                                  <div className="text-[11px] text-muted-foreground">
                                    {helperText}
                                  </div>
                                ) : null}
                                <Input
                                  id={`edit-fs-${key}`}
                                  inputMode="decimal"
                                  type="number"
                                  step="any"
                                  placeholder="—"
                                  value={fieldState.inputs[key] ?? ""}
                                  disabled={inputDisabled}
                                  onChange={(e) => {
                                    if (meta.readOnly) return;
                                    const next = e.target.value;
                                    setFieldState((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        inputs: { ...prev.inputs, [key]: next },
                                      };
                                    });
                                  }}
                                />
                              </div>
                            );
                          })}
                      </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
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

