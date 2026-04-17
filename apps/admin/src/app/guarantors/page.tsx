"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { GuarantorsTableToolbar } from "../../components/guarantors-table-toolbar";
import { GuarantorsTable } from "../../components/guarantors-table";
import { Badge } from "../../components/ui/badge";
import { useGuarantors } from "../../hooks/use-guarantors";
import type {
  GuarantorAmlStatusEnum,
  GuarantorTypeEnum,
  GetGuarantorsParams,
} from "@cashsouk/types";
import { IdentificationIcon } from "@heroicons/react/24/outline";

const PAGE_SIZE = 10;

export default function GuarantorsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [guarantorType, setGuarantorType] = React.useState<"all" | GuarantorTypeEnum>("all");
  const [amlStatus, setAmlStatus] = React.useState<"all" | GuarantorAmlStatusEnum>("all");

  const params = React.useMemo<GetGuarantorsParams>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(guarantorType !== "all" ? { guarantorType } : {}),
      ...(amlStatus !== "all" ? { amlStatus } : {}),
    }),
    [page, search, guarantorType, amlStatus]
  );

  const { data, isLoading, isFetching, refetch, error } = useGuarantors(params);
  const items = data?.guarantors ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;

  React.useEffect(() => {
    setPage(1);
  }, [search, guarantorType, amlStatus]);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "guarantors"] });
    refetch();
  };

  const handleClearFilters = () => {
    setSearch("");
    setGuarantorType("all");
    setAmlStatus("all");
    setPage(1);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Guarantors</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-8">
          <GuarantorsTableToolbar
            searchQuery={search}
            onSearchChange={setSearch}
            guarantorTypeFilter={guarantorType}
            onGuarantorTypeFilterChange={(value) => setGuarantorType(value as "all" | GuarantorTypeEnum)}
            amlStatusFilter={amlStatus}
            onAmlStatusFilterChange={(value) => setAmlStatus(value as "all" | GuarantorAmlStatusEnum)}
            totalCount={totalCount}
            filteredCount={totalCount}
            onClearFilters={handleClearFilters}
            onReload={handleReload}
            isLoading={isFetching}
          />

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <IdentificationIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Guarantor Registry</h2>
                <p className="text-sm text-muted-foreground">
                  Manage guarantor identities, AML status, and linked applications
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {totalCount} {totalCount === 1 ? "guarantor" : "guarantors"}
              </Badge>
            </div>

            {error && (
              <div className="text-center py-8 text-destructive">
                Error loading guarantors: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            <GuarantorsTable
              guarantors={items}
              loading={isLoading}
              currentPage={page}
              pageSize={PAGE_SIZE}
              totalGuarantors={totalCount}
              onPageChange={setPage}
            />
          </section>
        </div>
      </div>
    </>
  );
}
