"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";

export default function BuyerDetailsStep({
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const { data: application } = useApplication(applicationId);

  const [buyerData, setBuyerData] = React.useState({
    buyerName: "Nestle Food Sdn Bhd",
    buyerEntityType: "Private Limited Company (Sdn Bhd)",
    buyerSsmNumber: "20212345678",
    buyerCountry: "🇲🇾 Malaysia",
    isBuyerRelated: "Yes",
    buyerConsent: null as File | null,
  });

  React.useEffect(() => {
    if (application?.buyerDetails) {
      const data = application.buyerDetails as Record<string, unknown>;
      setBuyerData((prev) => ({
        ...prev,
        buyerName: (data.buyerName as string) || prev.buyerName,
        buyerEntityType: (data.buyerEntityType as string) || prev.buyerEntityType,
        buyerSsmNumber: (data.buyerSsmNumber as string) || prev.buyerSsmNumber,
        buyerCountry: (data.buyerCountry as string) || prev.buyerCountry,
        isBuyerRelated: (data.isBuyerRelated as string) || prev.isBuyerRelated,
      }));
    }
  }, [application]);

  const handleChange = (field: string, value: string) => {
    setBuyerData((prev) => ({ ...prev, [field]: value }));
  };

  React.useEffect(() => {
    if (onDataChange) {
      onDataChange({
        buyerDetails: buyerData,
      });
    }
  }, [buyerData, onDataChange]);

  return (
    <div className="space-y-12">
      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Buyer details</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Buyer name</Label>
            <Input
              type="text"
              value={buyerData.buyerName}
              onChange={(e) => handleChange("buyerName", e.target.value)}
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Buyer entity type</Label>
            <Input
              type="text"
              value={buyerData.buyerEntityType}
              onChange={(e) => handleChange("buyerEntityType", e.target.value)}
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Buyer SSM number</Label>
            <Input
              type="text"
              value={buyerData.buyerSsmNumber}
              onChange={(e) => handleChange("buyerSsmNumber", e.target.value)}
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Buyer country</Label>
            <Input
              type="text"
              value={buyerData.buyerCountry}
              onChange={(e) => handleChange("buyerCountry", e.target.value)}
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div className="col-span-2">
            <Label className="block text-sm text-muted-foreground mb-1">Is buyer related to issuer?</Label>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="relation"
                  checked={buyerData.isBuyerRelated === "Yes"}
                  onChange={() => handleChange("isBuyerRelated", "Yes")}
                  className="accent-primary"
                />
                <span className="text-foreground">Yes</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="relation"
                  checked={buyerData.isBuyerRelated === "No"}
                  onChange={() => handleChange("isBuyerRelated", "No")}
                  className="accent-primary"
                />
                <span className="text-foreground">No</span>
              </label>
            </div>
          </div>
          <div className="col-span-2">
            <Label className="block text-sm text-muted-foreground mb-1">Upload buyer consent</Label>
            <div className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
              <div className="text-2xl mb-2 text-muted-foreground">📤</div>
              <span className="text-accent font-medium">Click to upload</span> or drag and drop<br />
              <span className="text-xs text-muted-foreground">PDF (max. 5MB)</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Contract details</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Contract title</Label>
            <Input
              type="text"
              value="Nestle Food Sdn Bhd"
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Contract number</Label>
            <Input
              type="text"
              value="20212345678"
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Contract value</Label>
            <Input
              type="text"
              value="RM 80,000"
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div></div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Contract start date</Label>
            <Input
              type="date"
              value="2025-04-12"
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div>
            <Label className="block text-sm text-muted-foreground mb-1">Contract end date</Label>
            <Input
              type="date"
              value="2025-04-12"
              className="w-full border border-border h-11 px-4 rounded-xl"
            />
          </div>
          <div className="col-span-2">
            <Label className="block text-sm text-muted-foreground mb-1">Contract description</Label>
            <textarea
              placeholder="Add contract description"
              className="w-full border border-border h-28 px-4 py-2 rounded-xl resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
