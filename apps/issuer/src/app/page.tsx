"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { createApiClient } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function BorrowerHomePageContent() {
  const { isAuthenticated, token } = useAuth();
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check onboarding status after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && token) {
      const checkOnboarding = async () => {
        try {
          const apiClient = createApiClient(API_URL);
          const result = await apiClient.get<{
            user: {
              issuer_onboarding_completed: boolean;
            };
            activeRole: string | null;
            sessions: {
              active: number;
            };
          }>("/v1/auth/me");

          if (result.success && result.data) {
            const user = result.data.user;
            
            // Check if issuer onboarding is completed
            if (!user.issuer_onboarding_completed) {
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
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Welcome to CashSouk Issuer Portal
        </h1>
        <p className="text-[17px] leading-7 text-muted-foreground">
          Apply for loans quickly and securely
        </p>
      </div>
    </main>
  );
}

export default function BorrowerHomePage() {
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
      <BorrowerHomePageContent />
    </Suspense>
  );
}
