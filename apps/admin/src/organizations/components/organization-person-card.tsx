"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  getFinalStatusLabel,
  getFinalStatusToken,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { MismatchBlock } from "./organization-external-review-sheet";
import {
  formatMasterPartyRoles,
  latestCtosLabel,
  type UnifiedOrgPerson,
} from "@/organizations/utils/organization-profile-overview";

export function OrganizationPersonCard({
  item,
  canManage,
  onView,
  onEdit,
  onKeep,
  onUseExternal,
  onAdopt,
  onInactivate,
  onKeepAbsent,
}: {
  item: UnifiedOrgPerson;
  canManage: boolean;
  onView: () => void;
  onEdit?: () => void;
  onKeep?: (field: string) => void;
  onUseExternal?: (field: string) => void;
  onAdopt?: () => void;
  onInactivate?: () => void;
  onKeepAbsent?: () => void;
}) {
  const party = item.party;
  const person = item.person;
  const name = party?.name || person?.name || party?.partyKey || "Unnamed";
  const roles = party
    ? formatMasterPartyRoles(party)
    : (person?.roles ?? []).map((role) => role.charAt(0) + role.slice(1).toLowerCase()).join(" · ");
  const kyc = person
    ? getFinalStatusLabel(person, { displayMode: "kyc_only" })
    : { label: "—", token: "neutral" as const, tone: "neutral" as const };
  const aml = person
    ? getFinalStatusLabel({ screening: person.screening })
    : { label: "—", token: "neutral" as const, tone: "neutral" as const };
  const highlight =
    item.kind === "external" ||
    Boolean(party?.mismatches.length) ||
    Boolean(party?.absentFromLatestExternal && party.membershipStatus === "MASTER_ACTIVE");

  return (
    <div className={cn("space-y-3 rounded-xl border p-4", highlight && ADMIN_ACTION_SURFACE_CLASS)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-ui font-medium">{name}</p>
          <p className="text-meta text-muted-foreground">{roles}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusBadge status={getFinalStatusToken(kyc.tone)} label={`KYC: ${kyc.label}`} />
            <StatusBadge status={getFinalStatusToken(aml.tone)} label={`AML: ${aml.label}`} />
            {party ? (
              <StatusBadge
                status={
                  party.absentFromLatestExternal || item.kind === "external" ? "action" : "success"
                }
                label={`Latest CTOS: ${latestCtosLabel(party)}`}
              />
            ) : null}
            {item.kind === "inactive" ? <StatusBadge status="neutral" label="Inactive" /> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onView}>
            View
          </Button>
          {canManage && item.kind !== "external" && onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {item.kind === "external" && party ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            New person detected in latest CTOS
          </p>
          {canManage && onAdopt ? (
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" onClick={onAdopt}>
                Add to master
              </Button>
              <Button
                className="h-10"
                variant="outline"
                onClick={() => toast.message("Kept in the review list until you add them to the master record")}
              >
                Review later
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {party?.absentFromLatestExternal && party.membershipStatus === "MASTER_ACTIVE" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Not present in latest CTOS
          </p>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {onKeepAbsent ? (
                <Button className="h-10" variant="outline" onClick={onKeepAbsent}>
                  Keep current
                </Button>
              ) : null}
              {onInactivate ? (
                <Button className="h-10" variant="outline" onClick={onInactivate}>
                  Mark inactive
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {party?.mismatches.map((mismatch) => (
        <MismatchBlock
          key={mismatch.field}
          field={mismatch.field}
          masterValue={mismatch.masterValue}
          externalValue={mismatch.externalValue}
          canManage={canManage}
          onKeep={() => onKeep?.(mismatch.field)}
          onUseExternal={() => onUseExternal?.(mismatch.field)}
        />
      ))}
    </div>
  );
}

export function partyIdentityLine(party: OrganizationPartyProfileDto): string | null {
  const id = party.identityNumber?.trim();
  if (!id) return null;
  if (party.entityType === "CORPORATE" || party.identityPrefix === "ROC") return `SSM ${id}`;
  return `${party.identityPrefix ?? "IC"} ${id}`;
}
