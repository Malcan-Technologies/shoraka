"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cashsouk/ui";
import { BuildingLibraryIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function WelcomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [user, setUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push("/");
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_URL}/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser({
            firstName: data.data.user.first_name || "",
            lastName: data.data.user.last_name || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token, router]);

  const handleGoToDashboard = () => {
    router.push(`/?token=${encodeURIComponent(token || "")}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "there";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BuildingLibraryIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl">Welcome {displayName}</CardTitle>
          <CardDescription className="text-[17px]">
            Welcome to CashSouk Admin Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            You have successfully signed in to the admin portal.
          </p>
          <div className="flex justify-center">
            <Button
              onClick={handleGoToDashboard}
              className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
              size="lg"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function WelcomePage() {
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
      <WelcomePageContent />
    </Suspense>
  );
}

