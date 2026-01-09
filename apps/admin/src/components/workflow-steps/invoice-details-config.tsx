"use client";

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
    <div className="space-y-5 pt-4">
      <div className="p-4 rounded-lg border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          Configuration for Invoice Details is not yet available.
        </p>
      </div>
    </div>
  );
}

