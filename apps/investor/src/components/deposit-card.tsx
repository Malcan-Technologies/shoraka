"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { BanknotesIcon } from "@heroicons/react/24/outline";

interface DepositCardProps {
  organizationId: string;
}

export function DepositCard({ organizationId }: DepositCardProps) {
  // Placeholder for future deposit functionality
  const handleDeposit = () => {
    // Will be implemented in future
    console.log("Deposit flow for organization:", organizationId);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BanknotesIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Make Your First Deposit</CardTitle>
            <CardDescription>Complete your first deposit to start investing</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground mb-2">
            Fund your account to unlock investment opportunities
          </p>
          <p className="text-sm text-muted-foreground">
            Deposits are processed securely through our banking partners
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleDeposit} disabled className="w-full" variant="outline">
          Make Deposit (Coming Soon)
        </Button>
      </CardFooter>
    </Card>
  );
}
