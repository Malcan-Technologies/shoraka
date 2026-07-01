"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/card";
import { Button } from "../components/button";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

interface IdentityVerifyStepProps {
  title?: string;
  description?: string;
  onContinue: () => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  continueLabel?: string;
}

export function IdentityVerifyStep({
  title = "Onboarding",
  description = "You will be redirected to our secure verification partner to complete onboarding. This usually takes a few minutes.",
  onContinue,
  isLoading = false,
  error = null,
  continueLabel = "Continue to verification",
}: IdentityVerifyStepProps) {
  return (
    <Card className="w-full rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ShieldCheckIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          When you continue, we will open the verification portal. Complete all required steps there,
          then return here — your progress is saved automatically.
        </p>
        <Button
          type="button"
          variant="action"
          className="h-11 w-full rounded-xl"
          disabled={isLoading}
          onClick={() => void onContinue()}
        >
          {isLoading ? "Preparing verification..." : continueLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
