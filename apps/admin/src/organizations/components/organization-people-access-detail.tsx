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
  adminPersonAmlScreeningResultUrl,
  adminPersonHasCtosEvidence,
  adminPersonHasRegTankEvidence,
  adminProfileCompletenessHint,
  buildAdminPeopleAccessOverviewItems,
  buildAdminPersonRegTankRoleRecords,
  getRegtankCorporateOnboardingUrl,
  getRelatedPartyStatusToken,
  countIssuerPersonRequiredFields,
  isBlockedPersonIdentityConflict,
  isIssuerShareholderOnlyBelowMinimum,
  isPersonKycApproved,
  issuerPersonCompletenessInputFromParty,
  issuerPersonCompletenessSummary,
  CUSTOMER_PERSON_LABEL,
  PROFILE_LABEL,
  observedPartyBlockedByIdentityConflict,
  peopleAccessAmlChipPresentation,
  peopleAccessChipOptionsFromRow,
  peopleAccessKycChipPresentation,
  peopleAccessPlatformBadgeStatus,
  partyNeedsCtosAbsenceReview,
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
  return <StatusBadge status={status} label={label} size="sm" />;
}

function KycBadge({ person, entityType }: { person: AdminPeopleAccessRow["person"]; entityType?: string | null }) {
  const presentation = peopleAccessKycChipPresentation(person, { entityType });
  if (!presentation) return <span className="text-ui text-muted-foreground">—</span>;
  return (
    <StatusBadge
      status={getRelatedPartyStatusToken(presentation, "admin")}
      label={presentation.label}
      size="sm"
    />
  );
}

