"use client";

import { useParams } from "next/navigation";
import { ContractDetailView } from "@/contracts/components/contract-detail-view";
import { RequirePermission } from "@/components/require-permission";

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = typeof params.id === "string" ? params.id : "";

  return (
    <RequirePermission permission="contracts.view">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <ContractDetailView contractId={contractId} />
        </div>
      </div>
    </RequirePermission>
  );
}
