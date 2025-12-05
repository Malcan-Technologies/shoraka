"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cashsouk/ui";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Navbar } from "../../components/navbar";

function AuthErrorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const message = searchParams.get("message") || "Authentication failed. Please try again.";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Auto-redirect to home after countdown
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      router.push("/");
    }
  }, [countdown, router]);

  const handleRetryLogin = () => {
    // Redirect to get-started page to initiate new login
    router.push("/get-started");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background flex items-center justify-center p-6 pt-24">
        <div className="max-w-md w-full">
          <Card className="shadow-lg">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Authentication Error</CardTitle>
              <CardDescription className="text-[15px] leading-7">{message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Button onClick={handleRetryLogin} className="w-full" variant="action">
                  Sign In Again
                </Button>
                <Button onClick={handleGoHome} variant="ghost" className="w-full">
                  Return to Home
                </Button>
              </div>
              {countdown > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Redirecting automatically in {countdown} second{countdown !== 1 ? "s" : ""}...
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <main className="min-h-screen bg-background flex items-center justify-center p-6 pt-24">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </main>
        </>
      }
    >
      <AuthErrorPageContent />
    </Suspense>
  );
}

