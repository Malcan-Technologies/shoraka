"use client";

import { useEffect } from "react";

import { useHeader } from "@cashsouk/ui";

import { DocumentCheckIcon } from "@heroicons/react/24/outline";
import { Card, CardContent } from "@/components/ui/card";
import { RequirePermission } from "@/components/require-permission";

export default function ApplicationsPage() {
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle("Applications");
    return () => setTitle("");
  }, [setTitle]);

  return (
    <RequirePermission permission="applications.view">
      <>
      
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full px-2 py-8 md:px-4">
          <Card className="rounded-2xl border-dashed">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <DocumentCheckIcon className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Select an application queue</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Application queues are grouped by product. Choose a product under Applications in the sidebar to review
                submissions and pending actions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    </RequirePermission>
  );
}
