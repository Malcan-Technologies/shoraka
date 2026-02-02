"use client";

import { useState, useEffect } from "react";
import type { Product } from "@cashsouk/types";
import { useProducts, useInvalidateProducts, type UseProductsParams } from "../hooks/use-products";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../../components/ui/dialog";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  CubeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

/** Get display name from product workflow (first step type name). */
function productName(p: Product): string {
  const first = p.workflow?.[0] as { config?: { type?: { name?: string } } } | undefined;
  return first?.config?.type?.name ?? p.id;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProductsList() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const invalidateProducts = useInvalidateProducts();

  const params: UseProductsParams = { page, pageSize, search: search || undefined };
  const { data, isPending } = useProducts(params);

  const products = data?.products ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
  };

  return (
    <>
      {/* Toolbar – same layout as documents */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl"
            aria-label="Search products"
          />
        </div>
        {search && (
          <Button
            variant="ghost"
            onClick={handleClearSearch}
            className="gap-2 h-11 rounded-xl"
            aria-label="Clear search"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => invalidateProducts()}
          disabled={isPending}
          className="gap-2 h-11 rounded-xl"
          aria-label="Reload list"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Reload
        </Button>
        <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
          {totalCount} {totalCount === 1 ? "product" : "products"}
        </Badge>
      </div>

      {/* Table – same wrapper and structure as documents */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Product</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <CubeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    <p className="font-medium truncate" title={productName(p)}>
                      {productName(p)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">v{p.version}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(p.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewProduct(p)}
                        title="View"
                        aria-label={`View ${productName(p)}`}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination – same as documents */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Product details</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="grid gap-2 text-sm">
              <p><span className="font-medium text-muted-foreground">Name</span> {productName(viewProduct)}</p>
              <p><span className="font-medium text-muted-foreground">ID</span> {viewProduct.id}</p>
              <p><span className="font-medium text-muted-foreground">Version</span> {viewProduct.version}</p>
              <p><span className="font-medium text-muted-foreground">Created</span> {new Date(viewProduct.created_at).toLocaleString()}</p>
              <p><span className="font-medium text-muted-foreground">Updated</span> {new Date(viewProduct.updated_at).toLocaleString()}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewProduct(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
