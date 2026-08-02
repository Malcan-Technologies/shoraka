"use client";

import { APP_VERSION } from "@cashsouk/config";

/**
 * SECTION: CashSouk Footer
 * WHY: Reusable footer with variant-based display
 * INPUT: variant ("issuer" | "investor" | "admin")
 * OUTPUT: footer UI
 * WHERE USED: portal layouts and admin AppSidebar
 */
export type PortalFooterVariant = "issuer" | "investor";
export type SidebarFooterVariant = PortalFooterVariant | "admin";

const footerLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
] as const;

function FooterLinks({ className }: { className: string }) {
  return (
    <div className={className}>
      {footerLinks.map((link, index) => (
        <span key={link.href} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden>•</span> : null}
          <a href={link.href} className="hover:text-foreground">
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
      <div className="font-medium text-foreground">
        CashSouk {APP_VERSION}
      </div>
      <div className="mt-1">© 2026 Shoraka Sdn. Bhd.</div>

      {showContact ? (
        <>
          <div className="mt-1">(SSM No. 201612345678)</div>

          <div className="mt-2">+60 3-1234 5678</div>

          <div>info@cashsouk.com</div>

          <FooterLinks className="mt-2 flex flex-wrap gap-2" />
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
          <FooterLinks className="flex flex-wrap items-center justify-end gap-2" />
        </div>
      </div>
    </footer>
  );
}
