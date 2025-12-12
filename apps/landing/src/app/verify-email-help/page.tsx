"use client";

import * as React from "react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from "@cashsouk/ui";
import { EnvelopeIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ViewState = "enter-email" | "code-sent" | "error" | "already-verified";

function VerifyEmailHelpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewState>("enter-email");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/v1/auth/resend-signup-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.code === "ALREADY_CONFIRMED") {
          setView("already-verified");
        } else if (data.error?.code === "USER_NOT_FOUND") {
          setError("No account found with this email address. Please sign up first.");
        } else if (data.error?.code === "TOO_MANY_REQUESTS") {
          setError("Too many requests. Please try again later.");
        } else {
          setError(data.error?.message || "Failed to send verification code. Please try again.");
        }
      } else {
        // Redirect directly to verify-email page with email pre-filled
        redirectToVerify();
      }
    } catch (err) {
      console.error("Error sending verification code:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToVerify = () => {
    router.push(`/verify-email?email=${encodeURIComponent(email)}&signup=true`);
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {view === "code-sent" || view === "already-verified" ? (
              <CheckCircleIcon className="h-12 w-12 text-green-500" />
            ) : view === "error" ? (
              <ExclamationCircleIcon className="h-12 w-12 text-destructive" />
            ) : (
              <EnvelopeIcon className="h-12 w-12 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {view === "code-sent"
              ? "Verification Code Sent"
              : view === "already-verified"
                ? "Already Verified"
                : view === "error"
                  ? "Something Went Wrong"
                  : "Email Verification Help"}
          </CardTitle>
          <CardDescription>
            {view === "code-sent"
              ? "Check your email for the verification code"
              : view === "already-verified"
                ? "Your email is already verified"
                : view === "error"
                  ? "We couldn't send the verification code"
                  : "Can't sign in? Let's verify your email address"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {view === "enter-email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Enter the email you used to sign up. We'll send you a verification code.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Verification Code"}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => router.push("/get-started")}
                  className="text-sm"
                >
                  Back to sign in
                </Button>
              </div>
            </form>
          )}

          {view === "code-sent" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <p className="text-sm text-green-700 dark:text-green-400">
                  We've sent a verification code to <strong>{email}</strong>
                </p>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Click the button below to enter your verification code
              </p>

              <Button onClick={redirectToVerify} className="w-full">
                Enter Verification Code
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setView("enter-email")}
                  className="text-sm"
                >
                  Use a different email
                </Button>
              </div>
            </div>
          )}

          {view === "already-verified" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Your email address <strong>{email}</strong> is already verified!
                </p>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                You can now sign in normally
              </p>

              <Button onClick={() => router.push("/get-started")} className="w-full">
                Go to Sign In
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setView("enter-email")}
                  className="text-sm"
                >
                  Try a different email
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailHelpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <VerifyEmailHelpContent />
    </Suspense>
  );
}
