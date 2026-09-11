"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  IDENTITY_CONFLICT_ADMIN_BODY,
  IDENTITY_CONFLICT_ADMIN_TITLE,
  IDENTITY_CONFLICT_OBSERVED_BODY,
  adminAmlWaitingCopy,
  adminOnboardingStageLabel,
  adminPartyRecordSourceLabel,
  adminPeopleAccessAmlDisplayLabel,
  adminPeopleAccessDetailRoleLine,
  adminPeopleAccessVerificationLabel,
  adminPersonHasCtosEvidence,
  adminPersonHasRegTankEvidence,
  adminPersonKycResultUrl,
  adminPersonKybResultUrl,
  adminProfileCompletenessHint,
  buildAdminPeopleAccessOverviewItems,
  buildAdminPersonRegTankRoleRecords,
  computeIssuerPersonCompleteness,
  isBlockedPersonIdentityConflict,
  isIssuerShareholderOnlyBelowMinimum,
  isPersonKycApproved,
  issuerPersonCompletenessInputFromParty,
  observedPartyBlockedByIdentityConflict,
  peopleAccessAmlBadgeStatus,
  peopleAccessKycBadgeStatus,
  peopleAccessPlatformBadgeStatus,
  personRegTankKycId,
  personRegTankKybId,
  readPersonIdentityConflict,
  type AdminPeopleAccessRow,
  type OrganizationDetailResponse,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import {
  ProfileFieldGrid,
  ProfileReadField,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { accountHref } from "@/lib/admin-directory-hrefs";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { MismatchBlock } from "./organization-external-review-sheet";
import { adminMayInactivateMasterParty } from "@/organizations/utils/organization-profile-overview";

function AccessBadge({ label }: { label: string }) {
  if (label === "—" || label === "Not applicable") {
    return <span className="text-ui text-muted-foreground">{label === "Not applicable" ? label : "No access"}</span>;
  }
  const status = peopleAccessPlatformBadgeStatus(label as never);
  if (!status) return <span className="text-ui text-muted-foreground">{label}</span>;
  return <StatusBadge status={status} label={label} />;
}

function KycBadge({ label }: { label: string }) {
  const status = peopleAccessKycBadgeStatus(label as never);
  if (!status) return <span className="text-ui text-muted-foreground">—</span>;
  return <StatusBadge status={status} label={label} />;
}

function AmlBadge({ label }: { label: string }) {
  const status = peopleAccessAmlBadgeStatus(label as never);
  if (!status) return <span className="text-ui text-muted-foreground">—</span>;
  return <StatusBadge status={status} label={label} />;
}

function ExternalRegTankLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-ui text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
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
  const completenessHint = adminProfileCompletenessHint({
    applyIssuerComrep,
    row,
    missingCount,
    kycApproved,
  });
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
  const showCompleteProfile =
    canManage && !row.observed && !row.inactive && Boolean(onEdit) && kycApproved && missingCount > 0;
  const showEdit =
    canManage && !row.observed && !row.inactive && Boolean(onEdit) && row.kind !== "people_only" && row.kind !== "platform_only";
  const showInactivate = canManage && Boolean(onInactivate) && adminMayInactivateMasterParty(party);
  const showCtos = adminPersonHasCtosEvidence(row);
  const roleRecords = buildAdminPersonRegTankRoleRecords({
    person: person
      ? {
          ...person,
          parentCorporateRequestId: person.parentCorporateRequestId || org.codRequestId || null,
        }
      : person,
    corporateEntities: org.corporateEntities,
  });
  const showRegTank = adminPersonHasRegTankEvidence(person) || roleRecords.length > 0;
  const verificationLabel = adminPeopleAccessVerificationLabel(row.corporate);
  const kycLabel = row.kyc === "—" && row.corporate ? "Not started" : row.kyc;
  const amlLabel = adminPeopleAccessAmlDisplayLabel(row);
  const amlWaiting = adminAmlWaitingCopy({
    corporate: row.corporate,
    person,
    amlLabel: row.aml,
  });
  const kycId = personRegTankKycId(person);
  const kybId = personRegTankKybId(person);
  const kycResultUrl = adminPersonKycResultUrl(person);
  const kybResultUrl = adminPersonKybResultUrl(person);
  const roleLine = adminPeopleAccessDetailRoleLine(row);
  const recordSource = adminPartyRecordSourceLabel(party?.origin);
  const overviewItems = buildAdminPeopleAccessOverviewItems(row);
  const platformLabel = row.corporate ? "Not applicable" : row.platformAccess === "—" ? "No access" : row.platformAccess;
  const profileStatus = overviewItems.find((item) => item.label === "Profile Status")?.value ?? "Active profile";

  const defaultSection =
    showCtos && (row.observed || row.ctos === "Differs" || row.ctos === "Not found" || row.identityConflict)
      ? "ctos"
      : row.kind === "platform_only"
        ? "access"
        : "overview";
  const [section, setSection] = React.useState(defaultSection);
  React.useEffect(() => {
    setSection(defaultSection);
  }, [defaultSection, row.key]);

  const orgMember = row.userId ? org.members.find((member) => member.userId === row.userId) ?? null : null;
  const parentCod = person?.parentCorporateRequestId ?? org.codRequestId ?? null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-card-title break-words">{row.name}</h2>
        {roleLine ? <p className="text-ui text-muted-foreground">{roleLine}</p> : null}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="neutral" label={profileStatus} />
          <AccessBadge label={platformLabel} />
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
        {completenessHint ? <p className="text-meta text-muted-foreground">{completenessHint}</p> : null}
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {row.kind === "platform_only" ? (
            <TabsTrigger value="access">Access</TabsTrigger>
          ) : (
            <>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kyc">{verificationLabel}</TabsTrigger>
              <TabsTrigger value="aml">AML</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              {showCtos ? <TabsTrigger value="ctos">CTOS</TabsTrigger> : null}
              {showRegTank ? <TabsTrigger value="regtank">RegTank</TabsTrigger> : null}
            </>
          )}
        </TabsList>

        {row.kind !== "platform_only" ? (
          <TabsContent value="overview" className="space-y-4 pt-4">
            <p className="text-meta text-muted-foreground">Current profile</p>
            <ProfileFieldGrid>
              {overviewItems.map((item) => (
                <ProfileReadField key={item.label} label={item.label} value={item.value} />
              ))}
            </ProfileFieldGrid>
            {recordSource ? (
              <div className="space-y-1">
                <p className="text-meta text-muted-foreground">Record information</p>
                <ProfileReadField label="Record source" value={recordSource} />
              </div>
            ) : null}
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" ? (
          <TabsContent value="kyc" className="space-y-4 pt-4">
            {row.corporate ? (
              <>
                <p className="text-ui text-muted-foreground">
                  Business verification (KYB). Individual KYC is not required.
                </p>
                <KycBadge label={kycLabel} />
                {person?.onboarding?.status ? (
                  <ProfileReadField label="Current stage" value={adminOnboardingStageLabel(person.onboarding.status)} />
                ) : null}
                {person?.partyCorporateRequestId ? (
                  <ProfileReadField label="Corporate onboarding" value={person.partyCorporateRequestId} />
                ) : null}
                <ProfileReadField
                  label="KYB ID"
                  value={kybId}
                  hint={!kybId ? "Generated after business screening starts." : undefined}
                />
                {kybResultUrl ? <ExternalRegTankLink href={kybResultUrl}>View KYB result</ExternalRegTankLink> : null}
              </>
            ) : (
              <>
                <KycBadge label={row.kyc} />
                <ProfileReadField
                  label="Current stage"
                  value={adminOnboardingStageLabel(person?.onboarding?.status)}
                />
                <ProfileReadField
                  label="KYC ID"
                  value={kycId}
                  hint={!kycId ? "Generated after KYC approval." : undefined}
                />
                {kycResultUrl ? <ExternalRegTankLink href={kycResultUrl}>View KYC result</ExternalRegTankLink> : null}
                {roleRecords.length > 1 ? (
                  <p className="text-meta text-muted-foreground">
                    This person has separate Director and Shareholder onboarding records for the same identity.
                  </p>
                ) : null}
                {applyIssuerComrep && missingCount > 0 && kycApproved ? (
                  <p className="text-meta text-muted-foreground">
                    KYC is approved. {missingCount} profile {missingCount === 1 ? "field remains" : "fields remain"} —
                    use Complete profile.
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
                ? "Business screening for this company shareholder. This is not organisation screening."
                : "Person screening. This is not the organisation screening result."}
            </p>
            <AmlBadge label={amlLabel} />
            {amlWaiting ? <p className="text-ui text-muted-foreground">{amlWaiting}</p> : null}
            {person?.screening?.riskLevel ? (
              <ProfileReadField label="Risk level" value={String(person.screening.riskLevel)} />
            ) : null}
            {person?.screening?.riskScore != null && String(person.screening.riskScore) !== "" ? (
              <ProfileReadField label="Risk score" value={String(person.screening.riskScore)} />
            ) : null}
            {kycId && !row.corporate ? <ProfileReadField label="KYC ID" value={kycId} /> : null}
            {kybId && row.corporate ? <ProfileReadField label="KYB ID" value={kybId} /> : null}
            {kycResultUrl ? <ExternalRegTankLink href={kycResultUrl}>View KYC result</ExternalRegTankLink> : null}
            {kybResultUrl ? <ExternalRegTankLink href={kybResultUrl}>View KYB result</ExternalRegTankLink> : null}
          </TabsContent>
        ) : null}

        <TabsContent value="access" className="space-y-4 pt-4">
          <AccessBadge label={platformLabel} />
          {row.corporate ? (
            <p className="text-ui text-muted-foreground">Corporate shareholders cannot have platform access.</p>
          ) : null}
          {row.userId ? (
            <ProfileReadField label="Account Email" value={row.accountEmail} />
          ) : row.kind !== "platform_only" && !row.corporate ? (
            <ProfileReadField label="Account" value="No platform account" />
          ) : null}
          {row.kind === "platform_only" && orgMember?.phone ? (
            <ProfileReadField label="Phone" value={orgMember.phone} />
          ) : null}
          {row.userId && canViewAccounts ? (
            <div>
              <p className="text-meta text-muted-foreground">Linked user</p>
              <Link href={accountHref(row.userId)} className="text-ui text-primary underline-offset-4 hover:underline">
                Open account
              </Link>
            </div>
          ) : null}
          {row.invitationId ? (
            <ProfileReadField
              label="Invitation"
              value={`${row.platformAccess}${row.invitationExpiresAt ? ` · ${row.invitationExpiresAt}` : ""}`}
            />
          ) : null}
        </TabsContent>

        {row.kind !== "platform_only" && showCtos ? (
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

        {row.kind !== "platform_only" && showRegTank ? (
          <TabsContent value="regtank" className="space-y-4 pt-4">
            <p className="text-meta text-muted-foreground">
              External onboarding evidence. {verificationLabel} status is summarised on the {verificationLabel} tab.
            </p>
            {roleRecords.length > 0 ? (
              <div className="space-y-3">
                {roleRecords.map((record) => (
                  <div key={`${record.kind}-${record.requestId}`} className="space-y-1 rounded-lg border p-3">
                    <p className="text-ui font-medium">{record.title}</p>
                    <ProfileReadField label="Onboarding reference" value={record.requestId} />
                    <ProfileReadField label="Current stage" value={record.stageLabel} />
                    {record.url ? (
                      <ExternalRegTankLink href={record.url}>{record.actionLabel}</ExternalRegTankLink>
                    ) : (
                      <p className="text-meta text-muted-foreground">
                        Open in RegTank is unavailable until the parent company onboarding reference is known.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ui text-muted-foreground">No RegTank onboarding evidence.</p>
            )}
            {!row.corporate && parentCod ? (
              <ProfileReadField label="Parent company onboarding" value={parentCod} />
            ) : null}
            {row.corporate && parentCod && parentCod !== person?.partyCorporateRequestId ? (
              <p className="text-meta text-muted-foreground">
                This company onboards as a shareholder of {parentCod}.
              </p>
            ) : null}
            {person?.onboarding?.updatedAt ? (
              <ProfileReadField label="Last updated" value={person.onboarding.updatedAt} />
            ) : null}
            {person?.icFrontUrl ? (
              <ExternalRegTankLink href={person.icFrontUrl}>View identity document (front)</ExternalRegTankLink>
            ) : null}
            {person?.icBackUrl ? (
              <ExternalRegTankLink href={person.icBackUrl}>View identity document (back)</ExternalRegTankLink>
            ) : null}
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
            Matching {identityConflict?.otherMembershipStatus === "EXTERNAL_OBSERVED" ? "CTOS" : ""} person:{" "}
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
                toast.message(
                  "Closes this review. The person remains a CTOS observation until someone adopts them. This does not save a separate decision."
                )
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
    </div>
  );
}
