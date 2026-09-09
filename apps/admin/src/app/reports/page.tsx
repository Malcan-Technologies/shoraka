"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartBarSquareIcon } from "@heroicons/react/24/outline";
import { groupReportsByCategory, REPORT_CATEGORIES } from "@cashsouk/types";
import { Card, CardContent, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { AdminPageHeader } from "@/components/admin-page-header";
import { RequirePermission } from "@/components/require-permission";
import { cn } from "@/lib/utils";
import { reportsTabFromSearch } from "@/reports/utils/report-period-filters";

function ReportsCatalogFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

function ReportsCatalogContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = groupReportsByCategory();
  const activeTab = reportsTabFromSearch(searchParams.get("tab"));

  React.useEffect(() => {
    if (searchParams.get("tab") === activeTab) return;
    router.replace(`${pathname}?tab=${activeTab}`);
  }, [activeTab, pathname, router, searchParams]);

  return (
    <RequirePermission permission="reports.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <AdminPageHeader
            title="Reports"
            description="Credit quality, origination, investor & treasury, and regulatory extracts. Dates use inclusive Malaysia calendar days."
          />
          <Tabs
            value={activeTab}
            onValueChange={(value) => router.replace(`${pathname}?tab=${value}`)}
            className="space-y-6"
          >
            <div className="overflow-x-auto">
              <TabsList className="flex h-auto w-max min-w-full flex-nowrap justify-start">
                {REPORT_CATEGORIES.map((category) => (
                  <TabsTrigger key={category.key} value={category.key} className="shrink-0">
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {groups.map((group) => (
              <TabsContent key={group.key} value={group.key} className="mt-0">
                <p className="mb-4 text-ui text-muted-foreground">{group.description}</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.reports.map((report) => {
                    const inner = (
                      <Card
                        className={cn(
                          "h-full rounded-2xl shadow-sm",
                          report.available && "transition-colors hover:bg-muted/40"
                        )}
                      >
                        <CardContent className="space-y-3 p-5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ChartBarSquareIcon className="h-5 w-5" aria-hidden />
                          </div>
                          <div>
                            <h2 className="text-card-title">{report.title}</h2>
                            <p className="mt-1 text-ui text-muted-foreground">{report.description}</p>
                          </div>
                          {!report.available ? (
                            <p className="text-meta text-muted-foreground">Not available yet</p>
                          ) : null}
                        </CardContent>
                      </Card>
                    );

                    if (!report.available) {
                      return (
                        <div key={report.key} aria-disabled="true">
                          {inner}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={report.key}
                        href={`/reports/${report.key}`}
                        className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </RequirePermission>
  );
}

export default function ReportsPage() {
  return (
    <React.Suspense fallback={<ReportsCatalogFallback />}>
      <ReportsCatalogContent />
    </React.Suspense>
  );
}
