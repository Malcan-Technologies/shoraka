import { portalContentMaxWidthClassName } from "@cashsouk/ui";

/**
 * Scrollable main column under the portal header (matches SidebarInset child usage).
 */
export const issuerMainContentClassName =
  "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto";

/**
 * Standard page gutters below the header — horizontal and vertical padding for issuer pages.
 */
export const issuerPageGutterClassName =
  "w-full min-w-0 px-6 pt-6 pb-10 sm:px-8 sm:pt-8 sm:pb-12 lg:px-10";

/**
 * Centered content width for non-full-bleed issuer pages.
 * Help Center is full-bleed; do not reuse this for `/help`.
 * @see portalContentMaxWidthClassName in @cashsouk/ui
 */
export const issuerContentMaxWidthClassName = portalContentMaxWidthClassName;
