"use client";

/**
 * Shared UI for contract and invoice offer signing.
 * Both signing pages use this component so the layout stays consistent.
 * Pass type and record; the real UI will be implemented later.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

type OfferSignViewProps = {
  type: "contract" | "invoice";
  record: any;
};

export function OfferSignView({ type, record }: OfferSignViewProps) {
  console.log("OfferSignView received record:", record);

  const title = type === "contract" ? "Contract Offer Signing" : "Invoice Offer Signing";

  return (
    <div className="space-y-6 p-6">
      <Link href="/applications" className="text-primary hover:underline text-sm">
        Back to Applications
      </Link>

      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">Record ID: {record?.id}</p>

      <div className="rounded-lg border bg-muted/30 p-6 text-muted-foreground">
        Agreement content will appear here
      </div>

      <div className="flex gap-3">
        <Button>Accept and Sign</Button>
        <Button variant="outline">Reject Offer</Button>
      </div>
    </div>
  );
}
