"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/components/ui/skeleton";

const staticWorkflowSteps = [
  "Financing Type",
  "Invoice Details",
  "Buyer Details",
  "Verify Company Info",
  "Supporting Documents",
  "Declaration",
  "Review & Submit",
];

const staticProducts = [
  {
    id: "prod1",
    name: "Account Receivable (AR) Financing",
    description: "Get funding against your issued invoices under Islamic financing principles",
    category: "Invoice financing",
    imageUrl: "", // Will be populated from product data later
  },
  {
    id: "prod2",
    name: "Account Payable (AP) Financing",
    description: "Convert your outstanding trade receivables into working capital instantly.",
    category: "Invoice financing",
    imageUrl: "", // Will be populated from product data later
  },
];

export default function NewApplicationPage() {
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = React.useState<string>(
    staticProducts[0]?.id || ""
  );

  // Group products by category
  const productsByCategory = React.useMemo(() => {
    const grouped: Record<string, typeof staticProducts> = {};
    staticProducts.forEach((product) => {
      const category = product.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    return grouped;
  }, []);

  const handleProductSelect = (productId: string) => {
    console.log("Selected product:", productId);
    setSelectedProductId(productId);
  };

  const handleContinue = () => {
    console.log("Continue with product:", selectedProductId);
    router.push(`/applications/edit/test-id?step=1`);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-1 flex-col gap-4">
          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Select financing type
              </h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Browse and invest in verified loan opportunities from your dashboard
              </p>
            </div>

            <ProgressIndicator
              steps={staticWorkflowSteps}
              currentStep={1}
              isLoading={false}
            />
          </div>

          <div className="h-px bg-border w-full -mx-4" />

          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-6">
            <div className="space-y-6 md:space-y-8">
              {false ? (
                <div className="space-y-4">
                  <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <div className="mt-2 h-px bg-border" />
                  </div>
                  <div className="space-y-4 pl-4 md:pl-6">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="relative flex items-start gap-4 border rounded-xl p-4"
                      >
                        <Skeleton className="w-14 h-14 shrink-0 rounded-lg" />
                        <div className="flex-1 pr-8 md:pr-10 space-y-2">
                          <Skeleton className="h-6 w-64" />
                          <Skeleton className="h-4 w-full max-w-md" />
                        </div>
                        <div className="absolute top-4 right-4">
                          <Skeleton className="h-5 w-5 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                Object.entries(productsByCategory).map(([category, products]) => (
                  <div key={category} className="space-y-4">
                    <div>
                      <h2 className="text-lg md:text-xl font-semibold">{category}</h2>
                      <div className="mt-2 h-px bg-border" />
                    </div>

                    <div className="space-y-4 pl-4 md:pl-6">
                      {products.map((product) => {
                        const isSelected = selectedProductId === product.id;
                        return (
                          <label
                            key={product.id}
                            className={`relative flex items-start gap-4 border rounded-xl p-4 cursor-pointer ${
                              isSelected ? "border-primary" : "border-border"
                            }`}
                            onClick={() => handleProductSelect(product.id)}
                          >
                            <div className="w-14 h-14 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="text-muted-foreground text-[9px] text-center px-1 leading-tight">
                                  Image
                                  <br />
                                  512x512
                                </div>
                              )}
                            </div>
                            <div className="flex-1 pr-8 md:pr-10">
                              <div className="font-semibold text-lg md:text-xl leading-7">
                                {product.name}
                              </div>
                              <div className="text-muted-foreground text-sm md:text-base leading-6">
                                {product.description}
                              </div>
                            </div>
                            <div className="absolute top-4 right-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    handleProductSelect(product.id);
                                  }
                                }}
                                className="rounded"
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 border-t bg-background z-10 mt-auto">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-4 flex justify-end">
          <Button
            onClick={handleContinue}
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-base md:text-[17px] font-semibold px-4 md:px-6 py-2.5 md:py-3 rounded-xl w-full md:w-auto"
          >
            Save and continue
            <ArrowRightIcon className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
