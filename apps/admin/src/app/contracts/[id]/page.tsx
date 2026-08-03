"use client";

import { useEffect } from "react";

import { useHeader } from "@cashsouk/ui";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ContractDetailView } from "@/contracts/components/contract-detail-modal";
import { RequirePermission } from "@/components/require-permission";

export default function ContractDetailPage() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;

  useEffect(() => {
    setTitle(`Contract ${contractId.slice(-8).toUpperCase()}`);
    return () => setTitle("");
  }, [setTitle, contractId]);

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
