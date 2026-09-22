"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider, OrganizationProvider, PortalAuthSessionProvider } from "@cashsouk/config";
import "../lib/amplify-config"; // Initialize Amplify
import { HeaderProvider } from "@cashsouk/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IssuerUnsavedNavigationProvider } from "@/contexts/issuer-unsaved-navigation-context";
import { redirectToLogin } from "./auth";
import { isPublicIssuerPath } from "./public-routes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function IssuerAuthSession({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = isPublicIssuerPath(pathname);
  return (
    <PortalAuthSessionProvider
      enabled={!isPublicPath}
      disabledAuthenticated={isPublicPath}
      apiUrl={API_URL}
      redirectToLogin={redirectToLogin}
    >
      {children}
    </PortalAuthSessionProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IssuerAuthSession>
          <OrganizationProvider portalType="issuer" apiUrl={API_URL}>
            <HeaderProvider>
              <TooltipProvider>
                <IssuerUnsavedNavigationProvider>{children}</IssuerUnsavedNavigationProvider>
              </TooltipProvider>
            </HeaderProvider>
          </OrganizationProvider>
        </IssuerAuthSession>
      </AuthProvider>
    </QueryClientProvider>
  );
}