function AmlBadge({ person, entityType }: { person: AdminPeopleAccessRow["person"]; entityType?: string | null }) {
  const presentation = peopleAccessAmlChipPresentation(person, { entityType });
  if (!presentation) return <span className="text-ui text-muted-foreground">—</span>;
  return (
    <StatusBadge
      status={getRelatedPartyStatusToken(presentation, "admin")}
      label={presentation.label}
      size="sm"
    />
  );
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
  onReactivate,
  onKeep,
  onUseExternal,
  onKeepOnboardingIdentity,
  onKeepCtosPerson,
  onKeepAbsent,
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
  onReactivate?: () => void;
  onKeep?: (field: string) => void;
  onUseExternal?: (field: string) => void;
  onKeepOnboardingIdentity?: () => void;
  onKeepCtosPerson?: () => void;
  onKeepAbsent?: () => void;
  onEditMember?: () => void;
}) {
  const party = row.party;
  const person = row.person;
  const completenessInput =
    applyIssuerComrep && party
      ? issuerPersonCompletenessInputFromParty({
          ...party,
          kycOnboardingStatus: person?.onboarding?.status ?? null,
        })
      : null;

  const missingSummary = completenessInput ? issuerPersonCompletenessSummary(completenessInput) : null;
  const missingCount = missingSummary?.missingCount ?? 0;
  const requiredCount = completenessInput ? countIssuerPersonRequiredFields(completenessInput) : 0;
  const filledCount = Math.max(0, requiredCount - missingCount);
  const percent = requiredCount > 0 ? Math.round((filledCount / requiredCount) * 100) : 0;
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
  const showReactivate = canManage && row.inactive && Boolean(onReactivate) && row.kind !== "people_only";
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
  const amlLabel = adminPeopleAccessAmlDisplayLabel(row);
  const amlWaiting = adminAmlWaitingCopy({
    corporate: row.corporate,
    person,
    amlLabel,
  });
  const kycId = personRegTankKycId(person);
  const kybId = personRegTankKybId(person);
  const screeningResultUrl = adminPersonAmlScreeningResultUrl(person);
  const roleLine = adminPeopleAccessDetailRoleLine(row);
  const recordSource = adminPartyRecordSourceLabel(party?.origin);
  const overviewItems = buildAdminPeopleAccessOverviewItems(row);
  const hasRecordSourceInOverview = overviewItems.some((item) => item.label === "Record source");
  const platformLabel = row.corporate ? "Not applicable" : row.platformAccess === "—" ? "No access" : row.platformAccess;
  const profileStatus = overviewItems.find((item) => item.label === "Profile Status")?.value ?? "Active profile";

  const kycPresentation = peopleAccessKycChipPresentation(person, peopleAccessChipOptionsFromRow(row));
  const amlPresentation = peopleAccessAmlChipPresentation(person, peopleAccessChipOptionsFromRow(row));

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
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status="neutral"
            label={profileStatus === "Inactive" ? "Inactive profile" : profileStatus}
            size="sm"
          />
          <AccessBadge label={platformLabel} />
          {kycPresentation ? (
            <div className="flex items-center gap-1.5">
              <span className="text-meta text-muted-foreground">{row.corporate ? "KYB" : "KYC"}</span>
              <StatusBadge
                status={getRelatedPartyStatusToken(kycPresentation, "admin")}
                label={kycPresentation.label}
                size="sm"
              />
            </div>
          ) : null}
          {amlPresentation ? (
            <div className="flex items-center gap-1.5">
              <span className="text-meta text-muted-foreground">AML</span>
              <StatusBadge
                status={getRelatedPartyStatusToken(amlPresentation, "admin")}
                label={amlPresentation.label}
                size="sm"
              />
            </div>
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
          {showReactivate ? (
            <Button type="button" variant="outline" size="sm" onClick={onReactivate}>
              Reactivate
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
            {missingCount > 0 && !row.observed && !row.inactive ? (
              <div className="rounded-xl border bg-card p-5">
                <div className="min-w-0 space-y-1">
                  <p className="text-ui font-semibold">Profile completeness</p>
                  <p className="text-ui text-muted-foreground">
                    {requiredCount > 0 ? `${percent}% complete · ` : ""}
                    {missingCount} {missingCount === 1 ? "item" : "items"} remaining
                  </p>
                </div>
              </div>
            ) : null}

            {(() => {
              const requiredMissingLabels = new Set(missingSummary?.missingItems.map((m) => m.label) ?? []);
              // Completeness uses PROFILE_LABEL.shareholdingPercentage, while the UI surfaces it as "Shareholding".
              if (requiredMissingLabels.has(PROFILE_LABEL.shareholdingPercentage)) {
                requiredMissingLabels.add(CUSTOMER_PERSON_LABEL.shareholding);
              }
              const mergedItems = (() => {
                const byLabel = new Map<string, (typeof overviewItems)[number]>();
                for (const item of overviewItems) byLabel.set(item.label, item);
                for (const label of requiredMissingLabels) {
                  if (byLabel.has(label)) continue;
                  byLabel.set(label, { label, value: "" });
                }
                // Preserve original order for existing fields, then append newly created required-missing fields.
                const originalLabels = new Set(overviewItems.map((i) => i.label));
                const appended = Array.from(requiredMissingLabels).filter((l) => !originalLabels.has(l));
                return [...overviewItems, ...appended.map((l) => ({ label: l, value: "" }))];
              })();

              const groupTitleForLabel = (label: string): string => {
                if (label === "Record source") return "Record information";
                if (label === "Platform Access" || label === "Profile Status") return "Platform";
                if (label === PROFILE_LABEL.personEmail) return "Contact";
                if (label.includes("Address") || label === "Address") return "Address";
                if (
                  label === "Company Roles" ||
                  label.includes("Shareholding") ||
                  label.includes("Designation") ||
                  label.includes("Appointment Date") ||
                  label.includes("Resignation Date")
                ) {
                  return "Company relationship";
                }
                return "Identity";
              };

              const groupOrder = [
                "Identity",
                "Company relationship",
                "Contact",
                "Address",
                "Platform",
                "Record information",
              ] as const;

              const grouped = new Map<string, (typeof mergedItems)[number][]>();
              for (const item of mergedItems) {
                const title = groupTitleForLabel(item.label);
                const list = grouped.get(title) ?? [];
                list.push(item);
                grouped.set(title, list);
              }

              return (
                <div className="space-y-5">
                  {groupOrder.map((title) => {
                    const items = grouped.get(title) ?? [];
                    if (items.length === 0) return null;
                    return (
                      <div key={title} className="space-y-3 rounded-xl border p-4">
                        <p className="text-meta text-muted-foreground">{title}</p>
                        <ProfileFieldGrid>
                          {items.map((item) => {
                            const requiredMissing = requiredMissingLabels.has(item.label);
                            return (
                              <ProfileReadField
                                key={item.label}
                                label={item.label}
                                value={requiredMissing ? "" : item.value}
                                missing={false}
                              />
                            );
                          })}
                        </ProfileFieldGrid>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {recordSource && !hasRecordSourceInOverview ? (
              <div className="space-y-1">
                <p className="text-meta text-muted-foreground">Record information</p>
                <ProfileReadField label="Record source" value={recordSource} />
              </div>
            ) : null}
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" ? (
          <TabsContent value="kyc" className="space-y-4 pt-4">
            <section className="space-y-4">
              <h2 className="text-card-title">{row.corporate ? "KYB Verification" : "KYC Verification"}</h2>

              <div className="space-y-3 rounded-xl border p-4">
                <p className="text-meta text-muted-foreground">Verification details</p>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="space-y-1">
                    <p className="text-meta text-muted-foreground">Status</p>
                    <KycBadge person={person} entityType={peopleAccessChipOptionsFromRow(row).entityType} />
                  </div>
                </div>

                <ProfileFieldGrid>
                  <ProfileReadField
                    label="Current stage"
                    value={adminOnboardingStageLabel(person?.onboarding?.status)}
                  />
                  <ProfileReadField
                    label={row.corporate ? "KYB ID" : "KYC ID"}
                    value={row.corporate ? kybId : kycId}
                    hint={row.corporate ? (!kybId ? "Generated after business screening starts." : undefined) : (!kycId ? "Generated after KYC approval." : undefined)}
                  />
                </ProfileFieldGrid>

                {roleRecords.length > 1 && !row.corporate ? (
                  <p className="text-meta text-muted-foreground">
                    This person has separate Director and Shareholder onboarding records for the same identity.
                  </p>
                ) : null}

                {applyIssuerComrep && missingCount > 0 && kycApproved ? (
                  <p className="text-meta text-muted-foreground">
                    KYC is approved. {missingCount} profile {missingCount === 1 ? "field remains" : "fields remain"} — use Complete profile.
                  </p>
                ) : null}
              </div>

              {roleRecords.length > 0 ? (
                <div className="space-y-3">
                  {roleRecords.map((record) => (
                    <div
                      key={`${record.kind}-${record.requestId}`}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <p className="text-ui font-medium">{record.title}</p>
                      <ProfileReadField label="Onboarding reference" value={record.requestId} />
                      <ProfileReadField label="Current stage" value={record.stageLabel} />
                      {record.url ? (
                        <ExternalRegTankLink href={record.url}>{record.actionLabel}</ExternalRegTankLink>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ui text-muted-foreground">No onboarding evidence found.</p>
              )}
            </section>
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" ? (
          <TabsContent value="aml" className="space-y-4 pt-4">
            <section className="space-y-4">
              <h2 className="text-card-title">AML Screening</h2>

              <div className="space-y-3 rounded-xl border p-4">
                <p className="text-meta text-muted-foreground">Screening details</p>

                <ProfileFieldGrid>
                  <div className="space-y-1">
                    <p className="text-meta text-muted-foreground">Status</p>
                    <AmlBadge person={person} entityType={peopleAccessChipOptionsFromRow(row).entityType} />
                  </div>
                  <ProfileReadField
                    label="Screening"
                    value={row.corporate ? "Company screening" : "Person screening"}
                  />
                </ProfileFieldGrid>

                {amlWaiting ? <p className="text-ui text-muted-foreground">{amlWaiting}</p> : null}

                <p className="text-meta text-muted-foreground">
                  {row.corporate
                    ? "Company screening. This is not the organisation screening result."
                    : "Person screening. This is not the organisation screening result."}
                </p>

                {person?.screening?.id ? (
                  <ProfileReadField label="Screening reference ID" value={String(person.screening.id)} />
                ) : null}

                {person?.screening?.riskLevel ? (
                  <ProfileReadField label="Risk level" value={String(person.screening.riskLevel)} />
                ) : null}
                {person?.screening?.riskScore != null && String(person.screening.riskScore) !== "" ? (
                  <ProfileReadField label="Risk score" value={String(person.screening.riskScore)} />
                ) : null}

                {kycId && !row.corporate ? (
                  <ProfileReadField label="Related KYC ID" value={kycId} />
                ) : null}
                {kybId && row.corporate ? (
                  <ProfileReadField label="Related KYB ID" value={kybId} />
                ) : null}
              </div>

              {screeningResultUrl ? (
                <div className="pt-1">
                  <ExternalRegTankLink href={screeningResultUrl}>View screening result</ExternalRegTankLink>
                </div>
              ) : null}
            </section>
          </TabsContent>
        ) : null}

        <TabsContent value="access" className="space-y-4 pt-4">
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="text-card-title">Platform Access</h2>
            <AccessBadge label={platformLabel} />
            {row.corporate ? (
              <p className="text-ui text-muted-foreground">Corporate shareholders cannot have platform access.</p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <p className="text-meta text-muted-foreground">Account</p>
            {row.userId ? (
              <ProfileFieldGrid>
                <ProfileReadField
                  label="Linked user"
                  value={
                    orgMember
                      ? `${orgMember.firstName} ${orgMember.lastName}`.trim() || row.accountEmail || "—"
                      : row.accountEmail || "—"
                  }
                />
                <ProfileReadField label="Account Email" value={row.accountEmail || "—"} />
                {row.platformAccess === "Owner" || row.platformAccess === "Admin" || row.platformAccess === "User" ? (
                  <ProfileReadField label="Role" value={row.platformAccess} />
                ) : null}
              </ProfileFieldGrid>
            ) : !row.corporate ? (
              <ProfileReadField label="Account" value="No platform account" />
            ) : null}

            {row.kind === "platform_only" && orgMember?.phone ? (
              <ProfileReadField label="Phone" value={orgMember.phone} />
            ) : null}

            {row.userId && canViewAccounts ? (
              <div>
                <p className="text-meta text-muted-foreground">Linked user</p>
                <Link
                  href={accountHref(row.userId)}
                  className="text-ui text-primary underline-offset-4 hover:underline"
                >
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
          </section>
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
              onKeepAbsent={onKeepAbsent}
              onInactivate={showInactivate ? onInactivate : undefined}
            />
          </TabsContent>
        ) : null}

        {row.kind !== "platform_only" && showRegTank ? (
          <TabsContent value="regtank" className="space-y-4 pt-4">
            <div className="space-y-3">
              <p className="text-meta text-muted-foreground">
                External onboarding evidence. {verificationLabel} status is summarised on the {verificationLabel} tab.
              </p>

              {roleRecords.length > 0 ? (
                <section className="space-y-3 rounded-xl border p-4">
                  <p className="text-meta text-muted-foreground">Onboarding evidence</p>
                  <div className="space-y-3">
                    {roleRecords.map((record) => (
                      <div
                        key={`${record.kind}-${record.requestId}`}
                        className="space-y-1 rounded-lg border p-3"
                      >
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
                </section>
              ) : (
                <p className="text-ui text-muted-foreground">No RegTank onboarding evidence.</p>
              )}

              {!row.corporate && parentCod ? (
                <section className="space-y-2 rounded-xl border p-4">
                  <p className="text-meta text-muted-foreground">Parent organisation onboarding</p>
                  <ProfileReadField label="Parent company onboarding" value={parentCod} />
                  {(() => {
                    const url = getRegtankCorporateOnboardingUrl(parentCod);
                    return url ? <ExternalRegTankLink href={url}>View company onboarding</ExternalRegTankLink> : null;
                  })()}
                </section>
              ) : null}

              {row.corporate && parentCod && parentCod !== person?.partyCorporateRequestId ? (
                <section className="rounded-xl border p-4">
                  <p className="text-meta text-muted-foreground">
                    This company onboards as a shareholder of {parentCod}.
                  </p>
                </section>
              ) : null}

              {person?.onboarding?.updatedAt ? (
                <section className="rounded-xl border p-4">
                  <ProfileReadField label="Last updated" value={person.onboarding.updatedAt} />
                </section>
              ) : null}

              {person?.icFrontUrl || person?.icBackUrl ? (
                <section className="space-y-2 rounded-xl border p-4">
                  <p className="text-meta text-muted-foreground">Identity documents</p>
                  {person?.icFrontUrl ? (
                    <ExternalRegTankLink href={person.icFrontUrl}>View identity document (front)</ExternalRegTankLink>
                  ) : null}
                  {person?.icBackUrl ? (
                    <ExternalRegTankLink href={person.icBackUrl}>View identity document (back)</ExternalRegTankLink>
                  ) : null}
                </section>
              ) : null}
            </div>
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
  onKeepAbsent,
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
  onKeepAbsent?: () => void;
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

      {party && partyNeedsCtosAbsenceReview(party) ? (
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
              onClick={onKeepAbsent}
              disabled={!onKeepAbsent}
            >
              Leave as current profile
            </Button>
            <p className="text-meta text-muted-foreground">
              Keep this person on the current profile. You will be asked again if the latest CTOS information
              changes.
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
