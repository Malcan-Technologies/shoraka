"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type IndividualGuarantorRepresentativesCardProps = {
  entityId: string;
  personName: string;
  icNumber: string;
  email: string;
  onEmailChange: (email: string) => void;
  readOnly?: boolean;
};

export function IndividualGuarantorRepresentativesCard({
  entityId,
  personName,
  icNumber,
  email,
  onEmailChange,
  readOnly = false,
}: IndividualGuarantorRepresentativesCardProps) {
  const nameFieldId = `individual-guarantor-name-${entityId}`;
  const icFieldId = `individual-guarantor-ic-${entityId}`;
  const emailFieldId = `individual-guarantor-email-${entityId}`;
  const displayName = personName.trim() || "Individual guarantor";

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="min-w-0">
        <p className="text-card-title text-foreground">{displayName}</p>
        <p className="mt-1 text-meta text-muted-foreground">
          This person signs personally. Name and MyKad number come from the application; you can
          update the email used for the signing link.
        </p>
      </div>
      {!personName.trim() || icNumber.replace(/\D/g, "").length !== 12 ? (
        <p className="text-ui text-destructive">
          This guarantor is missing a name or 12-digit MyKad number on the application.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={nameFieldId} className="text-meta text-muted-foreground">
              Full name
            </Label>
            <Input
              id={nameFieldId}
              value={personName}
              readOnly
              disabled
              tabIndex={-1}
              className="rounded-xl bg-muted text-ui select-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={icFieldId} className="text-meta text-muted-foreground">
              MyKad number
            </Label>
            <Input
              id={icFieldId}
              value={icNumber}
              readOnly
              disabled
              tabIndex={-1}
              className="rounded-xl bg-muted text-ui select-none"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={emailFieldId} className="text-meta text-muted-foreground">
              Email
            </Label>
            <Input
              id={emailFieldId}
              type="email"
              value={email}
              disabled={readOnly}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="Email"
              className="rounded-xl text-ui"
            />
          </div>
        </div>
      )}
    </div>
  );
}
