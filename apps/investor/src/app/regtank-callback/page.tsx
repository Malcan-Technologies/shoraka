"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrganization } from "@cashsouk/config";
import { Skeleton } from "../../components/ui/skeleton";
import { Separator } from "../../components/ui/separator";

function RegTankCallbackContent() {
  const router = useRouter();
  const { refreshOrganizations, activeOrganization } = useOrganization();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let redirectTimeout: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const maxPolls = 10; // Poll for up to 10 seconds (10 polls × 1 second)

    const handleCallback = async () => {
      try {
        // Immediately refresh organizations to get latest status
        await refreshOrganizations();

        // Poll for status updates (webhook might be delayed)
        const pollForStatus = async () => {
          try {
            await refreshOrganizations();
            pollCount++;

            // Check if active organization is now completed
            if (activeOrganization?.onboardingStatus === "COMPLETED") {
              setStatus("success");
              if (pollInterval) clearInterval(pollInterval);
              // Redirect to dashboard after a brief delay
              redirectTimeout = setTimeout(() => {
                router.replace("/");
              }, 1500);
              return true;
            }

            // Stop polling after max attempts
            if (pollCount >= maxPolls) {
              setStatus("success");
              if (pollInterval) clearInterval(pollInterval);
              // Redirect anyway - webhook might update later
              redirectTimeout = setTimeout(() => {
                router.replace("/");
              }, 1500);
              return true;
            }

            return false;
          } catch (err) {
            console.error("[RegTank Callback] Poll error:", err);
            return false;
          }
        };

        // Initial check
        const isComplete = await pollForStatus();
        
        if (!isComplete) {
          // Poll every second for status updates
          pollInterval = setInterval(async () => {
            await pollForStatus();
          }, 1000);
        }
      } catch (err) {
        console.error("[RegTank Callback] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to process callback");
        setStatus("error");
        if (pollInterval) clearInterval(pollInterval);
        // Redirect to dashboard even on error after delay
        redirectTimeout = setTimeout(() => {
          router.replace("/");
        }, 3000);
      }
    };

    handleCallback();

    // Cleanup
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [router, refreshOrganizations, activeOrganization]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Skeleton className="h-6 w-28" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          {status === "loading" && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Processing your onboarding...</h2>
                <p className="text-[15px] text-muted-foreground">
                  Please wait while we verify your information
                </p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Onboarding Complete!</h2>
                <p className="text-[15px] text-muted-foreground">
                  Redirecting you to your dashboard...
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <svg
                  className="h-6 w-6 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-[15px] text-muted-foreground">
                  {error || "Failed to process callback. Redirecting to dashboard..."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function RegTankCallbackPage() {
  return (
    <Suspense
      fallback={
        <>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Skeleton className="h-6 w-28" />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </>
      }
    >
      <RegTankCallbackContent />
    </Suspense>
  );
}

