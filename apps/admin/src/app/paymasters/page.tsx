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

export default function PaymastersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mismatchOnly, setMismatchOnly] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, mismatchOnly]);

  const { data, isLoading, error } = useAdminPaymasters({
    q: searchQuery || undefined,
    mismatchPending: mismatchOnly || undefined,
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
              description="Reusable customer and obligor records created from issuer Customer Details. Review identity mismatches here; Notice of Assignment is managed on the related Note."
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
              statusFilters={[]}
              onStatusFiltersChange={() => undefined}
              statusOptions={[]}
              totalCount={data?.total ?? 0}
              filteredCount={data?.total ?? 0}
              itemLabelSingular="paymaster"
              itemLabelPlural="paymasters"
              extraToggleLabel="Review required"
              extraToggleChecked={mismatchOnly}
              onExtraToggleChange={setMismatchOnly}
              onClearFilters={() => {
                setSearchQuery("");
                setMismatchOnly(false);
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
