"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { ContractsTable } from "@/components/contracts-table";
import { ContractsTableToolbar } from "@/components/contracts-table-toolbar";
import { ContractDetailModal } from "@/components/contract-detail-modal";
import { useContracts } from "@/hooks/use-contracts";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import type { ContractListItem, GetAdminContractsParams } from "@cashsouk/types";

const DEFAULT_STATUS_FILTERS = ["SUBMITTED", "OFFER_SENT", "AMENDMENT_REQUESTED"];

export default function ContractsPage() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<string[]>(DEFAULT_STATUS_FILTERS);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedContractId, setSelectedContractId] = React.useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const pageSize = 10;

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
    queryClient.invalidateQueries({ queryKey: ["admin", "contracts"] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilters([]);
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilters]);

  const contracts = data?.contracts || [];
  const totalContracts = data?.pagination.totalCount || 0;

  const handleViewDetails = (contract: ContractListItem) => {
    setSelectedContractId(contract.id);
    setIsDetailModalOpen(true);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Contracts</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <DocumentTextIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Contracts Registry</h2>
                <p className="text-sm text-muted-foreground">
                  Track contract status and facility values across issuer organizations
                </p>
              </div>
            </div>

            {error && (
              <div className="text-center py-8 text-destructive">
                Error loading contracts:{" "}
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
              onReload={handleReload}
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
      <ContractDetailModal
        contractId={selectedContractId}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
      />
    </>
  );
}
