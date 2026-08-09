"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, useHeader } from "@cashsouk/ui";
import type { AdminPermission } from "@cashsouk/types";
import { AccessLogsPanel } from "@/components/audit/access-logs-panel";
import { LegalDocumentAuditPanel } from "@/components/audit/legal-document-audit-panel";
import { ProductLogsPanel } from "@/components/audit/product-logs-panel";
import { SecurityLogsPanel } from "@/components/audit/security-logs-panel";
import { AccessDeniedCard } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";

const AUDIT_TABS = [
  { id: "access", label: "Access", permission: "audit.access.view" },
  { id: "security", label: "Security", permission: "audit.security.view" },
  { id: "products", label: "Products", permission: "audit.product.view" },
  { id: "legal-documents", label: "Legal Documents", permission: "document_management.view" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  permission: AdminPermission;
}>;

type AuditTabId = (typeof AUDIT_TABS)[number]["id"];

const AUDIT_PERMISSIONS: AdminPermission[] = AUDIT_TABS.map((tab) => tab.permission);

function isAuditTabId(value: string | null): value is AuditTabId {
  return AUDIT_TABS.some((tab) => tab.id === value);
}

function AuditPageFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

function AuditPageContent() {
  const { setTitle } = useHeader();
  React.useEffect(() => {
    setTitle("Audit");
    return () => setTitle("");
  }, [setTitle]);

  const { can, canAny, isLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visibleTabs = AUDIT_TABS.filter((tab) => can(tab.permission));
  const requestedTab = searchParams.get("tab");
  const activeTab: AuditTabId | undefined =
    (isAuditTabId(requestedTab) && visibleTabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : undefined) ?? visibleTabs[0]?.id;

  React.useEffect(() => {
    if (isLoading || !activeTab) return;
    if (requestedTab === activeTab) return;
    router.replace(`${pathname}?tab=${activeTab}`);
  }, [isLoading, activeTab, requestedTab, pathname, router]);

  const handleTabChange = (value: string) => {
    if (!isAuditTabId(value)) return;
    router.replace(`${pathname}?tab=${value}`);
  };

  if (isLoading) {
    return <AuditPageFallback />;
  }

  if (!canAny(...AUDIT_PERMISSIONS) || !activeTab) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex h-auto w-fit max-w-full flex-wrap justify-start">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              {tab.id === "access" ? <AccessLogsPanel /> : null}
              {tab.id === "security" ? <SecurityLogsPanel /> : null}
              {tab.id === "products" ? <ProductLogsPanel /> : null}
              {tab.id === "legal-documents" ? <LegalDocumentAuditPanel /> : null}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<AuditPageFallback />}>
      <AuditPageContent />
    </Suspense>
  );
}
