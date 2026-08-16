"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

function AuthCheckingState() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { gate } = useAuth();

  if (pathname === "/callback") {
    return <>{children}</>;
  }

  // Authenticated non-admins stay on this checking-auth view until logout
  // redirect completes. Do not render the admin shell (or Access Denied).
  if (gate !== "allow") {
    return <AuthCheckingState />;
  }

  return <>{children}</>;
}
