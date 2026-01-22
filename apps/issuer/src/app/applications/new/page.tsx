"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BellIcon } from "@heroicons/react/24/outline";
import { useCreateDraftApplication, useUpdateApplication } from "@/hooks/use-applications";
import { toast } from "sonner";
import FinancingType1 from "./steps/financing-type-1";

export default function NewApplicationPage() {
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [applicationId, setApplicationId] = React.useState<string | null>(null);

  const createDraft = useCreateDraftApplication();
  const updateApplication = useUpdateApplication();

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
  };

  const handleContinue = async () => {
    if (!selectedProductId) {
      toast.error("Please select a financing type");
      return;
    }

    try {
      let appId = applicationId;

      if (!appId) {
        const newApplication = await createDraft.mutateAsync({});
        appId = newApplication.id;
        setApplicationId(appId);
      }

      await updateApplication.mutateAsync({
        id: appId,
        input: {
          productId: selectedProductId,
        },
      });

      toast.success("Financing type saved");
      router.push(`/applications/${appId}?step=2`);
    } catch (error) {
      toast.error("Failed to save", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2 flex-1">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <Button variant="ghost" size="icon" className="ml-auto">
            <BellIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="flex flex-1 flex-col gap-4">
          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-8 space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Select financing type
              </h1>
              <p className="text-lg leading-7 text-muted-foreground mt-1">
                Browse and invest in verified loan opportunities from your dashboard
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-6 space-y-12">
            <FinancingType1
              stepId="financing_type_1"
              stepName="Select financing type"
              stepConfig={{}}
              applicationId={applicationId}
              selectedProductId={selectedProductId}
              onDataChange={(data) => {
                if (data.productId && typeof data.productId === "string") {
                  handleProductSelect(data.productId);
                }
              }}
            />
          </div>
        </div>
      </main>

      <footer className="flex h-16 shrink-0 items-center justify-end gap-4 border-t px-4">
        <Button
          onClick={handleContinue}
          disabled={!selectedProductId || createDraft.isPending || updateApplication.isPending}
          className="gap-2"
        >
          {createDraft.isPending || updateApplication.isPending ? "Saving..." : "Continue"}
        </Button>
      </footer>
    </div>
  );
}
