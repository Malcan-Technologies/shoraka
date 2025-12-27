"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useOrganization } from "@cashsouk/config";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";

function InvestorDashboardContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { activeOrganization, isLoading: isOrgLoading, isOnboarded, isPendingApproval, organizations } = useOrganization();
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
      
      // If active organization is pending approval, show dashboard with limited access
      if (activeOrganization && isPendingApproval) {
        setCheckingOnboarding(false);
        hasRedirected.current = false;
        return;
      }
      
      // If active organization exists but not onboarded (and not pending approval), redirect to onboarding
      if (activeOrganization && !isOnboarded && !isPendingApproval) {
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          router.push("/onboarding-start");
        }
        return;
      }
      
      // No active organization but has organizations
      // This can happen when state is still settling or there's a mismatch
      // Check if any organization is onboarded or pending approval and show dashboard if so
      if (!activeOrganization && organizations.length > 0) {
        const anyOnboarded = organizations.some(org => org.onboardingStatus === "COMPLETED");
        const anyPendingApproval = organizations.some(org => 
          org.onboardingStatus === "PENDING_APPROVAL" || org.onboardingStatus === "PENDING_AML"
        );
        if (anyOnboarded || anyPendingApproval) {
          // There's an onboarded or pending approval org but no active one selected yet
          // The context should auto-select one, just wait a bit
          return;
        } else {
          // No onboarded or pending approval orgs, redirect to onboarding
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
  }, [isAuthenticated, isOrgLoading, activeOrganization, isOnboarded, isPendingApproval, organizations, router]);

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
  
  // Check if organization is in PENDING_APPROVAL, PENDING_AML, or REJECTED status
  const isPendingApprovalStatus = activeOrganization?.onboardingStatus === "PENDING_APPROVAL" || 
    activeOrganization?.onboardingStatus === "PENDING_AML" ||
    activeOrganization?.regtankOnboardingStatus === "PENDING_APPROVAL";
  const isRejected = activeOrganization?.regtankOnboardingStatus === "REJECTED";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0 relative">
        {/* Overlay for PENDING_APPROVAL, PENDING_AML, or REJECTED status */}
        {(isPendingApprovalStatus || isRejected) && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card rounded-lg p-8 max-w-md mx-4 text-center border shadow-lg">
              <h2 className="text-2xl font-bold mb-4">
                {isPendingApprovalStatus ? "Waiting for Approval" : "Account Rejected"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {isPendingApprovalStatus 
                  ? "Waiting for admin to approve. Your onboarding application is currently under review. You will be notified once the approval process is complete."
                  : "Your onboarding application has been rejected. Please contact support for more information."}
              </p>
              <p className="text-sm text-muted-foreground">
                You can switch between portals or logout, but other features are currently unavailable.
              </p>
            </div>
          </div>
        )}
        
        <div className={`space-y-8 p-2 md:p-4 ${(isPendingApprovalStatus || isRejected) ? "pointer-events-none opacity-50" : ""}`}>
          {/* Welcome Section */}
          <section>
            <h2 className="text-2xl font-bold mb-2">Welcome back{orgName ? `, ${orgName}` : ""}!</h2>
            <p className="text-[17px] leading-7 text-muted-foreground">
              Browse and invest in verified loan opportunities from your dashboard.
            </p>
          </section>

          {/* Placeholder for future content */}
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Portfolio Value</h3>
              <p className="text-3xl font-bold text-primary">RM 0.00</p>
              <p className="text-sm text-muted-foreground mt-1">Total invested</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Active Investments</h3>
              <p className="text-3xl font-bold">0</p>
              <p className="text-sm text-muted-foreground mt-1">Ongoing investments</p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold mb-2">Total Returns</h3>
              <p className="text-3xl font-bold text-green-600">RM 0.00</p>
              <p className="text-sm text-muted-foreground mt-1">Earnings to date</p>
            </div>
          </section>

          {/* Available Opportunities Placeholder */}
          <section>
            <h3 className="text-xl font-semibold mb-4">Available Opportunities</h3>
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                No investment opportunities available at this time.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Check back later for new financing opportunities.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default function InvestorDashboardPage() {
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
      <InvestorDashboardContent />
    </Suspense>
  );
}
