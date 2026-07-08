"use client";

import { usePathname } from "next/navigation";
import { CashSoukPortalFooter, Header, SidebarInset, SidebarProvider } from "@cashsouk/ui";
import { AppSidebar } from "./app-sidebar";
import { isPublicIssuerPath } from "../lib/public-routes";

/** Full issuer portal chrome; omitted on public no-auth routes (external signing). */
export function PortalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicIssuerPath(pathname)) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <Header />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <CashSoukPortalFooter variant="issuer" />
      </SidebarInset>
    </SidebarProvider>
  );
}
