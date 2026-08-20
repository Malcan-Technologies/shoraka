"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { AccessLogsPanel } from "@/components/audit/access-logs-panel";
import { LegalDocumentAuditPanel } from "@/components/audit/legal-document-audit-panel";
import { NotificationLogsPanel } from "@/components/audit/notification-logs-panel";
import { OnboardingLogsPanel } from "@/components/audit/onboarding-logs-panel";
import { ProductLogsPanel } from "@/components/audit/product-logs-panel";
import { SecurityLogsPanel } from "@/components/audit/security-logs-panel";
import { AccessDeniedCard } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { resolvePermissionGate } from "@/lib/admin-auth-gate";
import { AUDIT_PERMISSIONS, AUDIT_TABS, isAuditTabId, type AuditTabId } from "@/lib/audit-tabs";

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
  const { can, canAny, isLoading, isAdminPortalUser } = usePermissions();
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

  const permissionView = resolvePermissionGate({
    isPending: isLoading,
    isAdminPortalUser,
    hasPermission: canAny(...AUDIT_PERMISSIONS) && Boolean(activeTab),
  });

  if (permissionView === "loading") {
    return <AuditPageFallback />;
  }

  if (permissionView === "access-denied") {
    return <AccessDeniedCard />;
  }

  if (!activeTab) {
    return <AuditPageFallback />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <AdminPageHeader
          title="Audit Logs"
          description="Review access, security, onboarding, product, legal document, and notification activity across the platform."
        />
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
              {tab.id === "onboarding" ? <OnboardingLogsPanel /> : null}
              {tab.id === "products" ? <ProductLogsPanel /> : null}
              {tab.id === "legal-documents" ? <LegalDocumentAuditPanel /> : null}
              {tab.id === "notifications" ? <NotificationLogsPanel /> : null}
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
