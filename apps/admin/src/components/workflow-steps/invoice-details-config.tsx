"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function InvoiceDetailsConfig({ config, onChange }: InvoiceDetailsConfigProps) {
  return (
    <div className="space-y-5 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Configure invoice details fields
        </p>
        <p className="text-xs text-muted-foreground">
          Customize what information to collect from the borrower
        </p>
      </div>

      <div className="space-y-4">
        {/* Invoice Number */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <Label htmlFor="invoiceNumber" className="text-sm font-medium">
            Invoice Number Field
          </Label>
          <Input
            id="invoiceNumber"
            placeholder="Enter label (e.g., Invoice number)"
            value={config.invoiceNumberLabel || "Invoice number"}
            onChange={(e) =>
              onChange({ ...config, invoiceNumberLabel: e.target.value })
            }
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Default: "Invoice number"
          </p>
        </div>

        {/* Invoice Date */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <Label htmlFor="invoiceDate" className="text-sm font-medium">
            Invoice Date Field
          </Label>
          <Input
            id="invoiceDate"
            placeholder="Enter label (e.g., Invoice date)"
            value={config.invoiceDateLabel || "Invoice date"}
            onChange={(e) =>
              onChange({ ...config, invoiceDateLabel: e.target.value })
            }
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">Default: "Invoice date"</p>
        </div>

        {/* Buyer Info */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <Label className="text-sm font-medium">Buyer Information</Label>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="buyerInfo"
              checked={config.buyerInfoRequired !== false}
              onChange={(e) =>
                onChange({ ...config, buyerInfoRequired: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="buyerInfo" className="text-sm font-normal cursor-pointer">
              Require buyer information (name, entity type, SSM number, country)
            </Label>
          </div>
        </div>

        {/* Upload Invoice */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <Label className="text-sm font-medium">Upload Invoice</Label>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="uploadInvoice"
              checked={config.uploadRequired !== false}
              onChange={(e) =>
                onChange({ ...config, uploadRequired: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="uploadInvoice" className="text-sm font-normal cursor-pointer">
              Require invoice file upload (PDF, max 5MB)
            </Label>
          </div>
        </div>
      </div>

      <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
        {config.buyerInfoRequired !== false && config.uploadRequired !== false
          ? "Full invoice details required"
          : "Partial invoice details"}
      </div>
    </div>
  );
}

