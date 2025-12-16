"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useOrganization } from "@cashsouk/config";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";

function IssuerDashboardContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { activeOrganization, isLoading: isOrgLoading, isOnboarded, organizations } = useOrganization();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const hasRedirected = useRef(false);

  // Check onboarding status after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && !isOrgLoading) {
      // If no organizations at all, redirect to onboarding
      if (organizations.length === 0) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding-start");
        }
        return;
      }
      
      // If active organization exists and is onboarded, show dashboard
      if (activeOrganization && isOnboarded) {
        setCheckingOnboarding(false);
        hasRedirected.current = false;
        return;
      }
      
      // If active organization exists but not onboarded, redirect to onboarding
      if (activeOrganization && !isOnboarded) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding-start");
        }
        return;
      }
      
      // No active organization but has organizations
      // This can happen when state is still settling or there's a mismatch
      // Check if any organization is onboarded and show dashboard if so
      if (!activeOrganization && organizations.length > 0) {
        const anyOnboarded = organizations.some(org => org.onboardingStatus === "COMPLETED");
        if (anyOnboarded) {
          // There's an onboarded org but no active one selected yet
          // The context should auto-select one, just wait a bit
          return;
        } else {
          // No onboarded orgs, redirect to onboarding
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            router.push("/onboarding-start");
          }
          return;
        }
      }
    } else if (isAuthenticated === false) {
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, isOrgLoading, activeOrganization, isOnboarded, organizations, router]);

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
