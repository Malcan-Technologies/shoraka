"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page-header";
import { RequirePermission } from "@/components/require-permission";
import { ListToolbar } from "@/shared/admin-list/components/list-toolbar";
import { PaymastersTable } from "@/paymasters/components/paymasters-table";
import { paymastersKeys, useAdminPaymasters } from "@/paymasters/hooks/use-paymasters";
import { paymasterHref } from "@/lib/admin-directory-hrefs";
import type { PaymasterVerificationStatus } from "@cashsouk/types";

export default function PaymastersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [verificationFilters, setVerificationFilters] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;
  const verificationStatus = verificationFilters[0] as PaymasterVerificationStatus | undefined;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, verificationStatus]);

  const { data, isLoading, error } = useAdminPaymasters({
    q: searchQuery || undefined,
    verificationStatus,
    page: currentPage,
    pageSize,
  });

  return (
    <RequirePermission permission="paymasters.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <AdminPageHeader
              title="Paymasters"
              description="Reusable customer and obligor records created from issuer Customer Details. Verify identity here; Notice of Assignment is managed on the related Note."
            />
            {error ? (
              <div className="py-8 text-center text-destructive">
                Error loading paymasters: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : null}
            <ListToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search name or SSM"
              statusFilters={verificationFilters}
              onStatusFiltersChange={setVerificationFilters}
              statusOptions={[
                { value: "VERIFIED", label: "Verified" },
                { value: "UNVERIFIED", label: "Unverified" },
              ]}
              statusFilterMode="single"
              totalCount={data?.total ?? 0}
              filteredCount={data?.total ?? 0}
              itemLabelSingular="paymaster"
              itemLabelPlural="paymasters"
              onClearFilters={() => {
                setSearchQuery("");
                setVerificationFilters([]);
              }}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: paymastersKeys.all })}
              isLoading={isLoading}
            />
            <PaymastersTable
              items={data?.items ?? []}
              loading={isLoading}
              currentPage={currentPage}
              pageSize={pageSize}
              total={data?.total ?? 0}
              onPageChange={setCurrentPage}
              onViewDetails={(item) => router.push(paymasterHref(item.id))}
            />
          </section>
        </div>
      </div>
    </RequirePermission>
  );
}
