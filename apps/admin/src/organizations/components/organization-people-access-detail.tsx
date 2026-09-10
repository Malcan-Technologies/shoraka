"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  IDENTITY_CONFLICT_ADMIN_BODY,
  IDENTITY_CONFLICT_ADMIN_TITLE,
  IDENTITY_CONFLICT_OBSERVED_BODY,
  PERSON_COMPLETE_ONBOARDING_FIRST,
  computeIssuerPersonCompleteness,
  isBlockedPersonIdentityConflict,
  isIssuerShareholderOnlyBelowMinimum,
  isPersonKycApproved,
  issuerPersonCompletenessInputFromParty,
  observedPartyBlockedByIdentityConflict,
  peopleAccessAmlBadgeStatus,
  peopleAccessKycBadgeStatus,
  peopleAccessPlatformBadgeStatus,
  personIdentityDisplay,
  readPersonIdentityConflict,
  shouldDeferOnboardingPersonComrep,
  type AdminPeopleAccessRow,
  type OrganizationDetailResponse,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import {
  PartyRoleBadges,
  ProfileFieldGrid,
  ProfileReadField,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  buildPartyProfileDetailItems,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { accountHref } from "@/lib/admin-directory-hrefs";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { RegtankRecordsControl } from "@/components/admin/regtank-records-control";
import { MismatchBlock } from "./organization-external-review-sheet";
import { ReadField } from "./organization-profile-helpers";
import { adminMayInactivateMasterParty } from "@/organizations/utils/organization-profile-overview";

function AccessBadge({ label }: { label: AdminPeopleAccessRow["platformAccess"] }) {
  if (label === "—") return <span className="text-ui text-muted-foreground">—</span>;
  const status = peopleAccessPlatformBadgeStatus(label);
  if (!status) return <span className="text-ui text-muted-foreground">{label}</span>;
  return <StatusBadge status={status} label={label} />;
}

function KycBadge({ label }: { label: AdminPeopleAccessRow["kyc"] }) {
  const status = peopleAccessKycBadgeStatus(label);
  if (!status) return <span className="text-ui text-muted-foreground">—</span>;
  return <StatusBadge status={status} label={label} />;
}

function AmlBadge({ label }: { label: AdminPeopleAccessRow["aml"] }) {
  const status = peopleAccessAmlBadgeStatus(label);
  if (!status) return <span className="text-ui text-muted-foreground">—</span>;
  return <StatusBadge status={status} label={label} />;
}

function masterStateLabel(row: AdminPeopleAccessRow): string {
  if (row.observed) return "Observed from CTOS";
  if (row.inactive) return "Inactive";
  if (row.kind === "people_only") return "Not on current profile";
  if (row.kind === "platform_only") return "Platform access only";
  return "Active profile";
}

export function OrganizationPeopleAccessDetail({
  row,
  org,
  canManage,
  canViewAccounts,
  canManageUsers,
  applyIssuerComrep,
  onEdit,
  onAdopt,
  onInactivate,
  onKeep,
  onUseExternal,
  onKeepOnboardingIdentity,
  onKeepCtosPerson,
  onEditMember,
}: {
  row: AdminPeopleAccessRow;
  org: OrganizationDetailResponse;
  canManage: boolean;
  canViewAccounts: boolean;
  canManageUsers: boolean;
  applyIssuerComrep: boolean;
  onEdit?: () => void;
  onAdopt?: () => void;
  onInactivate?: () => void;
  onKeep?: (field: string) => void;
  onUseExternal?: (field: string) => void;
  onKeepOnboardingIdentity?: () => void;
  onKeepCtosPerson?: () => void;
  onEditMember?: () => void;
}) {
  const party = row.party;
  const person = row.person;
  const missingCount =
    applyIssuerComrep && party
      ? computeIssuerPersonCompleteness(
          issuerPersonCompletenessInputFromParty({
            ...party,
            kycOnboardingStatus: person?.onboarding?.status ?? null,
          })
        ).length
      : 0;
  const kycApproved = isPersonKycApproved(person?.onboarding?.status);
  const completenessHint =
    applyIssuerComrep &&
    party &&
    !row.inactive &&
    !row.observed &&
    shouldDeferOnboardingPersonComrep({
      entityType: party.entityType,
      isDirector: party.isDirector,
      isShareholder: party.isShareholder,
      kycOnboardingStatus: person?.onboarding?.status ?? null,
    })
      ? PERSON_COMPLETE_ONBOARDING_FIRST
      : null;
  const belowMinimumShareholder = isIssuerShareholderOnlyBelowMinimum({
    isShareholder: party?.isShareholder ?? false,
    isDirector: party?.isDirector ?? false,
    isBoard: party?.isBoard ?? false,
    isManagement: party?.isManagement ?? false,
    shareholdingPercentage: party?.shareholdingPercentage,
  });
  const identityConflict = readPersonIdentityConflict(party?.externalObservation);
  const blockedIdentityConflict = isBlockedPersonIdentityConflict(identityConflict);
  const observedConflictTarget =
    row.observed &&
    Boolean(
      party &&
        observedPartyBlockedByIdentityConflict({
          observedPartyId: party.id,
          observedPartyKey: party.partyKey,
          parties: org.partyProfiles ?? [],
        })
    );
  const canAdopt =
    canManage &&
    row.observed &&
    Boolean(onAdopt) &&
    !belowMinimumShareholder &&
    !observedConflictTarget;
  const showCompleteProfile = canManage && !row.observed && !row.inactive && Boolean(onEdit) && kycApproved && missingCount > 0;
  const showEdit = canManage && !row.observed && !row.inactive && Boolean(onEdit) && row.kind !== "people_only" && row.kind !== "platform_only";
  const showInactivate = canManage && Boolean(onInactivate) && adminMayInactivateMasterParty(party);
  const defaultSection =
    row.observed || row.ctos === "Differs" || row.ctos === "Not found" || row.identityConflict
      ? "ctos"
      : row.kind === "platform_only"
        ? "access"
        : "overview";
  const [section, setSection] = React.useState(defaultSection);
  React.useEffect(() => {
    setSection(defaultSection);
  }, [defaultSection, row.key]);

  const identity = personIdentityDisplay({
    identityNumber: party?.identityNumber ?? person?.identityNumber,
    partyKey: party?.partyKey,
    matchKey: person?.matchKey,
    kycOnboardingStatus: person?.onboarding?.status,
  });

  const orgMember = row.userId ? org.members.find((member) => member.userId === row.userId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-card-title break-words">{row.name}</h2>
        <p className="text-ui text-muted-foreground">{row.companyRoleLine}</p>
        <div className="flex flex-wrap gap-2">
          <AccessBadge label={row.platformAccess} />
          <StatusBadge status="neutral" label={masterStateLabel(row)} />
          {row.ctos !== "—" ? (
            <StatusBadge
              status={row.ctos === "Matched" ? "success" : "action"}
              label={row.ctos}
            />
          ) : null}
        </div>
        {row.inactive ? (
          <p className={cn("rounded-lg border p-3 text-ui", ADMIN_ACTION_SURFACE_CLASS)}>
            Inactive on the current company profile. This is not the same as removing platform access.
          </p>
        ) : null}
        {row.kind === "people_only" ? (
          <p className={cn("rounded-lg border p-3 text-ui", ADMIN_ACTION_SURFACE_CLASS)}>
            Not linked to the current master company profile.
          </p>
        ) : null}
        {row.platformAccess === "Owner" ? (
          <p className="text-meta text-muted-foreground">
            Platform Owner of this organisation. This is not a director or shareholder role.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {showEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              {showCompleteProfile ? "Complete profile" : "Edit"}
            </Button>
          ) : null}
          {showCompleteProfile && !showEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Complete profile
            </Button>
          ) : null}
          {canAdopt ? (
            <Button type="button" size="sm" onClick={onAdopt}>
              Adopt
            </Button>
          ) : null}
          {showInactivate ? (
            <Button type="button" variant="outline" size="sm" onClick={onInactivate}>
              Mark inactive
            </Button>
          ) : null}
          {row.kind === "platform_only" && canManageUsers && orgMember && onEditMember ? (
            <Button type="button" variant="outline" size="sm" onClick={onEditMember}>
              Edit
            </Button>
          ) : null}
        </div>
        {applyIssuerComrep && missingCount > 0 && !row.inactive && !row.observed ? (
          <p className="text-meta text-status-action-text">
            {kycApproved
              ? `${missingCount} ${missingCount === 1 ? "field" : "fields"} remaining`
              : `${missingCount} ${missingCount === 1 ? "field" : "fields"} missing`}
          </p>
        ) : null}
        {completenessHint ? <p className="text-meta text-muted-foreground">{completenessHint}</p> : null}
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {row.kind === "platform_only" ? (
            <TabsTrigger value="access">Access</TabsTrigger>
          ) : (
            <>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kyc">KYC</TabsTrigger>
              <TabsTrigger value="aml">AML</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="ctos">CTOS</TabsTrigger>
              <TabsTrigger value="regtank">RegTank</TabsTrigger>
            </>
          )}
        </TabsList>

        {row.kind !== "platform_only" ? (
          <TabsContent value="overview" className="space-y-4 pt-4">
            {!row.corporate ? (
              <p className="text-meta text-muted-foreground">
                Identity: <span className="text-foreground">{identity.value}</span>
              </p>
            ) : (
              <p className="text-meta text-muted-foreground">
                Company shareholder. Individual KYC is not required. Platform access does not apply.
              </p>
            )}
            <PartyRoleBadges party={party} person={person} />
            <ProfileFieldGrid>
              {buildPartyProfileDetailItems({ party, person }).map((item) => (
                <ProfileReadField key={item.label} label={item.label} value={item.value} help={item.help} />
              ))}
            </ProfileFieldGrid>
            {party?.origin ? <ReadField label="Origin" value={party.origin} /> : null}
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" ? (
          <TabsContent value="kyc" className="space-y-4 pt-4">
            {row.corporate ? (
              <>
                <p className="text-ui text-muted-foreground">
                  Individual KYC is not required. This tab shows business onboarding (KYB) when a
                  corporate request exists.
                </p>
                <div className="flex flex-wrap gap-2">
                  <KycBadge label={row.kyc} />
                </div>
                <ReadField label="Onboarding stage" value={person?.onboarding?.status} />
                <ReadField label="Party COD" value={person?.partyCorporateRequestId} />
                <ReadField label="Onboarding ID" value={person?.onboarding?.id} />
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <KycBadge label={row.kyc} />
                </div>
                <ReadField label="Onboarding stage" value={person?.onboarding?.status} />
                <ReadField label="Onboarding ID" value={person?.onboarding?.id} />
                <ReadField label="Director EOD" value={person?.directorEodRequestId} />
                <ReadField label="Shareholder EOD" value={person?.shareholderEodRequestId} />
                <ReadField
                  label="KYC ID"
                  value={
                    person?.screeningRequestId ||
                    (person?.onboarding?.id?.startsWith("KYC") || person?.onboarding?.id?.startsWith("KYB")
                      ? person.onboarding.id
                      : null)
                  }
                />
                {person?.onboarding?.verifyLink ? (
                  <div>
                    <p className="text-meta text-muted-foreground">Verify link</p>
                    <a
                      href={person.onboarding.verifyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-ui text-primary underline-offset-4 hover:underline"
                    >
                      Open verify link
                    </a>
                  </div>
                ) : null}
                <ReadField label="Person Email" value={row.personEmail} />
                {applyIssuerComrep && missingCount > 0 && kycApproved ? (
                  <p className="text-meta text-muted-foreground">
                    KYC is approved. {missingCount} profile {missingCount === 1 ? "field remains" : "fields remain"} — use
                    Complete profile.
                  </p>
                ) : null}
              </>
            )}
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" ? (
          <TabsContent value="aml" className="space-y-4 pt-4">
            <p className="text-meta text-muted-foreground">
              {row.corporate
                ? "Business / KYB screening for this company shareholder. This is not organisation screening."
                : "Person screening. This is not the organisation screening result."}
            </p>
            <AmlBadge label={row.aml} />
            <ReadField label="Screening status" value={person?.screening?.status} />
            <ReadField label="Screening ID" value={person?.screening?.id ?? person?.screeningRequestId} />
            {person?.screening?.riskLevel ? (
              <ReadField label="Risk level" value={String(person.screening.riskLevel)} />
            ) : null}
            {person?.screening?.riskScore != null && String(person.screening.riskScore) !== "" ? (
              <ReadField label="Risk score" value={String(person.screening.riskScore)} />
            ) : null}
          </TabsContent>
        ) : null}

        <TabsContent value="access" className="space-y-4 pt-4">
          <AccessBadge label={row.platformAccess} />
          {row.corporate ? (
            <p className="text-ui text-muted-foreground">Corporate shareholders cannot have platform access.</p>
          ) : null}
          <ReadField label="Account Email" value={row.accountEmail} />
          {row.kind !== "platform_only" ? <ReadField label="Person Email" value={row.personEmail} /> : null}
          {row.kind === "platform_only" ? <ReadField label="Phone" value={orgMember?.phone} /> : null}
          {row.userId && canViewAccounts ? (
            <div>
              <p className="text-meta text-muted-foreground">Linked user</p>
              <Link href={accountHref(row.userId)} className="text-ui text-primary underline-offset-4 hover:underline">
                Open account
              </Link>
            </div>
          ) : (
            <ReadField label="Linked user" value={row.userId} />
          )}
          {orgMember ? (
            <details className="text-meta text-muted-foreground">
              <summary className="cursor-pointer text-ui">System role</summary>
              <p className="mt-2 font-mono">{orgMember.role}</p>
            </details>
          ) : null}
          {row.invitationId ? (
            <ReadField
              label="Invitation"
              value={`${row.platformAccess}${row.invitationExpiresAt ? ` · ${row.invitationExpiresAt}` : ""}`}
            />
          ) : null}
        </TabsContent>

        {row.kind !== "platform_only" ? (
          <TabsContent value="ctos" className="space-y-4 pt-4">
            <CtosEvidence
              row={row}
              party={party}
              canManage={canManage}
              canAdopt={canAdopt}
              belowMinimumShareholder={belowMinimumShareholder}
              observedConflictTarget={observedConflictTarget}
              blockedIdentityConflict={blockedIdentityConflict}
              identityConflict={identityConflict}
              onAdopt={onAdopt}
              onKeep={onKeep}
              onUseExternal={onUseExternal}
              onKeepOnboardingIdentity={onKeepOnboardingIdentity}
              onKeepCtosPerson={onKeepCtosPerson}
              onInactivate={showInactivate ? onInactivate : undefined}
            />
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" ? (
          <TabsContent value="regtank" className="space-y-4 pt-4">
            {person ? (
              <RegtankRecordsControl person={person} />
            ) : (
              <p className="text-ui text-muted-foreground">No RegTank records on this row.</p>
            )}
            <ReadField label="Parent COD" value={person?.parentCorporateRequestId} />
            <ReadField label="Party COD" value={person?.partyCorporateRequestId} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function CtosEvidence({
  row,
  party,
  canManage,
  canAdopt,
  belowMinimumShareholder,
  observedConflictTarget,
  blockedIdentityConflict,
  identityConflict,
  onAdopt,
  onKeep,
  onUseExternal,
  onKeepOnboardingIdentity,
  onKeepCtosPerson,
  onInactivate,
}: {
  row: AdminPeopleAccessRow;
  party: OrganizationPartyProfileDto | null;
  canManage: boolean;
  canAdopt: boolean;
  belowMinimumShareholder: boolean;
  observedConflictTarget: boolean;
  blockedIdentityConflict: boolean;
  identityConflict: ReturnType<typeof readPersonIdentityConflict>;
  onAdopt?: () => void;
  onKeep?: (field: string) => void;
  onUseExternal?: (field: string) => void;
  onKeepOnboardingIdentity?: () => void;
  onKeepCtosPerson?: () => void;
  onInactivate?: () => void;
}) {
  if (row.kind === "people_only") {
    return <p className="text-ui text-muted-foreground">No CTOS comparison is available for this unmatched row.</p>;
  }

  return (
    <div className="space-y-4">
      {blockedIdentityConflict && party ? (
        <div className={cn("space-y-2 rounded-lg border p-3", ADMIN_ACTION_SURFACE_CLASS)}>
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            {IDENTITY_CONFLICT_ADMIN_TITLE}
          </p>
          <p className="text-ui text-status-action-text">{IDENTITY_CONFLICT_ADMIN_BODY}</p>
          <p className="text-meta text-muted-foreground">
            Matching {identityConflict?.otherMembershipStatus === "EXTERNAL_OBSERVED" ? "CTOS" : ""} Person key:{" "}
            {identityConflict?.otherPartyKey || identityConflict?.otherPartyId}
          </p>
          {canManage && identityConflict?.otherMembershipStatus === "EXTERNAL_OBSERVED" ? (
            <div className="flex flex-wrap gap-2">
              {onKeepOnboardingIdentity ? (
                <Button className="h-10" onClick={onKeepOnboardingIdentity}>
                  Keep onboarding Person
                </Button>
              ) : null}
              {onKeepCtosPerson ? (
                <Button className="h-10" variant="outline" onClick={onKeepCtosPerson}>
                  Keep CTOS Person
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {row.observed && party ? (
        <div className={cn("space-y-2 rounded-lg border p-3", ADMIN_ACTION_SURFACE_CLASS)}>
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            New person found in the latest CTOS information.
          </p>
          {observedConflictTarget ? (
            <p className="text-ui text-status-action-text">{IDENTITY_CONFLICT_OBSERVED_BODY}</p>
          ) : null}
          {belowMinimumShareholder ? (
            <p className="text-ui text-muted-foreground">
              Shareholding Percentage must be at least 5%. This person is kept as CTOS information only.
            </p>
          ) : null}
          {canAdopt ? (
            <Button className="h-10" onClick={onAdopt}>
              Adopt
            </Button>
          ) : null}
          <div className="space-y-1">
            <Button
              type="button"
              className="h-10"
              variant="outline"
              onClick={() =>
                toast.message("Closes this review. The person remains a CTOS observation until someone adopts them. This does not save a separate decision.")
              }
            >
              Leave as CTOS observation
            </Button>
            <p className="text-meta text-muted-foreground">
              Closes this review. The person remains a CTOS observation until someone adopts them. This does not save a
              separate decision.
            </p>
          </div>
        </div>
      ) : null}

      {party?.absentFromLatestExternal && party.membershipStatus === "MASTER_ACTIVE" ? (
        <div className={cn("space-y-2 rounded-lg border p-3", ADMIN_ACTION_SURFACE_CLASS)}>
          <p className="flex items-center gap-1.5 text-ui text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" />
            This person was not found in the latest CTOS information.
          </p>
          <div className="space-y-1">
            <Button
              type="button"
              className="h-10"
              variant="outline"
              onClick={() =>
                toast.message("This does not mark the CTOS absence as reviewed. The person remains on the current profile.")
              }
            >
              Leave as current profile
            </Button>
            <p className="text-meta text-muted-foreground">
              This does not mark the CTOS absence as reviewed. The person remains on the current profile.
            </p>
          </div>
          {onInactivate ? (
            <Button type="button" variant="outline" className="h-10" onClick={onInactivate}>
              Mark inactive
            </Button>
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

      {row.ctos === "Matched" ? (
        <p className="text-ui text-muted-foreground">This person matches the latest CTOS information.</p>
      ) : null}

      {party?.externalObservation && typeof party.externalObservation === "object" ? (
        <details className="text-meta text-muted-foreground">
          <summary className="cursor-pointer text-ui">Latest CTOS snapshot</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted/50 p-3 text-meta">
            {JSON.stringify(party.externalObservation, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
