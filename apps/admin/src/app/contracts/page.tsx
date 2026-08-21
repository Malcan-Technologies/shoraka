"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ContractsTable } from "@/contracts/components/contracts-table";
import { ContractsTableToolbar } from "@/contracts/components/contracts-table-toolbar";
import { useContracts } from "@/contracts/hooks/use-contracts";
import { contractsKeys } from "@/contracts/query-keys";
import type { ContractListItem, GetAdminContractsParams } from "@cashsouk/types";
import { AdminPageHeader } from "@/components/admin-page-header";
import { RequirePermission } from "@/components/require-permission";

const DEFAULT_STATUS_FILTERS = ["SUBMITTED", "OFFER_SENT", "AMENDMENT_REQUESTED"];

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<string[]>(DEFAULT_STATUS_FILTERS);

  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const apiParams = React.useMemo(() => {
    const p: GetAdminContractsParams = {
      page: currentPage,
      pageSize,
    };

    if (searchQuery) {
      p.search = searchQuery;
    }

    if (statusFilters.length > 0) {
      p.statuses = statusFilters;
    }

    return p;
  }, [currentPage, pageSize, searchQuery, statusFilters]);

  const {
    data,
    isLoading,
    error,
  } = useContracts(apiParams);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: contractsKeys.all });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilters([]);
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilters]);

  React.useEffect(() => {
    const contractId = searchParams.get("contractId");
    if (!contractId) return;
    router.replace(`/contracts/${encodeURIComponent(contractId)}`);
  }, [router, searchParams]);

  const contracts = data?.contracts || [];
  const totalContracts = data?.pagination.totalCount || 0;

  const handleViewDetails = (contract: ContractListItem) => {
    router.push(`/contracts/${encodeURIComponent(contract.id)}`);
  };

  return (
    <RequirePermission permission="contracts.view">
      <>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <AdminPageHeader
              title="Facilities"
              description="Track facility status and utilisation across issuer organizations"
            />

            {error && (
              <div className="text-center py-8 text-destructive">
                Error loading facilities:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            <ContractsTableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilters={statusFilters}
              onStatusFiltersChange={setStatusFilters}
              totalCount={totalContracts}
              filteredCount={totalContracts}
              onClearFilters={handleClearFilters}
              onRefresh={handleReload}
              isLoading={isLoading}
            />

            <ContractsTable
              contracts={contracts}
              loading={isLoading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalContracts={totalContracts}
              onPageChange={setCurrentPage}
              onViewDetails={handleViewDetails}
            />
          </section>
        </div>
      </div>
      </>
    </RequirePermission>
  );
}
