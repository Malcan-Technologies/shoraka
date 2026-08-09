"use client";

import { useEffect } from "react";

import { useHeader } from "@cashsouk/ui";
import { formatContractReference } from "@cashsouk/types";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ContractDetailView } from "@/contracts/components/contract-detail-modal";
import { RequirePermission } from "@/components/require-permission";
import { useContractDetail } from "@/contracts/hooks/use-contract-detail";

export default function ContractDetailPage() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;
  const { data } = useContractDetail(contractId);

  useEffect(() => {
    const label = data
      ? formatContractReference({
          displayReference: data.displayReference,
          businessNumber: data.contractNumber,
          id: data.id,
        })
      : contractId.slice(-8).toUpperCase();
    setTitle(`Contract ${label}`);
    return () => setTitle("");
  }, [setTitle, contractId, data]);

  return (
    <RequirePermission permission="contracts.view">
      <>
      
            <div className="flex items-center gap-2 px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/contracts")} className="gap-1.5">
          <ArrowLeftIcon className="h-4 w-4" />
          Contracts
        </Button>
      </div>
<div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <ContractDetailView contractId={contractId} />
        </div>
      </div>
      </>
    </RequirePermission>
  );
}
