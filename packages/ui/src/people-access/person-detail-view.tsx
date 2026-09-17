"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken, PARTY_STATUS_REFRESHED_MESSAGE, PARTY_STATUS_REFRESH_FAILED_MESSAGE, PROVIDER_REFRESH_RECENTLY_MESSAGE } from "@cashsouk/config";
import {
  buildPeopleAccessRows,
  canManageDirectorShareholder,
  customerAccountEmail,
  customerAmlWaitingCopy,
  customerApprovedAt,
  customerHeaderFacts,
  customerKycCurrentStage,
  customerKycId,
  customerKybId,
  customerPersonEmail,
  customerProcessStatusLabel,
  getKycGroup,
  getRelatedPartyStatusToken,
  countIssuerPersonRequiredFields,
  isPersonEmailLifecycleLocked,
  matchPersonToParty,
  peopleAccessAmlChipPresentation,
  peopleAccessChipOptionsFromRow,
  peopleAccessKycChipPresentation,
  peopleAccessPlatformLabel,
  peopleAccessPlatformBadgeStatus,
  issuerPersonCompletenessInputFromParty,
  issuerPersonCompletenessSummary,
  PERSON_EMAIL_HELP,
  profileValidationErrorFromApi,
  shouldShowPartyAmlRefresh,
  shouldShowPartyKycRefresh,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
  type PeopleAccessInvitation,
  type PeopleAccessMember,
} from "@cashsouk/types";
import { CustomerPartyProfileOverview } from "./customer-person-overview";
import { PartyFillEmptyForm } from "../portal-person-forms";
import { InviteUserDialog, inviteableCompanyPeople } from "./invite-user-dialog";
import { PartyStatusRefreshControl } from "./party-status-refresh-control";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { StatusBadge } from "../components/status-badge";
import { ConfirmDialog } from "../components/confirm-dialog";
import { DetailHeader } from "../components/detail-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { ProfileReadField, ProfileFieldGrid } from "../components/profile-read-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import type { PortalPeoplePortal } from "../portal-people-section";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type PersonDetailSection = "overview" | "kyc" | "aml" | "access";
export type PersonDetailOverviewSectionId = "details" | "role" | "contact" | "address";

