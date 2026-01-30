"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { AuthProvider, OrganizationProvider } from "@cashsouk/config";
import "../lib/amplify-config"; // Initialize Amplify
import { HeaderProvider } from "../components/header-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
        <OrganizationProvider portalType="issuer" apiUrl={API_URL}>
          <HeaderProvider>{children}</HeaderProvider>
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

