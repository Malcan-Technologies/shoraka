"use client";

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
    <div className="space-y-5 pt-4">
      <div className="p-4 rounded-lg border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          Configuration for Financing Terms is not yet available.
        </p>
      </div>
    </div>
  );
}

