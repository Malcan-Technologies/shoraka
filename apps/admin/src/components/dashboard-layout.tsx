"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { Header } from "./header";
import { PageTitleProvider, usePageTitle } from "./page-title-provider";
import { cn } from "@cashsouk/ui";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { title } = usePageTitle();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(JSON.parse(saved));
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem("sidebar-collapsed", JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      <Header collapsed={collapsed} onMobileMenuClick={() => setMobileOpen(true)} title={title} />

      <main
        className={cn(
          "pt-16 transition-all duration-200 ease-out",
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <PageTitleProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PageTitleProvider>
  );
}

