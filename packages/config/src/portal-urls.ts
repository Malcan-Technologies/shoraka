import { resolvePortalOrigin } from "./curlec-checkout";

const DEFAULT_INVESTOR_PORTAL_URL = "http://localhost:3002";

const DEFAULT_HELP_CENTER_URL = "https://help.cashsouk.com";

/** Plain-hosted Help Center for issuers and investors (admin keeps the in-app help). */
export const HELP_CENTER_URL =
  process.env.NEXT_PUBLIC_HELP_CENTER_URL?.trim().replace(/\/$/, "") || DEFAULT_HELP_CENTER_URL;

/** Investor marketplace note path, matching apps/investor `/investments/{noteId}`. */
export function resolveInvestorPortalOrigin(investorPortalUrl?: string): string {
  const configured =
    investorPortalUrl?.trim() ||
    process.env.NEXT_PUBLIC_INVESTOR_URL?.trim() ||
    DEFAULT_INVESTOR_PORTAL_URL;
  return resolvePortalOrigin(configured).replace(/\/$/, "");
}

export function buildInvestorCampaignUrl(
  noteId: string,
  investorPortalUrl?: string
): string {
  const origin = resolveInvestorPortalOrigin(investorPortalUrl);
  return `${origin}/investments/${encodeURIComponent(noteId)}`;
}
