import type { AdminPermission } from "@cashsouk/types";

export const AUDIT_TABS = [
  { id: "access", label: "Access", permission: "audit.access.view" },
  { id: "security", label: "Security", permission: "audit.security.view" },
  { id: "onboarding", label: "Onboarding", permission: "onboarding.view" },
  { id: "products", label: "Product", permission: "audit.product.view" },
  { id: "legal-documents", label: "Legal Documents", permission: "document_management.view" },
  { id: "notifications", label: "Notifications", permission: "notifications.view" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  permission: AdminPermission;
}>;

export type AuditTabId = (typeof AUDIT_TABS)[number]["id"];

export const AUDIT_PERMISSIONS: AdminPermission[] = AUDIT_TABS.map((tab) => tab.permission);

export function isAuditTabId(value: string | null): value is AuditTabId {
  return AUDIT_TABS.some((tab) => tab.id === value);
}

export function formatAuditEventLabel(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
