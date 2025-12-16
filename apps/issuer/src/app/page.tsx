"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useOrganization } from "@cashsouk/config";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";

function IssuerDashboardContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { activeOrganization, isLoading: isOrgLoading, isOnboarded } = useOrganization();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check onboarding status after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && !isOrgLoading) {
      // If no active organization or not onboarded, redirect to onboarding
      if (!activeOrganization || !isOnboarded) {
        router.push("/onboarding-start");
        return;
      }
      setCheckingOnboarding(false);
    } else if (isAuthenticated === false) {
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, isOrgLoading, activeOrganization, isOnboarded, router]);

  // Show loading while checking auth or onboarding
  if (isAuthenticated === null || checkingOnboarding || isOrgLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect will happen in useAuth hook
  if (!isAuthenticated) {
    return null;
  }

  // Get organization display name
  const getOrgDisplayName = () => {
    if (!activeOrganization) return "";
    if (activeOrganization.type === "PERSONAL") {
      return "Personal Account";
    }
    return activeOrganization.name || "Company Account";
  };

  const orgName = getOrgDisplayName();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-8 p-2 md:p-4">
          {/* Welcome Section */}
          <section>
            <h2 className="text-2xl font-bold mb-2">Welcome back{orgName ? `, ${orgName}` : ""}!</h2>
            <p className="text-[17px] leading-7 text-muted-foreground">
              Manage your financing requests and track your applications from your dashboard.
            </p>
          </section>

          {/* Placeholder for future content */}
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Active Requests</h3>
              <p className="text-3xl font-bold text-primary">0</p>
              <p className="text-sm text-muted-foreground mt-1">Pending applications</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Total Funded</h3>
              <p className="text-3xl font-bold">RM 0.00</p>
              <p className="text-sm text-muted-foreground mt-1">Approved financing</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Repayments Due</h3>
              <p className="text-3xl font-bold text-amber-600">RM 0.00</p>
              <p className="text-sm text-muted-foreground mt-1">Outstanding amount</p>
            </div>
          </section>

          {/* Recent Applications Placeholder */}
          <section>
            <h3 className="text-xl font-semibold mb-4">Recent Applications</h3>
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                You haven't submitted any financing applications yet.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Start by creating a new financing request.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default function IssuerDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <IssuerDashboardContent />
    </Suspense>
  );
}
