"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  getFinalStatusLabel,
  getFinalStatusToken,
  isIssuerShareholderOnlyBelowMinimum,
  computeIssuerPersonCompleteness,
  issuerPersonCompletenessInputFromParty,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { PartyRoleBadges, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { RegtankRecordsControl } from "@/components/admin/regtank-records-control";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { MismatchBlock } from "./organization-external-review-sheet";
import { latestCtosLabel, type UnifiedOrgPerson, adminMayInactivateMasterParty } from "@/organizations/utils/organization-profile-overview";

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
  enforceIssuerShareholderMinimum = true,
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
  enforceIssuerShareholderMinimum?: boolean;
}) {
  const party = item.party;
  const person = item.person;
  const name = party?.name || person?.name || party?.partyKey || "Unnamed";
  const corporate = party?.entityType === "CORPORATE";
  const missingCount = party
    ? computeIssuerPersonCompleteness(issuerPersonCompletenessInputFromParty(party)).length
    : 0;
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
  const belowMinimumShareholder =
    enforceIssuerShareholderMinimum &&
    party &&
    isIssuerShareholderOnlyBelowMinimum({
      isShareholder: party.isShareholder,
      isDirector: party.isDirector,
      isBoard: party.isBoard,
      isManagement: party.isManagement,
      shareholdingPercentage: party.shareholdingPercentage,
    });

  return (
    <div className={cn("space-y-3 rounded-xl border p-4", highlight && ADMIN_ACTION_SURFACE_CLASS)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-ui font-medium">{name}</p>
          <PartyRoleBadges party={party} person={person} />
          {missingCount > 0 && item.kind !== "inactive" ? (
            <p className="text-meta text-status-action-text">
              {missingCount} {missingCount === 1 ? "field" : "fields"} missing
            </p>
          ) : null}
          {corporate ? (
            <p className="text-meta text-muted-foreground">
              Company shareholder. Individual KYC/AML is not required.
            </p>
          ) : (
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
          )}
          {corporate && party ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusBadge
                status={
                  party.absentFromLatestExternal || item.kind === "external" ? "action" : "success"
                }
                label={`Latest CTOS: ${latestCtosLabel(party)}`}
              />
              {item.kind === "inactive" ? <StatusBadge status="neutral" label="Inactive" /> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {person ? <RegtankRecordsControl person={person} /> : null}
          <Button type="button" variant="outline" size="sm" onClick={onView}>
            View details
          </Button>
          {canManage && item.kind !== "external" && item.kind !== "inactive" && onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canManage && onInactivate && adminMayInactivateMasterParty(party) ? (
            // Intentionally allow Admin to mark any MASTER_ACTIVE party inactive.
            // Previous behavior limited this action to CTOS-absent parties.
            // Reapply the CTOS-absence check here if that business rule is restored.
            <Button type="button" variant="outline" size="sm" onClick={onInactivate}>
              Mark inactive
            </Button>
          ) : null}
        </div>
      </div>

      {item.kind === "external" && party ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            New person found in the latest CTOS information.
          </p>
          {canManage && onAdopt && !belowMinimumShareholder ? (
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" onClick={onAdopt}>
                Adopt
              </Button>
              <Button
                className="h-10"
                variant="outline"
                onClick={() => toast.message("Kept as CTOS information only until you choose to update the profile")}
              >
                Keep as CTOS only
              </Button>
            </div>
          ) : null}
          {belowMinimumShareholder ? (
            <p className="text-ui text-muted-foreground">
              Shareholding Percentage must be at least 5%. This person is kept as CTOS information
              only.
            </p>
          ) : null}
        </div>
      ) : null}

      {party?.absentFromLatestExternal && party.membershipStatus === "MASTER_ACTIVE" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            This person was not found in the latest CTOS information.
          </p>
          {canManage && onKeepAbsent ? (
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" variant="outline" onClick={onKeepAbsent}>
                Keep current
              </Button>
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
