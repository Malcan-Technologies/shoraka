"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { createApiClient } from "@cashsouk/config";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function InvestorDashboardContent() {
  const { isAuthenticated, token } = useAuth();
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [userName, setUserName] = useState<string>("");

  // Check onboarding status after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && token) {
      const checkOnboarding = async () => {
        try {
          const apiClient = createApiClient(API_URL);
          const result = await apiClient.get<{
            user: {
              first_name: string | null;
              last_name: string | null;
              investor_onboarding_completed: boolean;
            };
            activeRole: string | null;
            sessions: {
              active: number;
            };
          }>("/v1/auth/me");

          if (result.success && result.data) {
            const user = result.data.user;
            
            // Set user name for welcome message
            const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
            setUserName(name || "Investor");
            
            // Check if investor onboarding is completed
            if (!user.investor_onboarding_completed) {
              // Redirect to onboarding if not completed
              router.push("/onboarding-start");
              return;
            }
          }
        } catch (error) {
          console.error("Failed to check onboarding status:", error);
        } finally {
          setCheckingOnboarding(false);
        }
      };

      checkOnboarding();
    } else if (isAuthenticated === false) {
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, token, router]);

  // Show loading while checking auth or onboarding
  if (isAuthenticated === null || checkingOnboarding) {
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
            <h2 className="text-2xl font-bold mb-2">Welcome back{userName ? `, ${userName}` : ""}!</h2>
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
