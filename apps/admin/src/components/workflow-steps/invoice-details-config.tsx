"use client";

import { Label } from "@/components/ui/label";

interface InvoiceDetailsConfig {
  invoiceNumberLabel?: string;
  invoiceDateLabel?: string;
  buyerInfoRequired?: boolean;
  uploadRequired?: boolean;
}

interface InvoiceDetailsConfigProps {
  config: InvoiceDetailsConfig;
  onChange: (config: InvoiceDetailsConfig) => void;
}

export function InvoiceDetailsConfig({}: InvoiceDetailsConfigProps) {
  return (
    <div className="p-3 sm:p-5 rounded-lg border bg-card">
      <div className="mb-4 sm:mb-5">
        <Label className="text-sm sm:text-base font-semibold">
          Invoice Details
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Invoice information and verification
        </p>
      </div>
      <div className="p-4 rounded-lg border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          Configuration for Invoice Details is not yet available.
        </p>
      </div>
    </div>
  );
}

