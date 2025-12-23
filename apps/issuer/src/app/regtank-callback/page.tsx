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
  const { refreshOrganizations, activeOrganization, syncRegTankStatus } = useOrganization();
  const [status, setStatus] = useState<"syncing" | "pending_approval" | "approved" | "rejected" | "error">("syncing");
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let redirectTimeout: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const maxPolls = 150; // Poll for up to 5 minutes (150 polls × 2 seconds)

    const handleCallback = async () => {
      if (!activeOrganization?.id) {
        setError("No active organization found");
        setStatus("error");
        return;
      }

      try {
        // Immediately refresh organizations to get latest status
        await refreshOrganizations();

        // Sync status from RegTank API (helps when webhooks are delayed)
        try {
          const syncResult = await syncRegTankStatus(activeOrganization.id);
          setCurrentStatus(syncResult.status);
          console.log("[RegTank Callback] Status synced:", syncResult.status);
        } catch (syncError) {
          console.warn("[RegTank Callback] Failed to sync status (non-blocking):", syncError);
          // Non-blocking - continue with polling
        }

        // Poll for status updates (webhook might be delayed)
        const pollForStatus = async () => {
          try {
            await refreshOrganizations();
            pollCount++;

            // Get latest status from sync
            try {
              const syncResult = await syncRegTankStatus(activeOrganization.id);
              const onboardingStatus = syncResult.status.toUpperCase();
              setCurrentStatus(onboardingStatus);

              // Handle different status values
              if (onboardingStatus === "APPROVED") {
                setStatus("approved");
                if (pollInterval) clearInterval(pollInterval);
                // Redirect to dashboard after a brief delay
                redirectTimeout = setTimeout(() => {
                  router.replace("/");
                }, 2000);
                return true;
              } else if (onboardingStatus === "REJECTED") {
                setStatus("rejected");
                if (pollInterval) clearInterval(pollInterval);
                // Don't redirect immediately - show rejection message
                return true;
              } else if (onboardingStatus === "FORM_FILLING" || onboardingStatus === "IN_PROGRESS") {
                // User is still filling out the form - continue polling
                setStatus("syncing");
              } else if (onboardingStatus === "LIVENESS_PASSED" || onboardingStatus === "PENDING_APPROVAL") {
                setStatus("pending_approval");
                // Continue polling
              }
            } catch (syncError) {
              console.warn("[RegTank Callback] Sync error during poll:", syncError);
            }

            // Check organization status as fallback
            if (activeOrganization?.onboardingStatus === "COMPLETED") {
              setStatus("approved");
              if (pollInterval) clearInterval(pollInterval);
              redirectTimeout = setTimeout(() => {
                router.replace("/");
              }, 2000);
              return true;
            }

            // Stop polling after max attempts
            if (pollCount >= maxPolls) {
              // If we're still pending approval, show that status
              if (currentStatus === "PENDING_APPROVAL" || currentStatus === "LIVENESS_PASSED") {
                setStatus("pending_approval");
              } else if (currentStatus === "FORM_FILLING" || currentStatus === "IN_PROGRESS") {
                // Still filling form - show syncing status
                setStatus("syncing");
              } else {
                // Otherwise redirect - webhook might update later
                setStatus("approved");
                redirectTimeout = setTimeout(() => {
                  router.replace("/");
                }, 2000);
              }
              if (pollInterval) clearInterval(pollInterval);
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
          // Poll every 2 seconds for status updates
          pollInterval = setInterval(async () => {
            await pollForStatus();
          }, 2000);
        }
      } catch (err) {
        console.error("[RegTank Callback] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to process callback");
        setStatus("error");
        if (pollInterval) clearInterval(pollInterval);
        // Redirect to dashboard even on error after delay
        redirectTimeout = setTimeout(() => {
          router.replace("/");
        }, 5000);
      }
    };

    handleCallback();

    // Cleanup
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [router, refreshOrganizations, activeOrganization, syncRegTankStatus]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="-ml-1 h-7 w-7 rounded-md" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Skeleton className="h-6 w-28" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          {status === "syncing" && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Verifying your identity...</h2>
                <p className="text-[15px] text-muted-foreground">
                  Please wait while we verify your information
                </p>
              </div>
            </>
          )}

          {status === "pending_approval" && (
            <>
              <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Your submission is under review</h2>
                <p className="text-[15px] text-muted-foreground">
                  We're reviewing your verification. You'll be notified once it's complete.
                </p>
              </div>
            </>
          )}

          {status === "approved" && (
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
                <h2 className="text-xl font-semibold">Verification complete!</h2>
                <p className="text-[15px] text-muted-foreground">
                  Redirecting you to your dashboard...
                </p>
              </div>
            </>
          )}

          {status === "rejected" && (
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
                <h2 className="text-xl font-semibold">Verification failed</h2>
                <p className="text-[15px] text-muted-foreground">
                  Your verification was not approved. Please contact support for assistance.
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
                  {error || "Failed to process callback. Please try again or contact support."}
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

