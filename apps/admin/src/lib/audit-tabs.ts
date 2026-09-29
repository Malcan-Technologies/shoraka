import type { AdminPermission } from "@cashsouk/types";

/** Audit page tabs. Each tab is shown only with its own audit.* permission. */
export const AUDIT_TABS = [
  { id: "access", label: "Access", permission: "audit.access.view" },
  { id: "security", label: "Security", permission: "audit.security.view" },
  { id: "products", label: "Products", permission: "audit.product.view" },
  { id: "legal-documents", label: "Legal Documents", permission: "audit.legal_documents.view" },
  { id: "legal-acceptances", label: "Legal Acceptances", permission: "audit.legal_acceptances.view" },
  {
    id: "external-acceptances",
    label: "External Acceptances",
    permission: "audit.external_acceptances.view",
  },
  { id: "notifications", label: "Notifications", permission: "audit.notifications.view" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  permission: AdminPermission;
}>;

export type AuditTab = (typeof AUDIT_TABS)[number];
export type AuditTabId = AuditTab["id"];

export const AUDIT_PERMISSIONS: AdminPermission[] = AUDIT_TABS.map((tab) => tab.permission);

export function isAuditTabId(value: string | null): value is AuditTabId {
  return AUDIT_TABS.some((tab) => tab.id === value);
}

export function getVisibleAuditTabs(can: (permission: AdminPermission) => boolean): AuditTab[] {
  return AUDIT_TABS.filter((tab) => can(tab.permission));
}

/** The requested tab when it is allowed, otherwise the first allowed tab. */
export function resolveActiveAuditTab(
  visibleTabs: ReadonlyArray<AuditTab>,
  requestedTab: string | null
): AuditTabId | undefined {
  const requested = visibleTabs.find((tab) => tab.id === requestedTab);
  return requested?.id ?? visibleTabs[0]?.id;
}
