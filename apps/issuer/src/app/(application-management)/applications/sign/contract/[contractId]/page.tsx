"use client";

/**
 * Contract Offer Signing page.
 * Fetches contract, redirects if status is not OFFER_SENT, renders shared OfferSignView.
 */

import { useParams, useRouter } from "next/navigation";
import { useContract } from "@/hooks/use-contracts";
import { useEffect } from "react";
import { OfferSignView } from "../../components/OfferSignView";
import { OfferSignSkeleton } from "../../components/OfferSignSkeleton";

export default function ContractSignPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;

  const { data: contractRecord, isLoading } = useContract(contractId);

  /** Only allow visit when contract status is OFFER_SENT. Otherwise redirect to applications. */
  useEffect(() => {
    if (!contractRecord) return;
    const status = String(contractRecord.status ?? "").toUpperCase();
    if (status !== "OFFER_SENT") {
      router.replace("/applications");
    }
  }, [contractRecord, router]);

  useEffect(() => {
    if (contractRecord) {
      console.log("Contract record:", contractRecord);
    }
  }, [contractRecord]);

  if (isLoading) {
    return <OfferSignSkeleton />;
  }

  if (!contractRecord) {
    return <OfferSignSkeleton />;
  }

  const status = String(contractRecord.status ?? "").toUpperCase();
  if (status !== "OFFER_SENT") {
    return <OfferSignSkeleton />;
  }

  return <OfferSignView type="contract" record={contractRecord} />;
}
