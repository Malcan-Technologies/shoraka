"use client";

import { APP_VERSION, COMPANY, companyCopyrightLine, companyTelHref } from "@cashsouk/config";
import { toast } from "sonner";
import { openPublicLegalPdf } from "./lib/compact-portal-legal-links";
import { useCompactPortalLegalLinks } from "./hooks/use-compact-portal-legal-links";

/**
 * SECTION: CashSouk Footer
 * WHY: Reusable footer with variant-based display
 * INPUT: variant ("issuer" | "investor" | "admin")
 * OUTPUT: footer UI
 * WHERE USED: portal layouts and admin AppSidebar
 */
export type PortalFooterVariant = "issuer" | "investor";
export type SidebarFooterVariant = PortalFooterVariant | "admin";

function PortalLegalFooterLinks({
  className,
  portal,
}: {
  className: string;
  portal: PortalFooterVariant;
}) {
  const audience = portal === "issuer" ? "ISSUER" : "INVESTOR";
  const { links } = useCompactPortalLegalLinks(audience);

  if (links.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {links.map((link, index) => (
        <span key={link.versionId} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden>•</span> : null}
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              void openPublicLegalPdf(link.versionId, "view").catch(() => {
                toast.error("Unable to open this legal document right now.");
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

function CompanyContactLinks({ className }: { className?: string }) {
  return (
    <div className={className}>
      <a href={`mailto:${COMPANY.email}`} className="hover:text-foreground">
        {COMPANY.email}
      </a>
      <a href={companyTelHref()} className="hover:text-foreground">
        {COMPANY.phone}
      </a>
    </div>
  );
}

export function CashSoukSidebarFooter({ variant }: { variant: SidebarFooterVariant }) {
  const showContact = variant !== "admin";
  const portalVariant: PortalFooterVariant | null =
    variant === "admin" ? null : variant;

  return (
    <div className="mt-auto px-4 py-3 text-left text-meta text-muted-foreground">
      <div className="font-medium text-foreground">CashSouk {APP_VERSION}</div>
      <div className="mt-1">{companyCopyrightLine()}</div>

      {showContact && portalVariant ? (
        <>
          {COMPANY.address ? <div className="mt-1">{COMPANY.address}</div> : null}
          <CompanyContactLinks className="mt-2 flex flex-col gap-0.5" />
          <PortalLegalFooterLinks
            portal={portalVariant}
            className="mt-2 flex flex-wrap gap-2"
          />
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
      className="border-t bg-background px-4 py-3 text-meta text-muted-foreground md:px-6"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">CashSouk {APP_VERSION}</span>
            <span>{companyCopyrightLine()}</span>
          </div>
          {COMPANY.address ? <p>{COMPANY.address}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:justify-end lg:text-right">
          <CompanyContactLinks className="flex flex-wrap items-center gap-x-3 gap-y-1" />
          <PortalLegalFooterLinks
            portal={variant}
            className="flex flex-wrap items-center gap-2"
          />
        </div>
      </div>
    </footer>
  );
}
