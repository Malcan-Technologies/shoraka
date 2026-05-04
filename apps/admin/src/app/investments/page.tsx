"use client";

import { BanknotesIcon, ClockIcon } from "@heroicons/react/24/outline";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";

export default function InvestmentsPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Investments</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full px-2 py-8 md:px-4">
          <Card className="rounded-2xl border-dashed">
            <CardContent className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <BanknotesIcon className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Investments registry coming soon</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                This page will show investment commitments, confirmations, releases, and linked notes once the admin
                investment registry is ready.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
                <ClockIcon className="h-4 w-4" />
                Coming soon
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
