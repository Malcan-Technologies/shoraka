"use client";

import { APP_VERSION } from "@cashsouk/config";

/**
 * SECTION: Sidebar Footer
 * WHY: Reusable footer with variant-based display
 * INPUT: variant ("issuer" | "investor" | "admin")
 * OUTPUT: footer UI
 * WHERE USED: issuer, investor, admin AppSidebar
 */
export type SidebarFooterVariant = "issuer" | "investor" | "admin";

export function CashSoukSidebarFooter({ variant }: { variant: SidebarFooterVariant }) {
  const showContact = variant !== "admin";

  return (
    <div className="mt-auto px-4 py-3 text-left text-xs text-gray-400">
      <div className="font-medium text-gray-600">
        CashSouk {APP_VERSION}
      </div>
      <div className="mt-1">© 2026 Shoraka Sdn. Bhd.</div>

      {showContact ? (
        <>
          <div className="mt-1">(SSM No. 201612345678)</div>

          <div className="mt-2">+60 3-1234 5678</div>

          <div>info@cashsouk.com</div>

          <div className="mt-2 flex flex-wrap gap-2">
            <a href="/terms" className="hover:text-gray-600">
              Terms
            </a>
            <span aria-hidden>•</span>
            <a href="/privacy" className="hover:text-gray-600">
              Privacy
            </a>
            <span aria-hidden>•</span>
            <a href="/support" className="hover:text-gray-600">
              Support
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
