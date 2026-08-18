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
