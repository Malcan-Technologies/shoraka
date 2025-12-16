"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

/**
 * AuthGuard - Ensures user is authenticated before rendering children.
 * 
 * Note: This guard only checks authentication status. Organization-based
 * onboarding is handled by the OrganizationProvider and individual pages.
 * User roles (INVESTOR/ISSUER) are NOT used for portal access - any authenticated
 * user can access investor/issuer portals. Roles are only used for admin portal access.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  // Skip auth guard for callback page - it handles its own auth flow
  const shouldSkipAuthGuard = pathname === "/callback";

  // Skip auth guard for callback page
  if (shouldSkipAuthGuard) {
    return <>{children}</>;
  }

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, the useAuth hook will handle redirect to login
  if (isAuthenticated === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // User is authenticated - render children
  // Organization-based onboarding checks are handled by dashboard pages
  return <>{children}</>;
}

