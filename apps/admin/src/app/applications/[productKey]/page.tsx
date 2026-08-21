"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApplicationsTable } from "@/components/applications-table";
import { ApplicationsTableToolbar } from "@/components/applications-table-toolbar";
import { useApplications } from "@/hooks/use-applications";
import { invalidateAdminApplicationNavQueries } from "@/lib/admin-application-nav-cache";
import { useProducts } from "@/hooks/use-products";
import { productName, resolveDisplayProductForNav } from "@/app/settings/products/product-utils";
import { useRouter, useParams } from "next/navigation";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import type {
  GetAdminApplicationsParams,
} from "@cashsouk/types";

const DEFAULT_STATUS_FILTERS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "RESUBMITTED",
  "CONTRACT_PENDING",
  "CONTRACT_ACCEPTED",
  "INVOICE_ACCEPTED",
  "SIGNING_PENDING",
  "INVOICE_PENDING",
];

export default function DynamicApplicationsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams();
  const productKey = params.productKey as string;

  // Fetch products to get the current product name (include deleted/inactive for nav key match)
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, includeDeleted: true });
  const currentProduct = productsData?.products
    ? resolveDisplayProductForNav(productsData.products, productKey)
    : undefined;
  const currentProductName = currentProduct ? productName(currentProduct) : "Applications";

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<string[]>(DEFAULT_STATUS_FILTERS);

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

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

    if (statusFilters.length > 0) {
      p.statuses = statusFilters;
    }

    return p;
  }, [currentPage, pageSize, searchQuery, statusFilters, productKey]);

  const {
    data,
    isLoading,
    error
  } = useApplications(apiParams);

  const handleReload = () => {
    invalidateAdminApplicationNavQueries(queryClient);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilters([]);
    setCurrentPage(1);
  };

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilters]);

  const applications = data?.applications || [];
  const totalApplications = data?.pagination.totalCount || 0;

  const handleViewDetails = (app: { id: string }) => {
    router.push(`/applications/${productKey}/${app.id}`);
  };

  return (
    <RequirePermission permission="applications.view">
      <>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">

          <section className="space-y-4">
            <AdminPageHeader
              title={`${currentProductName} Applications`}
              description={`Review and process ${currentProductName} applications from issuer organizations`}
            />

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
              statusFilters={statusFilters}
              onStatusFiltersChange={setStatusFilters}
              totalCount={totalApplications}
              filteredCount={totalApplications}
              onClearFilters={handleClearFilters}
              onRefresh={handleReload}
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
    </RequirePermission>
  );
}
