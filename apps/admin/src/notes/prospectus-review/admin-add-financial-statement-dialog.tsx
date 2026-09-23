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
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type AdminFinancialStatementStatementType = "AUDITED" | "NOT_AUDITED";

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
  equity_share_application: "Share Application Account",
  equity_share_premium: "Share Premium & Other Reserves",
  equity_accumulated_profit: "Accumulated Profit / Loss",
  equity_minority: "Equity Minority Interest",
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

const ADD_MODAL_CATEGORIES: Array<{ title: string; keys: readonly string[] }> = [
  { title: "Assets", keys: ["bsfatot", "othass", "bscatot", "bsclbank", "cashAndBank", "tradeReceivables"] },
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
    keys: ["bsqpuc", "equity_share_application", "equity_share_premium", "equity_accumulated_profit", "equity_minority"],
  },
  {
    title: "Profit & Loss",
    keys: ["turnover", "grossProfit", "ebitda", "plnpbt", "plnpat", "plnetdiv", "pl_minority", "plyear", "netOperatingIncome"],
  },
  { title: "Costs", keys: ["costOfSales", "operating_cost", "admin_cost", "interest_cost", "other_cost"] },
  { title: "Cash Flow / Debt", keys: ["operatingCashFlow", "freeCashFlow", "annualDebtService"] },
];

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
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    Assets: true,
    Liabilities: true,
    "Profit & Loss": true,
    Equity: false,
    Costs: false,
    "Cash Flow / Debt": false,
  });

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
    setOpenSections({
      Assets: true,
      Liabilities: true,
      "Profit & Loss": true,
      Equity: false,
      Costs: false,
      "Cash Flow / Debt": false,
    });
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
            <div className="space-y-1">
              <div className="text-muted-foreground">Source: Admin Input</div>
              <div className="text-muted-foreground">
                Calculated fields are read-only and update automatically from raw financial inputs.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Statement type</Label>
            <Select
              value={statementType}
              onValueChange={(v) => setStatementType(v as AdminFinancialStatementStatementType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUDITED">Audited</SelectItem>
                <SelectItem value="NOT_AUDITED">Not audited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-xl border p-3">
            <div className="space-y-4">
              {ADD_MODAL_CATEGORIES.map((cat) => {
                const keys = cat.keys.filter((k) =>
                  FORM_KEYS.includes(k as (typeof FORM_KEYS)[number])
                );
                if (keys.length === 0) return null;
                const isOpen = openSections[cat.title] ?? true;

                return (
                  <div key={cat.title} className="space-y-2">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 hover:bg-muted/30"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenSections((prev) => ({ ...prev, [cat.title]: !isOpen }))
                      }
                    >
                      {isOpen ? (
                        <ChevronDownIcon className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" aria-hidden />
                      )}
                      <span className="text-sm font-semibold text-foreground">{cat.title}</span>
                    </button>

                    {isOpen ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {keys.map((key) => (
                          <div key={key} className="space-y-1">
                            <Label htmlFor={`admin-fs-${key}`} className="text-meta">
                              {UI_FIELD_LABELS[key] ??
                                (FINANCIAL_FIELD_LABELS as Record<string, string>)[key] ??
                                key}
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
                    ) : null}
                  </div>
                );
              })}
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

