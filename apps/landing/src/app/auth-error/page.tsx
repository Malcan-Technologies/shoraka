"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cashsouk/ui";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Navbar } from "../../components/navbar";

/**
 * Logout from Cognito and redirect to landing page
 */
async function logoutFromCognito() {
  if (typeof window === "undefined") return;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
  const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  // 1. Manually clear all Cognito cookies
  if (cognitoClientId) {
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.startsWith('CognitoIdentityServiceProvider')) {
        const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost";
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }

  // 2. Call backend logout endpoint (for access logging and session revocation)
  try {
    await fetch(`${API_URL}/v1/auth/cognito/logout?portal=admin`, {
      method: "GET",
      credentials: "include",
    });
  } catch (error) {
    // Ignore errors - we'll still redirect
  }

  // 3. Redirect through Cognito's logout endpoint to clear hosted UI session
  if (cognitoDomain && cognitoClientId) {
    const cognitoDomainUrl = cognitoDomain.startsWith('http://') || cognitoDomain.startsWith('https://')
      ? cognitoDomain
      : `https://${cognitoDomain}`;
    const cognitoLogoutUrl = `${cognitoDomainUrl}/logout?client_id=${cognitoClientId}&logout_uri=${encodeURIComponent(landingUrl)}`;
    window.location.href = cognitoLogoutUrl;
  } else {
    window.location.href = landingUrl;
  }
}

function AuthErrorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const message = searchParams.get("message") || "Authentication failed. Please try again.";
  const wasPreviouslyAdmin = searchParams.get("wasPreviouslyAdmin") === "true";
  const [countdown, setCountdown] = useState(wasPreviouslyAdmin ? 5 : 0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // If user was never an admin, logout immediately and redirect
    if (!wasPreviouslyAdmin && !isLoggingOut) {
      setIsLoggingOut(true);
      logoutFromCognito();
      return;
    }

    // If user was previously an admin, show countdown then logout
    if (wasPreviouslyAdmin) {
      if (countdown > 0) {
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else if (countdown === 0 && !isLoggingOut) {
        setIsLoggingOut(true);
        logoutFromCognito();
      }
    }
  }, [countdown, wasPreviouslyAdmin, isLoggingOut]);

  const handleRetryLogin = () => {
    // Redirect to get-started page to initiate new login
    router.push("/get-started");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await logoutFromCognito();
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
                {wasPreviouslyAdmin ? (
                  <>
                    <Button 
                      onClick={handleSignOut} 
                      className="w-full" 
                      variant="action"
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? "Signing Out..." : "Sign Out"}
                    </Button>
                    <Button 
                      onClick={handleGoHome} 
                      variant="ghost" 
                      className="w-full"
                      disabled={isLoggingOut}
                    >
                      Return to Home
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleRetryLogin} className="w-full" variant="action">
                      Sign In Again
                    </Button>
                    <Button onClick={handleGoHome} variant="ghost" className="w-full">
                      Return to Home
                    </Button>
                  </>
                )}
              </div>
              {wasPreviouslyAdmin && countdown > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Signing out automatically in {countdown} second{countdown !== 1 ? "s" : ""}...
                </p>
              )}
              {wasPreviouslyAdmin && isLoggingOut && (
                <p className="text-xs text-center text-muted-foreground">
                  Signing out...
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

