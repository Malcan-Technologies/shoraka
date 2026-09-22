"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider, OrganizationProvider, PortalAuthSessionProvider } from "@cashsouk/config";
import "../lib/amplify-config"; // Initialize Amplify
import { HeaderProvider } from "@cashsouk/ui";
import { redirectToLogin } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function InvestorAuthSession({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <PortalAuthSessionProvider
      enabled={pathname !== "/callback"}
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
        <InvestorAuthSession>
          <OrganizationProvider portalType="investor" apiUrl={API_URL}>
            <HeaderProvider>{children}</HeaderProvider>
          </OrganizationProvider>
        </InvestorAuthSession>
      </AuthProvider>
    </QueryClientProvider>
  );
}

