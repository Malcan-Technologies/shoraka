"use client";

import {
  formatPartyRoleLine,
  formatPeopleRolesLine,
  getFinalStatusLabel,
  getRelatedPartyStatusToken,
  IDENTITY_CONFLICT_ISSUER_LABEL,
  isBlockedPersonIdentityConflict,
  isPersonKycApproved,
  PERSON_COMPLETE_ONBOARDING_FIRST,
  personIdentityDisplay,
  readPersonIdentityConflict,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
  type PersonPlatformAccess,
} from "@cashsouk/types";
import { PartyCtosIndicator } from "./party-ctos-indicator";
import { StatusBadge } from "./components/status-badge";
import { Button } from "./components/button";
import { cn } from "./lib/utils";

/**
 * OrganizationPartyProfile represents company/regulatory identity.
 * OrganizationMember represents platform access.
 *
 * The link between them is OPTIONAL.
 * A director/shareholder does not need a CashSouk account.
 * Do not infer this link from email alone.
 */
export function PersonIdentityCard({
  name,
  party,
  person,
  identityKey,
  missingCount = 0,
  inactive = false,
  canSendOnboarding = false,
  canManagePlatform = false,
  onView,
  onEdit,
  onInactivate,
  onSendOnboarding,
  onInviteToPlatform,
  onResendInvitation,
  onManageAccess,
}: {
  name: string;
  party?: OrganizationPartyProfileDto | null;
  person: ApplicationPersonRow | null;
  identityKey?: string | null;
  missingCount?: number;
  inactive?: boolean;
  canSendOnboarding?: boolean;
  canManagePlatform?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onInactivate?: () => void;
  onSendOnboarding?: () => void;
  onInviteToPlatform?: () => void;
  onResendInvitation?: () => void;
  onManageAccess?: () => void;
}) {
  const corporate = party?.entityType === "CORPORATE";
  const roleLine = party
    ? formatPartyRoleLine(party)
    : person
      ? formatPeopleRolesLine(person)
      : "Person";
  const kyc = person
    ? getFinalStatusLabel(person, { displayMode: "kyc_only" })
    : { label: "Not Started", tone: "neutral" as const, actor: "none" as const };
  const aml = person
    ? getFinalStatusLabel({ screening: person.screening })
    : { label: "Not Started", tone: "neutral" as const, actor: "none" as const };
  const access: PersonPlatformAccess | null = party?.platformAccess ?? null;
  const showPlatform = Boolean(party) && !corporate;
  const identityConflict = isBlockedPersonIdentityConflict(readPersonIdentityConflict(party?.externalObservation));
  const kycApproved = isPersonKycApproved(person?.onboarding?.status);
  const identity = personIdentityDisplay({
    identityNumber: party?.identityNumber ?? person?.identityNumber,
    partyKey: party?.partyKey,
    matchKey: person?.matchKey,
    kycOnboardingStatus: person?.onboarding?.status,
  });
  const showCompleteProfile = Boolean(onEdit && !inactive && !corporate && kycApproved && missingCount > 0);
  const onboardingNotStarted = !corporate && kyc.label === "Not Started";
  const completenessHint =
    !inactive && !corporate && onboardingNotStarted ? PERSON_COMPLETE_ONBOARDING_FIRST : null;
  const inviteStatus = access?.status;
  const showInvite =
    canManagePlatform &&
    !inactive &&
    !corporate &&
    Boolean(party) &&
    (inviteStatus === "NOT_INVITED" || inviteStatus === "INVITATION_EXPIRED");
  const showRestore =
    canManagePlatform && !inactive && !corporate && inviteStatus === "NO_PLATFORM_ACCESS";
  const showResend =
    canManagePlatform && !inactive && !corporate && inviteStatus === "INVITATION_PENDING";
  const showManage =
    canManagePlatform &&
    !inactive &&
    !corporate &&
    (inviteStatus === "ORGANIZATION_MEMBER" || inviteStatus === "ORGANIZATION_ADMIN");

  return (
    <div
      data-person-key={identityKey ?? undefined}
      className={cn("rounded-xl border p-4", inactive && "bg-muted/30")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="text-ui font-medium">{name}</p>
            {party ? <PartyCtosIndicator party={party} /> : null}
          </div>
          <p className="text-meta text-muted-foreground">{roleLine}</p>
          {!corporate ? (
            <p className="text-meta text-muted-foreground">
              Identity: <span className="text-foreground">{identity.value}</span>
            </p>
          ) : null}
          {missingCount > 0 && !inactive ? (
            <p className="text-meta text-status-action-text">
              {kycApproved
                ? `${missingCount} ${missingCount === 1 ? "field" : "fields"} remaining`
                : `${missingCount} ${missingCount === 1 ? "field" : "fields"} missing`}
            </p>
          ) : null}
          {completenessHint ? (
            <p className="text-meta text-muted-foreground">{completenessHint}</p>
          ) : null}
          {corporate ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge status={getRelatedPartyStatusToken(kyc, "user")} label={`KYB: ${kyc.label}`} />
              <StatusBadge status={getRelatedPartyStatusToken(aml, "user")} label={`AML: ${aml.label}`} />
              {inactive ? <StatusBadge status="neutral" label="Inactive" /> : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge status={getRelatedPartyStatusToken(kyc, "user")} label={`KYC: ${kyc.label}`} />
              <StatusBadge status={getRelatedPartyStatusToken(aml, "user")} label={`AML: ${aml.label}`} />
              {identityConflict ? (
                <StatusBadge status="submitted" label={IDENTITY_CONFLICT_ISSUER_LABEL} />
              ) : null}
              {inactive ? <StatusBadge status="neutral" label="Inactive" /> : null}
            </div>
          )}
          {showPlatform && access ? (
            <p className="text-meta text-muted-foreground">
              Platform access: <span className="text-foreground">{access.label}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onView ? (
            <Button type="button" variant="outline" size="sm" onClick={onView}>
              View details
            </Button>
          ) : null}
          {onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              {showCompleteProfile ? "Complete profile" : "Edit"}
            </Button>
          ) : null}
          {canSendOnboarding && onSendOnboarding ? (
            <Button
              type="button"
              variant={onboardingNotStarted ? "default" : "outline"}
              size="sm"
              onClick={onSendOnboarding}
            >
              Send onboarding
            </Button>
          ) : null}
          {showInvite && onInviteToPlatform ? (
            <Button type="button" variant="outline" size="sm" onClick={onInviteToPlatform}>
              Invite to platform
            </Button>
          ) : null}
          {showRestore && onInviteToPlatform ? (
            <Button type="button" variant="outline" size="sm" onClick={onInviteToPlatform}>
              Restore access
            </Button>
          ) : null}
          {showResend && onResendInvitation ? (
            <Button type="button" variant="outline" size="sm" onClick={onResendInvitation}>
              Resend invitation
            </Button>
          ) : null}
          {showManage && onManageAccess ? (
            <Button type="button" variant="outline" size="sm" onClick={onManageAccess}>
              Manage access
            </Button>
          ) : null}
          {onInactivate ? (
            <Button type="button" variant="outline" size="sm" onClick={onInactivate}>
              Mark inactive
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
