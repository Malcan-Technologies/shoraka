import { portalContentMaxWidthClassName, portalPageGutterClassName } from "@cashsouk/ui";

/**
 * Scrollable main column under the portal header (matches SidebarInset child usage).
 */
export const issuerMainContentClassName =
  "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto";

/**
 * Standard page gutters below the header — horizontal and vertical padding for issuer pages.
 */
export const issuerPageGutterClassName = portalPageGutterClassName;

/**
 * Centered content width for non-full-bleed issuer pages.
 * @see portalContentMaxWidthClassName in @cashsouk/ui
 */
export const issuerContentMaxWidthClassName = portalContentMaxWidthClassName;
