import type { PortalType } from "@cashsouk/types";

export function accountHref(userId: string): string {
  return `/accounts/${encodeURIComponent(userId)}`;
}

export function orgListHref(portal: PortalType): string {
  return portal === "issuer" ? "/issuers" : "/investors";
}

export function orgHref(portal: PortalType, id: string): string {
  return `${orgListHref(portal)}/${encodeURIComponent(id)}`;
}

/** Issuer Organization tab — MARC assessment card lives here, not a dedicated MARC route. */
export function issuerMarcHref(organizationId: string): string {
  return `${orgHref("issuer", organizationId)}?tab=organization#marc-assessment`;
}

export function orgPeopleAccessHref(
  portal: PortalType,
  organizationId: string,
  options: { filter?: "pending" } = {}
): string {
  const params = new URLSearchParams({ tab: "people" });
  if (options.filter) params.set("filter", options.filter);
  return `${orgHref(portal, organizationId)}?${params.toString()}#profile-people`;
}

export function applicationHref(productId: string, applicationId: string): string {
  return `/applications/${encodeURIComponent(productId)}/${encodeURIComponent(applicationId)}`;
}

export function paymasterHref(id: string): string {
  return `/paymasters/${encodeURIComponent(id)}`;
}
