"use client";

import { useParams } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { PaymasterDetailView } from "@/paymasters/components/paymaster-detail-view";

export default function PaymasterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <RequirePermission permission="paymasters.view">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <PaymasterDetailView paymasterId={id} />
        </div>
      </div>
    </RequirePermission>
  );
}
