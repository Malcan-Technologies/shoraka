"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { applicationFlowAmendmentTargetSurfaceClassName } from "@/app/(application-flow)/applications/components/form-control";
import { AuthorizedRepIcField, authorizedRepRowGridReadOnlyClass } from "./authorized-rep-fields";
import type { IndividualGuarantorDraft } from "./guarantor-authorized-parties";

type IndividualGuarantorRepresentativesCardProps = {
  entityId: string;
  personName: string;
  icNumber: string;
  email: string;
  onChange?: (next: IndividualGuarantorDraft) => void;
  readOnly?: boolean;
  highlighted?: boolean;
  remark?: string | null;
  embedded?: boolean;
};

export function IndividualGuarantorRepresentativesCard({
  entityId,
  personName,
  icNumber,
  email,
  onChange,
  readOnly = true,
  highlighted = false,
  remark = null,
  embedded = false,
}: IndividualGuarantorRepresentativesCardProps) {
  const nameFieldId = `individual-guarantor-name-${entityId}`;
  const emailFieldId = `individual-guarantor-email-${entityId}`;
  const locked = readOnly || !onChange;
  const hasApplicationIdentity =
    Boolean(personName.trim()) && icNumber.replace(/\D/g, "").length === 12;
  const showFields = !locked || hasApplicationIdentity;

  const update = (patch: Partial<IndividualGuarantorDraft>) => {
    if (locked) return;
    onChange({
      name: personName,
      email,
      ic_number: icNumber.replace(/\D/g, ""),
      ...patch,
    });
  };

  return (
    <div
      className={cn(
        "space-y-3",
        embedded ? "rounded-lg p-3" : "rounded-xl bg-background p-3",
        highlighted
          ? applicationFlowAmendmentTargetSurfaceClassName
          : embedded
            ? "bg-muted/40"
            : "border border-border"
      )}
    >
      {embedded ? null : (
        <div className="min-w-0">
          <p className="text-card-title text-foreground">Individual guarantors</p>
          <p className="mt-1 text-meta text-muted-foreground">
            This person signs personally. Name, IC number, and email
            {locked ? " come from the application." : " can be updated here."}
          </p>
        </div>
      )}
      {highlighted ? (
        <p className="text-ui text-foreground">
          {remark?.trim() ? remark : "CashSouk asked to update this person."}
        </p>
      ) : null}
      {locked && !hasApplicationIdentity ? (
        <p className="text-ui text-destructive">
          This guarantor is missing a name or 12-digit IC number on the application.
        </p>
      ) : null}
      {showFields ? (
        <div className={authorizedRepRowGridReadOnlyClass}>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={nameFieldId} className="text-meta text-muted-foreground">
              Full name
            </Label>
            <Input
              id={nameFieldId}
              value={personName}
              readOnly={locked}
              disabled={locked}
              tabIndex={locked ? -1 : undefined}
              onChange={locked ? undefined : (event) => update({ name: event.target.value })}
              placeholder={locked ? undefined : "Full name"}
              className={cn("rounded-xl text-ui", locked && "bg-muted select-none")}
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
              readOnly={locked}
              disabled={locked}
              tabIndex={locked ? -1 : undefined}
              onChange={locked ? undefined : (event) => update({ email: event.target.value })}
              placeholder={locked ? undefined : "Email"}
              className={cn("rounded-xl text-ui", locked && "bg-muted select-none")}
            />
          </div>
          <AuthorizedRepIcField
            id={`individual-guarantor-ic-${entityId}`}
            value={icNumber.replace(/\D/g, "")}
            readOnly={locked}
            onChange={locked ? undefined : (value) => update({ ic_number: value })}
          />
        </div>
      ) : null}
    </div>
  );
}
