"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useAuthToken } from "@cashsouk/config";
import { createApiClient } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { getAccessToken } = useAuthToken();
  const [hasIssuerRole, setHasIssuerRole] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Skip auth guard for callback and onboarding-start pages - they have their own logic
  const shouldSkipAuthGuard = pathname === "/callback" || pathname === "/onboarding-start";

  useEffect(() => {
    // Skip role check for callback and onboarding-start pages
    if (shouldSkipAuthGuard) {
      setChecking(false);
      return;
    }

    // Don't check if already checking or not authenticated
    if (!isAuthenticated || hasIssuerRole !== null) {
      return;
    }

    const checkRole = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const result = await apiClient.get<{
          user: {
            roles: string[];
            issuer_onboarding_completed: boolean;
          };
        }>("/v1/auth/me");

        if (result.success && result.data?.user) {
          const roles = result.data.user.roles || [];
          const hasRole = roles.includes("ISSUER");
          
          if (!hasRole) {
            // User doesn't have ISSUER role - redirect to onboarding
            console.log("[AuthGuard] User lacks ISSUER role, redirecting to onboarding");
            setHasIssuerRole(false);
            router.push("/onboarding-start");
            return;
          }
          
          setHasIssuerRole(true);
        } else {
          setHasIssuerRole(false);
          router.push("/onboarding-start");
        }
      } catch (error) {
        console.error("[AuthGuard] Failed to check issuer role:", error);
        setHasIssuerRole(false);
        router.push("/onboarding-start");
      } finally {
        setChecking(false);
      }
    };

    checkRole();
  }, [isAuthenticated, router, getAccessToken, hasIssuerRole, shouldSkipAuthGuard]);

  // Skip auth guard for callback and onboarding-start pages
  if (shouldSkipAuthGuard) {
    return <>{children}</>;
  }

  // Show loading while checking authentication or role
  if (isAuthenticated === null || checking || hasIssuerRole === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or no issuer role, show loading (redirect will happen)
  if (isAuthenticated === false || hasIssuerRole === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and has ISSUER role
  return <>{children}</>;
}

