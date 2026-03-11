"use client";

/**
 * Invoice Offer Signing page.
 * Fetches invoice, redirects if status is not SENT, renders shared OfferSignView.
 */

import { useParams, useRouter } from "next/navigation";
import { useInvoice } from "@/hooks/use-invoices";
import { useEffect } from "react";
import { OfferSignView } from "../../components/OfferSignView";
import { OfferSignSkeleton } from "../../components/OfferSignSkeleton";

export default function InvoiceSignPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  const { data: invoiceRecord, isLoading } = useInvoice(invoiceId);

  /** Only allow visit when invoice status is SENT. Otherwise redirect to applications. */
  useEffect(() => {
    if (!invoiceRecord) return;
    const status = String(invoiceRecord.status ?? "").toUpperCase();
    if (status !== "SENT") {
      router.replace("/applications");
    }
  }, [invoiceRecord, router]);

  useEffect(() => {
    if (invoiceRecord) {
      console.log("Invoice record:", invoiceRecord);
    }
  }, [invoiceRecord]);

  if (isLoading) {
    return <OfferSignSkeleton />;
  }

  if (!invoiceRecord) {
    return <OfferSignSkeleton />;
  }

  const status = String(invoiceRecord.status ?? "").toUpperCase();
  if (status !== "SENT") {
    return <OfferSignSkeleton />;
  }

  return <OfferSignView type="invoice" record={invoiceRecord} />;
}
