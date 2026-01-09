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

  // Transform API products to match table structure
  const products = React.useMemo(() => {
    if (!data || typeof data !== 'object' || !('products' in data)) return [];
    
    const apiProducts = (data as { products: any[] }).products || [];
    
    return apiProducts.map((product: any) => {
      const workflow = Array.isArray(product.workflow) ? product.workflow : [];
      
      // Find financing type step for name and description
      const financingTypeStep = workflow.find((step: any) => 
        step.name?.toLowerCase().includes("financing type")
      );
      
      // Get name and description from financing type config
      const financingTypeConfig = financingTypeStep?.config || {};
      const type = financingTypeConfig.type || {};
      
      return {
        id: product.id,
        name: type.title || financingTypeStep?.name || `Product ${product.id.slice(0, 8)}`,
        description: type.description || null,
        category: type.category || null,
        steps: workflow.length,
        workflow: workflow,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });
  }, [data]);

  const totalProducts = data && typeof data === 'object' && 'pagination' in data 
    ? (data as { pagination: { totalCount: number } }).pagination.totalCount 
    : 0;

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