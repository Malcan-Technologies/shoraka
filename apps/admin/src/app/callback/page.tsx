"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthToken } from "@cashsouk/config";

function CallbackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAccessToken } = useAuthToken();

  useEffect(() => {
    const token = searchParams.get("token");
    const onboarding = searchParams.get("onboarding");

    if (!token) {
      // No token, redirect to home
      router.replace("/");
      return;
    }

    try {
      // Store access token in memory (Auth Context)
      setAccessToken(token);

      // Clean the URL to remove the token
      window.history.replaceState(null, "", window.location.pathname);

      // Redirect based on onboarding status
      if (onboarding === "required") {
        router.replace("/welcome");
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.error("Error processing callback:", error);
      // Clean URL and redirect to home on error
      window.history.replaceState(null, "", window.location.pathname);
      router.replace("/");
    }
  }, [searchParams, router, setAccessToken]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
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
      <CallbackPageContent />
    </Suspense>
  );
}
