"use client";

import { APP_VERSION } from "@cashsouk/config";
import { useCompactPortalLegalLinks } from "./hooks/use-compact-portal-legal-links";

/**
 * Compact portal footer / sidebar legal links.
 * Links open the public landing legal pages (no extra login).
 */
export type PortalFooterVariant = "issuer" | "investor";
export type SidebarFooterVariant = PortalFooterVariant | "admin";

function landingBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function LegalLinks({
  className,
  stacked = false,
}: {
  className: string;
  stacked?: boolean;
}) {
  const base = landingBaseUrl();
  const { links } = useCompactPortalLegalLinks();

  return (
    <div className={className}>
      {links.map((link, index) => (
        <span key={link.path + link.label} className="inline-flex items-center gap-2">
          {!stacked && index > 0 ? <span aria-hidden>•</span> : null}
          <a
            href={`${base}${link.path}`}
            className="hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        </span>
      ))}
    </div>
  );
}

export function CashSoukSidebarFooter({ variant }: { variant: SidebarFooterVariant }) {
  const showContact = variant !== "admin";

  return (
    <div className="mt-auto px-4 py-3 text-left text-xs text-muted-foreground">
      <div className="font-medium text-foreground">CashSouk {APP_VERSION}</div>
      <div className="mt-1">© 2026 Shoraka Sdn. Bhd.</div>

      {showContact ? (
        <>
          <div className="mt-1">(SSM No. 201612345678)</div>
          <div className="mt-2">+60 3-1234 5678</div>
          <div>info@cashsouk.com</div>
          <p className="mt-3 font-medium text-foreground">Legal</p>
          <LegalLinks className="mt-1 flex flex-col gap-1" stacked />
        </>
      ) : null}
    </div>
  );
}

export function CashSoukPortalFooter({ variant }: { variant: PortalFooterVariant }) {
  const ariaLabel = variant === "issuer" ? "Issuer portal footer" : "Investor portal footer";

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
          <LegalLinks className="flex flex-wrap items-center justify-end gap-2" />
        </div>
      </div>
    </footer>
  );
}
