"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AuthorizedRepIcField, authorizedRepRowGridReadOnlyClass } from "./authorized-rep-fields";

type IndividualGuarantorRepresentativesCardProps = {
  entityId: string;
  personName: string;
  icNumber: string;
  email: string;
  highlighted?: boolean;
  remark?: string | null;
  embedded?: boolean;
};

export function IndividualGuarantorRepresentativesCard({
  entityId,
  personName,
  icNumber,
  email,
  highlighted = false,
  remark = null,
  embedded = false,
}: IndividualGuarantorRepresentativesCardProps) {
  const nameFieldId = `individual-guarantor-name-${entityId}`;
  const emailFieldId = `individual-guarantor-email-${entityId}`;
  const hasApplicationIdentity =
    Boolean(personName.trim()) && icNumber.replace(/\D/g, "").length === 12;

  return (
    <div
      className={cn(
        "space-y-3",
        embedded ? "rounded-lg p-3" : "rounded-xl bg-background p-3",
        embedded ? "bg-muted/40" : "border border-border"
      )}
    >
      {embedded ? null : (
        <div className="min-w-0">
          <p className="text-card-title text-foreground">Individual guarantors</p>
          <p className="mt-1 text-meta text-muted-foreground">
            This person signs personally. Name, IC number, and email come from the application.
          </p>
        </div>
      )}
      {highlighted ? (
        <p className="text-ui text-foreground">
          {remark?.trim() ? remark : "CashSouk asked to update this person."}{" "}
          Name, IC number, and email come from the application and cannot be changed here.
        </p>
      ) : null}
      {!hasApplicationIdentity ? (
        <p className="text-ui text-destructive">
          This guarantor is missing a name or 12-digit IC number on the application.
        </p>
      ) : (
        <div className={authorizedRepRowGridReadOnlyClass}>
          <div className="min-w-0 space-y-1.5">
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
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={emailFieldId} className="text-meta text-muted-foreground">
              Email
            </Label>
            <Input
              id={emailFieldId}
              type="email"
              value={email}
              readOnly
              disabled
              tabIndex={-1}
              className="rounded-xl bg-muted text-ui select-none"
            />
          </div>
          <AuthorizedRepIcField
            id={`individual-guarantor-ic-${entityId}`}
            value={icNumber.replace(/\D/g, "")}
            readOnly
          />
        </div>
      )}
    </div>
  );
}
