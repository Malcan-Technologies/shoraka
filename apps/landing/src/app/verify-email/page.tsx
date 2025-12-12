"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input } from "@cashsouk/ui";
import { ArrowLeftIcon, EnvelopeIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Cognito rate limit: 5 requests per second per account (conservative cooldown: 15 seconds)
const RESEND_COOLDOWN_SECONDS = 15;

// Step 1: Enter email
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Step 2: Enter verification code
const codeSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

type EmailFormValues = z.infer<typeof emailSchema>;
type CodeFormValues = z.infer<typeof codeSchema>;

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const redirect = searchParams.get("redirect") || "investor";
  const signup = searchParams.get("signup") === "true";
  const emailParam = searchParams.get("email");
  
  const [step, setStep] = React.useState<1 | 2>(emailParam ? 2 : 1);
  const [email, setEmail] = React.useState(emailParam || "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);
  const [isVerified, setIsVerified] = React.useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: emailParam || "" },
  });

  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  // Cooldown timer
  React.useEffect(() => {
    if (cooldownRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Auto-send code if email provided in URL
  React.useEffect(() => {
    if (emailParam && step === 2 && !isSubmitting && cooldownRemaining === 0) {
      handleSendCode(emailParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleSendCode = async (emailValue: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/v1/auth/cognito/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error("Failed to send verification code", {
          description: data.error?.message || "Please try again",
        });
        return;
      }

      setEmail(emailValue);
      setStep(2);
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      
      toast.success("Verification code sent", {
        description: data.data.message,
      });
    } catch (error) {
      toast.error("Failed to send verification code", {
        description: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEmailSubmit = async (data: EmailFormValues) => {
    await handleSendCode(data.email);
  };

  const onCodeSubmit = async (data: CodeFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/v1/auth/cognito/confirm-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: data.code }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("Verification failed", {
          description: result.error?.message || "Invalid code",
        });
        return;
      }

      setIsVerified(true);
      
      toast.success("Email verified!", {
        description: "Redirecting to login...",
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        const loginUrl = `${API_URL}/api/auth/login?role=${redirect.toUpperCase()}&signup=${signup}`;
        window.location.href = loginUrl;
      }, 2000);
    } catch (error) {
      toast.error("Verification failed", {
        description: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      codeForm.reset();
      setStep(1);
    } else {
      router.push("/get-started");
    }
  };

  const handleResend = () => {
    if (cooldownRemaining > 0) return;
    handleSendCode(email);
  };

  if (isVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md rounded-2xl shadow-brand">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircleIcon className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Email Verified!</h2>
              <p className="text-[15px] text-muted-foreground">
                Your account is now verified. Redirecting to login...
              </p>
            </div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <Card className="w-full max-w-md rounded-2xl shadow-brand">
        <CardHeader className="space-y-3 pb-6">
          <CardTitle className="text-2xl font-bold">
            {step === 1 ? "Verify Your Email" : "Enter Verification Code"}
          </CardTitle>
          <CardDescription className="text-[15px] leading-7">
            {step === 1
              ? "Enter your email address to receive a verification code."
              : `We sent a 6-digit code to ${email}. Enter it below to verify your account.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {step === 1 ? (
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    className="h-11 rounded-xl pl-10"
                    {...emailForm.register("email")}
                  />
                </div>
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                >
                  {isSubmitting ? "Sending..." : "Send Code"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium">
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  className="h-11 rounded-xl text-center text-lg tracking-widest font-mono"
                  {...codeForm.register("code")}
                />
                {codeForm.formState.errors.code && (
                  <p className="text-sm text-destructive">
                    {codeForm.formState.errors.code.message}
                  </p>
                )}
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isSubmitting || cooldownRemaining > 0}
                  className="text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldownRemaining > 0
                    ? `Resend code in ${cooldownRemaining}s`
                    : "Didn't receive the code? Resend"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl gap-1"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                >
                  {isSubmitting ? "Verifying..." : "Verify Email"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailPageContent />
    </Suspense>
  );
}

