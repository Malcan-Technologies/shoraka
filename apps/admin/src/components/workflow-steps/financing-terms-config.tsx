"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@cashsouk/ui";

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

const DEFAULT_TERMS = ["30 days", "60 days", "90 days", "120 days"];

export function FinancingTermsConfig({ config, onChange }: FinancingTermsConfigProps) {
  const availableTerms = config.availableTerms || DEFAULT_TERMS;

  const toggleTerm = (term: string) => {
    const newTerms = availableTerms.includes(term)
      ? availableTerms.filter((t) => t !== term)
      : [...availableTerms, term];
    onChange({ ...config, availableTerms: newTerms });
  };

  return (
    <div className="space-y-5 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Configure financing terms
        </p>
        <p className="text-xs text-muted-foreground">
          Set limits and options for financing calculations
        </p>
      </div>

      {/* Invoice Amount Range */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <Label className="text-sm font-medium">Invoice Amount Range (RM)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="minAmount" className="text-xs text-muted-foreground">
              Minimum
            </Label>
            <Input
              id="minAmount"
              type="number"
              value={config.minInvoiceAmount || 10000}
              onChange={(e) =>
                onChange({ ...config, minInvoiceAmount: parseFloat(e.target.value) || 10000 })
              }
              placeholder="10,000"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxAmount" className="text-xs text-muted-foreground">
              Maximum
            </Label>
            <Input
              id="maxAmount"
              type="number"
              value={config.maxInvoiceAmount || 500000}
              onChange={(e) =>
                onChange({ ...config, maxInvoiceAmount: parseFloat(e.target.value) || 500000 })
              }
              placeholder="500,000"
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* Loan Terms */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Available Loan Terms</Label>
        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_TERMS.map((term) => (
            <div key={term} className="flex items-center space-x-2 p-2 rounded border bg-background">
              <Checkbox
                id={term}
                checked={availableTerms.includes(term)}
                onCheckedChange={() => toggleTerm(term)}
              />
              <Label htmlFor={term} className="text-sm font-normal cursor-pointer flex-1">
                {term}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Profit Rate Range */}
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
        <Label className="text-sm font-medium">Profit Rate Range (%)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="minRate" className="text-xs text-muted-foreground">
              Minimum
            </Label>
            <Input
              id="minRate"
              type="number"
              step="0.1"
              value={config.minProfitRate || 7}
              onChange={(e) =>
                onChange({ ...config, minProfitRate: parseFloat(e.target.value) || 7 })
              }
              placeholder="7.0"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxRate" className="text-xs text-muted-foreground">
              Maximum
            </Label>
            <Input
              id="maxRate"
              type="number"
              step="0.1"
              value={config.maxProfitRate || 18}
              onChange={(e) =>
                onChange({ ...config, maxProfitRate: parseFloat(e.target.value) || 18 })
              }
              placeholder="18.0"
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* Display Options */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Display Options</Label>
        <div className="space-y-2 pl-1">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="showFinancingGoal"
              checked={config.showFinancingGoal !== false}
              onCheckedChange={(checked) =>
                onChange({ ...config, showFinancingGoal: checked as boolean })
              }
            />
            <Label htmlFor="showFinancingGoal" className="text-sm font-normal cursor-pointer">
              Show financing goal/purpose field
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="showPaymentDate"
              checked={config.showPaymentDate !== false}
              onCheckedChange={(checked) =>
                onChange({ ...config, showPaymentDate: checked as boolean })
              }
            />
            <Label htmlFor="showPaymentDate" className="text-sm font-normal cursor-pointer">
              Show invoice payment due date
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <Checkbox
              id="showMonthlyRepayment"
              checked={config.showMonthlyRepayment !== false}
              onCheckedChange={(checked) =>
                onChange({ ...config, showMonthlyRepayment: checked as boolean })
              }
            />
            <Label htmlFor="showMonthlyRepayment" className="text-sm font-normal cursor-pointer">
              Show monthly repayment calculation
            </Label>
          </div>
        </div>
      </div>

      <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
        RM {config.minInvoiceAmount || 10000} - {config.maxInvoiceAmount || 500000} - {availableTerms.length} terms
        - {config.minProfitRate || 7}-{config.maxProfitRate || 18}%
      </div>
    </div>
  );
}

