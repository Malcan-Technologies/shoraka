"use client";

import { useParams } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { PaymasterDetailView } from "@/paymasters/components/paymaster-detail-view";

export default function PaymasterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <RequirePermission permission="paymasters.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <PaymasterDetailView paymasterId={id} />
        </div>
      </div>
    </RequirePermission>
  );
}
