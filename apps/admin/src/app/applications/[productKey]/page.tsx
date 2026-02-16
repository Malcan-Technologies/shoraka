"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { ApplicationsTable } from "@/components/applications-table";
import { ApplicationsTableToolbar } from "@/components/applications-table-toolbar";
import { useApplications } from "@/hooks/use-applications";
import { useProducts } from "@/hooks/use-products";
import { productName } from "@/app/settings/products/product-utils";
import { useRouter, useParams } from "next/navigation";
import {
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import type {
  GetAdminApplicationsParams,
} from "@cashsouk/types";

export default function DynamicApplicationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams();
  const productKey = params.productKey as string;

  // Fetch products to get the current product name
  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });
  const currentProduct = productsData?.products.find(p => p.id === productKey);
  const currentProductName = currentProduct ? productName(currentProduct) : "Applications";

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("SUBMITTED");

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  // Build API params
  const apiParams = React.useMemo(() => {
    const p: GetAdminApplicationsParams = {
      page: currentPage,
      pageSize,
      productId: productKey,
    };

    if (searchQuery) {
      p.search = searchQuery;
    }

    if (statusFilter !== "all") {
      p.status = statusFilter;
    }

    return p;
  }, [currentPage, pageSize, searchQuery, statusFilter, productKey]);

  const {
    data,
    isLoading,
    error
  } = useApplications(apiParams);

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "applications", productKey] });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const applications = data?.applications || [];
  const totalApplications = data?.pagination.totalCount || 0;

  const handleViewDetails = (app: { id: string }) => {
    router.push(`/applications/${productKey}/${app.id}`);
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">{currentProductName} Applications</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-8">

          {/* Applications Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BanknotesIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Applications Queue</h2>
                <p className="text-sm text-muted-foreground">
                  Review and process {currentProductName} applications from issuer organizations
                </p>
              </div>
            </div>

            {error && (
              <div className="text-center py-8 text-destructive">
                Error loading applications:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            {/* Toolbar */}
            <ApplicationsTableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              totalCount={totalApplications}
              filteredCount={totalApplications}
              onClearFilters={handleClearFilters}
              onReload={handleReload}
              isLoading={isLoading}
            />

            <ApplicationsTable
              applications={applications}
              loading={isLoading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalApplications={totalApplications}
              onPageChange={setCurrentPage}
              onViewDetails={handleViewDetails}
            />
          </section>
        </div>
      </div>
    </>
  );
}
