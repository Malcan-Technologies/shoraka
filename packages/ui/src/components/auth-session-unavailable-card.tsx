"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "./button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

export function AuthSessionUnavailableCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md" role="alert">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Unable to verify your session</CardTitle>
          <CardDescription>
            We couldn&apos;t reach CashSouk right now. You have not been signed out. Please try
            again.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
