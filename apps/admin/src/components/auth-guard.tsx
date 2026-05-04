"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, hasAdminRole } = useAuth();

  const skipGuard = pathname === "/callback";

  useEffect(() => {
    if (skipGuard) return;
  }, [skipGuard, isAuthenticated, hasAdminRole]);

  if (skipGuard) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (isAuthenticated === null || hasAdminRole === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or doesn't have admin role, useAuth will redirect
  // But we still need to handle the case where redirect hasn't happened yet
  if (isAuthenticated === false || hasAdminRole === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and has ADMIN role
  return <>{children}</>;
}

