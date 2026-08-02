"use client";

import { APP_VERSION } from "@cashsouk/config";
import { useCompactPortalLegalLinks } from "./hooks/use-compact-portal-legal-links";
import {
  openPublicLegalPdf,
  type PublicLegalPdfLink,
} from "./lib/compact-portal-legal-links";

/**
 * Compact portal footer / sidebar legal links.
 * Opens published public PDFs via the public legal API (no /legal pages).
 */
export type PortalFooterVariant = "issuer" | "investor";
export type SidebarFooterVariant = PortalFooterVariant | "admin";

function LegalLinks({
  links,
  className,
  stacked = false,
}: {
  links: PublicLegalPdfLink[];
  className: string;
  stacked?: boolean;
}) {
  if (links.length === 0) return null;

  return (
    <div className={className}>
      {links.map((link, index) => (
        <span key={link.versionId + link.label} className="inline-flex items-center gap-2">
          {!stacked && index > 0 ? <span aria-hidden>•</span> : null}
          <button
            type="button"
            className="hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => {
              void openPublicLegalPdf(link.versionId, "view").catch(() => {
                // Fail quietly; avoid toast spam on every page.
              });
            }}
          >
            {link.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function CashSoukSidebarFooter({ variant }: { variant: SidebarFooterVariant }) {
  const showContact = variant !== "admin";
  const { links } = useCompactPortalLegalLinks();

  return (
    <div className="mt-auto px-4 py-3 text-left text-xs text-muted-foreground">
      <div className="font-medium text-foreground">CashSouk {APP_VERSION}</div>
      <div className="mt-1">© 2026 Shoraka Sdn. Bhd.</div>

      {showContact ? (
        <>
          <div className="mt-1">(SSM No. 201612345678)</div>
          <div className="mt-2">+60 3-1234 5678</div>
          <div>info@cashsouk.com</div>
          {links.length > 0 ? (
            <>
              <p className="mt-3 font-medium text-foreground">Legal</p>
              <LegalLinks links={links} className="mt-1 flex flex-col gap-1" stacked />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function CashSoukPortalFooter({ variant }: { variant: PortalFooterVariant }) {
  const ariaLabel = variant === "issuer" ? "Issuer portal footer" : "Investor portal footer";
  const { links } = useCompactPortalLegalLinks();

  return (
    <footer
      aria-label={ariaLabel}
      className="border-t bg-background px-4 py-3 text-xs text-muted-foreground md:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">CashSouk {APP_VERSION}</span>
          <span>© 2026 Shoraka Sdn. Bhd.</span>
          <span>(SSM No. 201612345678)</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
          <span>+60 3-1234 5678</span>
          <a href="mailto:info@cashsouk.com" className="hover:text-foreground">
            info@cashsouk.com
          </a>
          <LegalLinks links={links} className="flex flex-wrap items-center justify-end gap-2" />
        </div>
      </div>
    </footer>
  );
}
