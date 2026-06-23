"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@cashsouk/ui";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { InvestorDepositForm } from "@/components/investor-deposit-form";

interface DepositCardProps {
  organizationId: string;
}

export function DepositCard({ organizationId }: DepositCardProps) {
  const [amount, setAmount] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <BanknotesIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Make Your First Deposit</CardTitle>
            <CardDescription>Complete your first deposit to start investing</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <InvestorDepositForm
          investorOrganizationId={organizationId}
          amount={amount}
          onAmountChange={setAmount}
          validationError={validationError}
          onValidationErrorChange={setValidationError}
          returnTo="/"
        />
      </CardContent>
    </Card>
  );
}
