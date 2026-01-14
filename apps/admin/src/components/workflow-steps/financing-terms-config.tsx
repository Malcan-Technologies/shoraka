"use client";

import { Label } from "@/components/ui/label";

interface FinancingTermsConfig {
  minInvoiceAmount?: number;
  maxInvoiceAmount?: number;
  availableTerms?: string[];
  minProfitRate?: number;
  maxProfitRate?: number;
  showFinancingGoal?: boolean;
  showPaymentDate?: boolean;
  showMonthlyRepayment?: boolean;
}

interface FinancingTermsConfigProps {
  config: FinancingTermsConfig;
  onChange: (config: FinancingTermsConfig) => void;
}

export function FinancingTermsConfig({}: FinancingTermsConfigProps) {
  return (
    <div className="p-3 sm:p-5 rounded-lg border bg-card">
      <div className="mb-4 sm:mb-5">
        <Label className="text-sm sm:text-base font-semibold">
          Financing Terms
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure loan terms and profit rates
        </p>
      </div>
      <div className="p-4 rounded-lg border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          Configuration for Financing Terms is not yet available.
        </p>
      </div>
    </div>
  );
}

