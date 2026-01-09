"use client"

import * as React from "react";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProductsTableToolbar } from "@/components/products-table-toolbar";
import { useProducts } from "@/hooks/use-products";
import { ProductsTable } from "@/components/products-table";
import { CreateProductDialog } from "@/components/create-proudct-dialog";

export default function ProductsPage() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const { data, isLoading, refetch } = useProducts({
    page: currentPage,
    pageSize,
    ...(searchQuery && { search: searchQuery }),
  });

  const handleClearFilters = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleReload = () => {
    refetch();
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Mock data for preview (remove this when backend is ready)
  const MOCK_PRODUCTS: any[] = [
    {
      id: "prod_001",
      category: "Financing Invoice",
      name: "AP",
      description: "Accounts Payable financing for immediate cash flow",
      image_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=200&h=200&fit=crop",
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-20T14:45:00Z",
    },
    {
      id: "prod_002",
      category: "Financing Invoice",
      name: "AR",
      description: "Accounts Receivable financing to bridge payment gaps",
      image_url: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=200&h=200&fit=crop",
      created_at: "2024-01-10T09:00:00Z",
      updated_at: "2024-01-18T16:20:00Z",
    },
    {
      id: "prod_003",
      category: "Trade Finance",
      name: "Import Finance",
      description: "Financing for import trade activities and purchase orders",
      image_url: "https://images.unsplash.com/photo-1578574577315-3fbeb0cecdc2?w=200&h=200&fit=crop",
      created_at: "2024-01-05T11:15:00Z",
      updated_at: "2024-01-22T10:30:00Z",
    },
    {
      id: "prod_004",
      category: "Trade Finance",
      name: "Export Finance",
      description: "Financing for export trade and overseas transactions",
      image_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=200&h=200&fit=crop",
      created_at: "2024-01-12T13:45:00Z",
      updated_at: "2024-01-25T09:10:00Z",
    },
    {
      id: "prod_005",
      category: "Working Capital",
      name: "Business Loan",
      description: "General purpose working capital for business operations",
      image_url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=200&h=200&fit=crop",
      created_at: "2024-01-08T15:20:00Z",
      updated_at: "2024-01-19T11:05:00Z",
    },
    {
      id: "prod_006",
      category: "Equipment Finance",
      name: "Machinery Lease",
      description: "Financing for purchasing or leasing business equipment",
      image_url: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=200&h=200&fit=crop",
      created_at: "2024-01-14T08:15:00Z",
      updated_at: "2024-01-23T14:20:00Z",
    },
  ];

  // Use mock data for preview (replace with real data when backend is ready)
  const USE_MOCK_DATA = true; // Set to false when backend is ready
  const products = USE_MOCK_DATA ? MOCK_PRODUCTS : (data?.products || []);
  const totalProducts = USE_MOCK_DATA ? MOCK_PRODUCTS.length : (data?.pagination.totalCount || 0);

  // const totalProducts = (data as any)?.pagination.totalCount || 0;
  // const products = (data as any)?.products || [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Products</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>


      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Products</h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Manage products that can be used in loan application forms.
              </p>
            </div>
            <Button variant="action" onClick={() => setCreateDialogOpen(true)}>
              Create Product
            </Button>
          </div>

          <ProductsTableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalCount={totalProducts} // potential issue, total products count might be inaccurate
            filteredCount={totalProducts}
            onClearFilters={handleClearFilters}
            onReload={handleReload}
            isLoading={isLoading}
          />

          <ProductsTable
            products={products}
            isLoading={isLoading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalProducts={totalProducts}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <CreateProductDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}