export function PersonDetailView({
  portal,
  organizationId,
  partyId,
  organizationOnboardingStatus,
  people,
  members,
  invitations,
  ownerUserId,
  currentUserId,
  canEdit,
  canManagePlatformAccess,
  canInactivate = false,
  canReactivate = canEdit,
  onBack,
  onChanged,
}: {
  portal: PortalPeoplePortal;
  organizationId: string;
  partyId: string;
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  members: PeopleAccessMember[];
  invitations: PeopleAccessInvitation[];
  ownerUserId?: string | null;
  currentUserId?: string | null;
  canEdit: boolean;
  canManagePlatformAccess: boolean;
  canInactivate?: boolean;
  canReactivate?: boolean;
  onBack: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const [section, setSection] = React.useState<PersonDetailSection>("overview");
  const [parties, setParties] = React.useState<OrganizationPartyProfileDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingSection, setEditingSection] = React.useState<PersonDetailOverviewSectionId | null>(null);
  const [emailDraft, setEmailDraft] = React.useState("");
  const [sendPending, setSendPending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshInFlight = React.useRef(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"remove" | "inactivate" | "reactivate" | "cancel-invite" | "transfer" | null>(null);
  const profileVariant = true;

  const loadParties = React.useCallback(async () => {
    const res = await api.getPartyProfiles(portal, organizationId);
    if (!res.success) throw profileValidationErrorFromApi(res.error);
    setParties(res.data);
  }, [api, organizationId, portal]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadParties()
      .catch((err: Error) => {
        if (!cancelled) toast.error(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadParties]);

  const party = parties.find((row) => row.id === partyId) ?? null;
  const joinedPerson = party ? people.find((row) => Boolean(matchPersonToParty(row, [party]))) ?? null : null;
  const { active } = buildPeopleAccessRows({
    parties,
    people,
    members,
    invitations,
    ownerUserId: ownerUserId ?? null,
  });
  const inactive = party?.membershipStatus === "MASTER_INACTIVE";
  const corporate = party?.entityType === "CORPORATE";
  const orgBase = `/v1/organizations/${portal}/${organizationId}`;
  const blockOnboarding = organizationOnboardingStatus !== "COMPLETED";
  const kycGroup = joinedPerson ? getKycGroup(joinedPerson.onboarding?.status ?? "") : "NOT_STARTED";
  const inProgressKyc = kycGroup === "IN_PROGRESS";
  const verificationId = corporate ? customerKybId(joinedPerson) : customerKycId(joinedPerson);
  const showCreateKyc =
    canEdit &&
    !blockOnboarding &&
    !corporate &&
    joinedPerson &&
    canManageDirectorShareholder(joinedPerson) &&
    !inProgressKyc;
  const emailLocked = isPersonEmailLifecycleLocked({
    onboardingStatus: joinedPerson?.onboarding?.status,
    screeningStatus: joinedPerson?.screening?.status,
  });
  const personEmail = customerPersonEmail({ party, person: joinedPerson });
  const accountEmail = customerAccountEmail(party);
  const linkedMember =
    party?.userId ? members.find((m) => m.id === party.userId) ?? null : null;
  const showKycRefresh =
    canEdit &&
    !inactive &&
    shouldShowPartyKycRefresh({
      person: joinedPerson,
      origin: party?.origin,
      partyKey: party?.partyKey,
      kind: "company_person",
    });
  const showAmlRefresh =
    canEdit &&
    !inactive &&
    shouldShowPartyAmlRefresh({
      person: joinedPerson,
      origin: party?.origin,
      partyKey: party?.partyKey,
      kind: "company_person",
    });
  const invitePeople = inviteableCompanyPeople(active);
  const isOwnerViewer = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);
  const accessLabel = party
    ? peopleAccessPlatformLabel({
        ownerUserId,
        userId: party.userId,
        status: party.platformAccess.status,
      })
    : "No access";
  const accessBadgeStatus = peopleAccessPlatformBadgeStatus(accessLabel);
  const chipOptions = peopleAccessChipOptionsFromRow({ party, person: joinedPerson });
  const kycChip = peopleAccessKycChipPresentation(joinedPerson, chipOptions);
  const amlChip = peopleAccessAmlChipPresentation(joinedPerson, chipOptions);
  const kycStatus =
    kycChip?.label ??
    customerProcessStatusLabel({
      kind: corporate ? "kyb" : "kyc",
      person: joinedPerson,
    });
  const amlStatus = amlChip?.label ?? customerProcessStatusLabel({ kind: "aml", person: joinedPerson });
  const kycStage = customerKycCurrentStage({ person: joinedPerson, statusLabel: kycStatus });
  const approvedAt = customerApprovedAt(joinedPerson);
  const amlWaiting = customerAmlWaitingCopy({
    corporate: Boolean(corporate),
    person: joinedPerson,
    amlLabel: amlStatus,
  });
  const showAccessTab = !corporate;

  const profileCompletenessMissingSummary = React.useMemo(() => {
    if (!party || inactive) return null;
    const input = issuerPersonCompletenessInputFromParty({
      ...party,
      kycOnboardingStatus: joinedPerson?.onboarding?.status ?? null,
    });
    const missing = issuerPersonCompletenessSummary(input);
    const requiredCount = countIssuerPersonRequiredFields(input);
    const filledCount = Math.max(0, requiredCount - missing.missingCount);
    const percent = requiredCount > 0 ? Math.round((filledCount / requiredCount) * 100) : 0;
    return { ...missing, requiredCount, filledCount, percent };
  }, [inactive, joinedPerson?.onboarding?.status, party]);

  React.useEffect(() => {
    setEmailDraft(personEmail);
  }, [personEmail]);

  React.useEffect(() => {
    if (!showAccessTab && section === "access") setSection("overview");
  }, [section, showAccessTab]);

  const invalidate = async () => {
    await loadParties();
    await onChanged?.();
  };

  const toastPartyRefreshFailure = (code?: string) => {
    if (code === "REGTANK_RATE_LIMITED" || code === "RATE_LIMITED" || code === "REFRESH_IN_PROGRESS") {
      toast.error(PROVIDER_REFRESH_RECENTLY_MESSAGE);
      return;
    }
    toast.error(PARTY_STATUS_REFRESH_FAILED_MESSAGE);
  };

  const refreshPartyStatus = async () => {
    if (!party?.id || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      const res = await api.refreshPartyRegTankStatus(portal, organizationId, party.id);
      if (!res.success) {
        toastPartyRefreshFailure(res.error.code);
        return;
      }
      toast.success(PARTY_STATUS_REFRESHED_MESSAGE);
      await invalidate();
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  };

  const savePersonEmail = async (email: string) => {
    if (!party) return;
    const saveRes = await api.patch(`${orgBase}/ctos-party-email`, {
      partyKey: party.partyKey,
      email,
    });
    if (!saveRes.success) {
      throw new Error(saveRes.error.message);
    }
  };

  if (loading) {
    return <p className="text-ui text-muted-foreground">Loading…</p>;
  }
  if (!party) {
    return (
      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          size={profileVariant ? "sm" : undefined}
          className={profileVariant ? "gap-2 px-0 rounded-none" : "gap-2 px-0"}
          onClick={onBack}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          People & Access
        </Button>
        <p className="text-ui text-muted-foreground">This person was not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        size={profileVariant ? "sm" : undefined}
        className={profileVariant ? "gap-2 px-0 rounded-none" : "gap-2 px-0"}
        onClick={onBack}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        People & Access
      </Button>
      <DetailHeader
        title={party.name || "Person"}
        status={
          <div className="flex flex-wrap items-center gap-2">
            {inactive ? (
              <StatusBadge status="neutral" label="Inactive" size={profileVariant ? "sm" : undefined} />
            ) : null}
            {kycChip ? (
              <StatusBadge
                status={getRelatedPartyStatusToken(kycChip, "user")}
                label={`${corporate ? "KYB" : "KYC"} ${kycStatus}`}
                size={profileVariant ? "sm" : undefined}
              />
            ) : null}
            {amlChip ? (
              <StatusBadge
                status={getRelatedPartyStatusToken(amlChip, "user")}
                label={`AML ${amlStatus}`}
                size={profileVariant ? "sm" : undefined}
              />
            ) : null}
          </div>
        }
        facts={customerHeaderFacts({ party, person: joinedPerson })}
        className={profileVariant ? "pb-4" : undefined}
        actions={
          canInactivate && !inactive ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                  <EllipsisHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setConfirm("inactivate")}>Mark inactive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : canReactivate && inactive ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirm("reactivate")}>
              Reactivate
            </Button>
          ) : null
        }
      />

      <Tabs
        value={section}
        onValueChange={(value) => {
          setSection(value as PersonDetailSection);
            if (value !== "overview") setEditingSection(null);
        }}
      >
        <TabsList
          className={
            profileVariant
              ? `grid h-12 w-full rounded-xl bg-muted p-1 ${
                  showAccessTab ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
                }`
              : "h-10"
          }
        >
          <TabsTrigger
            value="overview"
            className={profileVariant ? "rounded-lg data-[state=active]:bg-background" : undefined}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="kyc"
            className={profileVariant ? "rounded-lg data-[state=active]:bg-background" : undefined}
          >
            {corporate ? "KYB" : "KYC"}
          </TabsTrigger>
          <TabsTrigger
            value="aml"
            className={profileVariant ? "rounded-lg data-[state=active]:bg-background" : undefined}
          >
            AML
          </TabsTrigger>
          {showAccessTab ? (
            <TabsTrigger
              value="access"
              className={profileVariant ? "rounded-lg data-[state=active]:bg-background" : undefined}
            >
              Platform Access
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <>
            {profileVariant ? (
                <>
                  {profileCompletenessMissingSummary && profileCompletenessMissingSummary.missingCount > 0 ? (
                    <div className="rounded-xl border border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.15)] p-5">
                      <div className="min-w-0 space-y-1">
                        <p className="text-ui font-semibold">Profile completeness</p>
                        <p className="text-ui text-muted-foreground">
                          {profileCompletenessMissingSummary.percent}% complete · {profileCompletenessMissingSummary.missingCount}{" "}
                          {profileCompletenessMissingSummary.missingCount === 1 ? "item" : "items"} remaining
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <CustomerPartyProfileOverview
                    party={party}
                    person={joinedPerson}
                    variant="profile"
                    requiredMissingLabels={
                      profileCompletenessMissingSummary
                        ? new Set(profileCompletenessMissingSummary.missingItems.map((item) => item.label))
                        : undefined
                    }
                    editingSection={editingSection}
                    onEdit={
                      canEdit && !inactive
                        ? (sectionId) => {
                            setEditingSection(sectionId);
                          }
                        : undefined
                    }
                    renderEditSection={
                      canEdit && !inactive
                        ? (sectionId) => (
                            <PartyFillEmptyForm
                              party={party}
                              emailLocked={emailLocked}
                              section={sectionId}
                              hideSectionHeading
                              onCancel={() => setEditingSection(null)}
                              onSave={async (data) => {
                                const nextEmail = typeof data.email === "string" ? data.email : undefined;
                                const profile = { ...data };
                                delete profile.email;
                                const res = await api.patchPartyProfile(
                                  portal,
                                  organizationId,
                                  party.id,
                                  profile
                                );
                                if (!res.success) throw profileValidationErrorFromApi(res.error);
                                if (
                                  nextEmail !== undefined &&
                                  !emailLocked &&
                                  nextEmail.trim() !== personEmail
                                ) {
                                  await savePersonEmail(nextEmail);
                                }
                                toast.success("Person updated");
                                setEditingSection(null);
                                await invalidate();
                              }}
                            />
                          )
                        : undefined
                    }
                    editLabel="Edit"
                    showEditInAllSections
                  />
                </>
              ) : editingSection && canEdit && !inactive ? (
                <div className="rounded-xl border bg-card p-6">
                  <PartyFillEmptyForm
                    party={party}
                    emailLocked={emailLocked}
                    section={editingSection}
                    onCancel={() => setEditingSection(null)}
                    onSave={async (data) => {
                      const nextEmail = typeof data.email === "string" ? data.email : undefined;
                      const profile = { ...data };
                      delete profile.email;
                      const res = await api.patchPartyProfile(portal, organizationId, party.id, profile);
                      if (!res.success) throw profileValidationErrorFromApi(res.error);
                      if (nextEmail !== undefined && !emailLocked && nextEmail.trim() !== personEmail) {
                        await savePersonEmail(nextEmail);
                      }
                      toast.success("Person updated");
                      setEditingSection(null);
                      await invalidate();
                    }}
                  />
                </div>
              ) : (
                <>
                  {profileCompletenessMissingSummary && profileCompletenessMissingSummary.missingCount > 0 ? (
                    <div className="space-y-2 rounded-xl border border-status-action-text/30 bg-[hsl(var(--status-action-bg)/0.15)] p-4">
                      <p className="text-ui font-semibold text-status-action-text">Complete this profile</p>
                      <p className="text-ui text-muted-foreground">
                        {profileCompletenessMissingSummary.missingCount} details are still missing.
                      </p>
                      {profileCompletenessMissingSummary.missingFields.length > 0 ? (
                        <p className="text-meta text-status-action-text">
                          {profileCompletenessMissingSummary.missingFields.slice(0, 6).join(" · ")}
                        </p>
                      ) : null}
                      {canEdit && !inactive ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSection("details")}
                        >
                          Complete details
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <CustomerPartyProfileOverview party={party} person={joinedPerson} />
                  {canEdit && !inactive ? (
                    <Button type="button" onClick={() => setEditingSection("details")}>
                      Edit
                    </Button>
                  ) : null}
                </>
              )}
          </>
        </TabsContent>

        <TabsContent value="kyc" className="mt-6 space-y-4">
          <section className="space-y-4">
            <h2 className="text-card-title">{corporate ? "KYB Verification" : "KYC Verification"}</h2>
            <div className="rounded-xl border p-4 space-y-3">
              <ProfileFieldGrid>
                <div className="flex items-start gap-2">
                  <div className="flex items-start gap-2">
                    <div className="space-y-1">
                      <p className="text-meta text-muted-foreground">Status</p>
                      {kycChip ? (
                        <StatusBadge
                          status={getRelatedPartyStatusToken(kycChip, "user")}
                          label={`${corporate ? "KYB" : "KYC"} ${kycStatus}`}
                        />
                      ) : (
                        <p className="text-ui text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                  {showKycRefresh ? (
                    <PartyStatusRefreshControl busy={refreshing} onRefresh={() => void refreshPartyStatus()} />
                  ) : null}
                </div>
                {kycStage ? <ProfileReadField label="Current stage" value={kycStage} /> : null}
                {verificationId ? (
                  <ProfileReadField label={corporate ? "KYB ID" : "KYC ID"} value={verificationId} />
                ) : null}
                {!corporate ? <ProfileReadField label="Person Email" value={personEmail || "—"} /> : null}
                {approvedAt ? <ProfileReadField label="Approved date" value={approvedAt} /> : null}
              </ProfileFieldGrid>
            </div>
            {showCreateKyc ? (
              <div className="space-y-3">
                {!personEmail.trim() && !emailLocked ? (
                  <div className="max-w-md space-y-2">
                    <Label htmlFor="send-onboarding-email">Person Email</Label>
                    <Input
                      id="send-onboarding-email"
                      type="email"
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.target.value)}
                    />
                    <p className="text-meta text-muted-foreground">{PERSON_EMAIL_HELP}</p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  disabled={sendPending || !(personEmail.trim() || emailDraft.trim())}
                  onClick={async () => {
                    setSendPending(true);
                    try {
                      const email = personEmail.trim() || emailDraft.trim();
                      if (email !== personEmail) {
                        await savePersonEmail(email);
                      }
                      const sendRes = await api.post(`${orgBase}/send-director-onboarding`, {
                        partyKey: party.partyKey,
                      });
                      if (!sendRes.success) {
                        toast.error(sendRes.error.message);
                        return;
                      }
                      toast.success("Onboarding sent");
                      await invalidate();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not send onboarding.");
                    } finally {
                      setSendPending(false);
                    }
                  }}
                >
                  Send onboarding
                </Button>
              </div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="aml" className="mt-6">
          <section className="space-y-4">
            <h2 className="text-card-title">AML Screening</h2>

            <div className="rounded-xl border p-4 space-y-3">
              <ProfileFieldGrid>
                <div className="flex items-start gap-2">
                  <div className="space-y-1">
                    <p className="text-meta text-muted-foreground">Status</p>
                    {amlChip ? (
                      <StatusBadge
                        status={getRelatedPartyStatusToken(amlChip, "user")}
                        label={`AML ${amlStatus}`}
                      />
                    ) : (
                      <p className="text-ui text-muted-foreground">—</p>
                    )}
                  </div>
                  {showAmlRefresh ? (
                    <PartyStatusRefreshControl busy={refreshing} onRefresh={() => void refreshPartyStatus()} />
                  ) : null}
                </div>

                <ProfileReadField
                  label="Screening"
                  value={corporate ? "Company screening" : "Person screening"}
                />

                {verificationId ? (
                  <ProfileReadField
                    label={corporate ? "Related KYB" : "Related KYC"}
                    value={verificationId}
                  />
                ) : null}
              </ProfileFieldGrid>
              {amlWaiting ? <p className="text-ui text-muted-foreground">{amlWaiting}</p> : null}
            </div>
          </section>
        </TabsContent>

        {showAccessTab ? (
          <TabsContent value="access" className="mt-6 space-y-4">
            <section className="space-y-4">
              <h2 className="text-card-title">Platform Access</h2>
              {accessBadgeStatus ? (
                <StatusBadge status={accessBadgeStatus} label={accessLabel} />
              ) : (
                <p className="text-ui text-muted-foreground">—</p>
              )}
              <p className="text-meta text-muted-foreground">Account</p>
              {accessLabel === "No access" || accessLabel === "Invitation expired" ? (
                <>
                  <ProfileFieldGrid>
                    <ProfileReadField label="Access" value={accessLabel} />
                    <ProfileReadField label="Account" value="No platform account" />
                  </ProfileFieldGrid>
                  <p className="text-ui text-muted-foreground">
                    {accessLabel === "No access"
                      ? "This person does not currently have access to this organisation."
                      : "The previous invitation expired before it was accepted."}
                  </p>
                  {canManagePlatformAccess ? (
                    <Button type="button" onClick={() => setInviteOpen(true)}>
                      Invite user
                    </Button>
                  ) : null}
                </>
              ) : null}
              {accessLabel === "Invitation sent" ? (
                <>
                  <ProfileFieldGrid>
                    <ProfileReadField label="Access" value="Invitation sent" />
                    <ProfileReadField label="Account" value="No platform account" />
                    <ProfileReadField
                      label="Invitation email"
                      value={
                        invitations.find((item) => item.id === party.platformAccess.invitationId)?.email || "—"
                      }
                    />
                  </ProfileFieldGrid>
                  {canManagePlatformAccess ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!party.platformAccess.invitationId || pending}
                        onClick={async () => {
                          if (!party.platformAccess.invitationId) return;
                          setPending(true);
                          try {
                            const res = await api.post(
                              `${orgBase}/invitations/${party.platformAccess.invitationId}/resend`
                            );
                            if (!res.success) {
                              toast.error(res.error.message);
                              return;
                            }
                            toast.success("Invitation resent");
                            await invalidate();
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        Resend invitation
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setConfirm("cancel-invite")}>
                        Cancel invitation
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
              {accessLabel === "Owner" || accessLabel === "Admin" || accessLabel === "User" ? (
                <>
                  <ProfileFieldGrid>
                    <ProfileReadField label="Access" value={accessLabel} />
                    <ProfileReadField
                      label="Account"
                      value={
                        linkedMember
                          ? `${linkedMember.firstName} ${linkedMember.lastName}`.trim() || accountEmail || "—"
                          : accountEmail || "—"
                      }
                    />
                    <ProfileReadField
                      label="Account Email"
                      value={accountEmail || "—"}
                    />
                  </ProfileFieldGrid>
                  {canManagePlatformAccess && accessLabel !== "Owner" && party.userId !== currentUserId ? (
                    <div className="flex flex-wrap gap-2">
                      {accessLabel === "User" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            if (!party.userId) return;
                            const res = await api.patch(`${orgBase}/members/${party.userId}/role`, {
                              role: "ORGANIZATION_ADMIN",
                            });
                            if (!res.success) {
                              toast.error(res.error.message);
                              return;
                            }
                            toast.success("Access updated to Admin");
                            await invalidate();
                          }}
                        >
                          Change to Admin
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            if (!party.userId) return;
                            const res = await api.patch(`${orgBase}/members/${party.userId}/role`, {
                              role: "ORGANIZATION_MEMBER",
                            });
                            if (!res.success) {
                              toast.error(res.error.message);
                              return;
                            }
                            toast.success("Access updated to User");
                            await invalidate();
                          }}
                        >
                          Change to User
                        </Button>
                      )}
                      <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirm("remove")}>
                        Remove access
                      </Button>
                    </div>
                  ) : null}
                  {isOwnerViewer && party.userId && party.userId !== currentUserId ? (
                    <Button type="button" variant="outline" onClick={() => setConfirm("transfer")}>
                      Transfer ownership
                    </Button>
                  ) : null}
                </>
              ) : null}
            </section>
          </TabsContent>
        ) : null}
      </Tabs>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        people={invitePeople}
        initialPartyId={party.id}
        hooks={{
          invite: async (data) => {
            const res = await api.post<{
              success: boolean;
              invitationId: string;
              emailSent: boolean;
              invitationUrl?: string;
              emailError?: string;
              linkedExistingMember?: boolean;
            }>(`${orgBase}/members/invite`, data);
            if (!res.success) throw new Error(res.error.message);
            if (res.data.linkedExistingMember) toast.success("Platform access linked to this person");
            else if (res.data.emailSent) toast.success("Invitation sent");
            await invalidate();
            return res.data;
          },
          generateLink: async (data) => {
            const res = await api.post<{ invitationUrl: string; token: string }>(
              `${orgBase}/members/generate-link`,
              data
            );
            if (!res.success) throw new Error(res.error.message);
            await invalidate();
            return { invitationUrl: res.data.invitationUrl };
          },
          isInviting: pending,
        }}
      />

      <ConfirmDialog
        open={confirm === "remove"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Remove access"
        description="Remove CashSouk access? This company person will remain. Company roles, KYC and AML are unchanged."
        confirmText="Remove access"
        variant="destructive"
        onConfirm={async () => {
          if (!party.userId) return;
          const res = await api.delete(`${orgBase}/members/${party.userId}`);
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          toast.success("Platform access removed");
          setConfirm(null);
          await invalidate();
        }}
      />
      <ConfirmDialog
        open={confirm === "cancel-invite"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Cancel invitation"
        description="Cancel this invitation?"
        confirmText="Cancel invitation"
        variant="destructive"
        onConfirm={async () => {
          if (!party.platformAccess.invitationId) return;
          const res = await api.delete(`${orgBase}/invitations/${party.platformAccess.invitationId}`);
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          toast.success("Invitation cancelled");
          setConfirm(null);
          await invalidate();
        }}
      />
      <ConfirmDialog
        open={confirm === "inactivate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Mark inactive"
        description="Mark this person as inactive? Their existing KYC, AML and onboarding history will be kept."
        confirmText="Mark inactive"
        onConfirm={async () => {
          const res = await api.inactivatePartyProfile(portal, organizationId, party.id);
          if (!res.success) throw profileValidationErrorFromApi(res.error);
          toast.success("Person marked inactive");
          setConfirm(null);
          await invalidate();
        }}
      />
      <ConfirmDialog
        open={confirm === "reactivate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Reactivate person"
        description="Reactivate this person on the current profile? Existing KYC, AML and onboarding history will be kept."
        confirmText="Reactivate"
        onConfirm={async () => {
          const res = await api.reactivatePartyProfile(portal, organizationId, party.id);
          if (!res.success) throw profileValidationErrorFromApi(res.error);
          if (res.data.reviewRequired) {
            toast.success("Changes detected. Sent for Admin review before reactivation.");
          } else {
            toast.success("Person reactivated");
          }
          setConfirm(null);
          await invalidate();
        }}
      />
      <ConfirmDialog
        open={confirm === "transfer"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Transfer ownership"
        description={`Transfer CashSouk organisation ownership to ${party.name || "this user"}? This changes platform ownership only.`}
        confirmText="Transfer ownership"
        onConfirm={async () => {
          if (!party.userId) return;
          const res = await api.post(`${orgBase}/transfer-ownership`, { newOwnerId: party.userId });
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          toast.success("Ownership transferred");
          setConfirm(null);
          await invalidate();
        }}
      />
    </div>
  );
}
