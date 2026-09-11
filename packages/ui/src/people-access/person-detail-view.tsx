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
  isPersonEmailLifecycleLocked,
  matchPersonToParty,
  peopleAccessAmlChipPresentation,
  peopleAccessKycChipPresentation,
  peopleAccessPlatformLabel,
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
  canInactivate = false,
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
  canInactivate?: boolean;
  onBack: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const [section, setSection] = React.useState<PersonDetailSection>("overview");
  const [parties, setParties] = React.useState<OrganizationPartyProfileDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [emailDraft, setEmailDraft] = React.useState("");
  const [sendPending, setSendPending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshInFlight = React.useRef(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"remove" | "inactivate" | "cancel-invite" | "transfer" | null>(null);

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
  const { active, inactive: inactiveRows } = buildPeopleAccessRows({
    parties,
    people,
    members,
    invitations,
    ownerUserId: ownerUserId ?? null,
  });
  const row = [...active, ...inactiveRows].find((item) => item.partyId === partyId);
  const inactive = party?.membershipStatus === "MASTER_INACTIVE";
  const corporate = party?.entityType === "CORPORATE";
  const orgBase = `/v1/organizations/${portal}/${organizationId}`;
  const blockOnboarding = organizationOnboardingStatus !== "COMPLETED";
  const kycGroup = joinedPerson ? getKycGroup(joinedPerson.onboarding?.status ?? "") : "NOT_STARTED";
  const hasVerifyLink = Boolean(joinedPerson?.onboarding?.verifyLink);
  const inProgressKyc = kycGroup === "IN_PROGRESS";
  const verificationId = corporate ? customerKybId(joinedPerson) : customerKycId(joinedPerson);
  const showResendKycEmail = canEdit && !blockOnboarding && joinedPerson && inProgressKyc && hasVerifyLink;
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
  const kycStatus = customerProcessStatusLabel({
    kind: corporate ? "kyb" : "kyc",
    person: joinedPerson,
  });
  const amlStatus = customerProcessStatusLabel({ kind: "aml", person: joinedPerson });
  const kycChip = peopleAccessKycChipPresentation(joinedPerson);
  const amlChip = peopleAccessAmlChipPresentation(joinedPerson);
  const kycStage = customerKycCurrentStage({ person: joinedPerson, statusLabel: kycStatus });
  const approvedAt = customerApprovedAt(joinedPerson);
  const amlWaiting = customerAmlWaitingCopy({
    corporate: Boolean(corporate),
    person: joinedPerson,
    amlLabel: amlStatus,
  });
  const showAccessTab = !corporate;

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
        <Button type="button" variant="ghost" className="gap-2 px-0" onClick={onBack}>
          <ArrowLeftIcon className="h-4 w-4" />
          People & Access
        </Button>
        <p className="text-ui text-muted-foreground">This person was not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" className="gap-2 px-0" onClick={onBack}>
        <ArrowLeftIcon className="h-4 w-4" />
        People & Access
      </Button>
      <DetailHeader
        title={party.name || "Person"}
        status={
          <div className="flex flex-wrap items-center gap-2">
            {inactive ? <StatusBadge status="neutral" label="Inactive" /> : null}
            {kycChip ? (
              <StatusBadge
                status={getRelatedPartyStatusToken(kycChip, "user")}
                label={`${corporate ? "KYB" : "KYC"} ${kycStatus}`}
              />
            ) : null}
            {amlChip ? (
              <StatusBadge status={getRelatedPartyStatusToken(amlChip, "user")} label={`AML ${amlStatus}`} />
            ) : null}
          </div>
        }
        facts={customerHeaderFacts({ party, person: joinedPerson })}
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
          ) : null
        }
      />

      <Tabs
        value={section}
        onValueChange={(value) => {
          setSection(value as PersonDetailSection);
          if (value !== "overview") setEditing(false);
        }}
      >
        <TabsList className="h-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">{corporate ? "KYB" : "KYC"}</TabsTrigger>
          <TabsTrigger value="aml">AML</TabsTrigger>
          {showAccessTab ? <TabsTrigger value="access">Platform Access</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {editing && canEdit && !inactive ? (
            <PartyFillEmptyForm
              party={party}
              emailLocked={emailLocked}
              onCancel={() => setEditing(false)}
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
                setEditing(false);
                await invalidate();
              }}
            />
          ) : (
            <>
              <CustomerPartyProfileOverview party={party} person={joinedPerson} />
              {canEdit && !inactive ? (
                <Button type="button" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="kyc" className="mt-6 space-y-4">
          <section className="space-y-4">
            <h2 className="text-card-title">{corporate ? "KYB Verification" : "KYC Verification"}</h2>
            <ProfileFieldGrid>
              <div className="flex items-start gap-2">
                <ProfileReadField label="Status" value={kycStatus} />
                {showKycRefresh ? (
                  <PartyStatusRefreshControl busy={refreshing} onRefresh={() => void refreshPartyStatus()} />
                ) : null}
              </div>
              {kycStage ? <ProfileReadField label="Current Stage" value={kycStage} /> : null}
              {verificationId ? (
                <ProfileReadField label={corporate ? "KYB ID" : "KYC ID"} value={verificationId} />
              ) : null}
              {!corporate ? <ProfileReadField label="Person Email" value={personEmail || "—"} /> : null}
              {approvedAt ? <ProfileReadField label="Approved date" value={approvedAt} /> : null}
            </ProfileFieldGrid>
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
            {showResendKycEmail ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendPending}
                  onClick={async () => {
                    setSendPending(true);
                    try {
                      const sendRes = await api.post(`${orgBase}/send-director-onboarding`, {
                        partyKey: party.partyKey,
                      });
                      if (!sendRes.success) {
                        toast.error(sendRes.error.message);
                        return;
                      }
                      toast.success("Onboarding email resent");
                      await invalidate();
                    } finally {
                      setSendPending(false);
                    }
                  }}
                >
                  Resend onboarding email
                </Button>
                <p className="text-meta text-muted-foreground">
                  An onboarding request is already in progress. Resend uses the stored link and does not create a new
                  request.
                </p>
              </div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="aml" className="mt-6">
          <section className="space-y-4">
            <h2 className="text-card-title">AML Screening</h2>
            <ProfileFieldGrid>
              <div className="flex items-start gap-2">
                <ProfileReadField label="Status" value={amlStatus} />
                {showAmlRefresh ? (
                  <PartyStatusRefreshControl busy={refreshing} onRefresh={() => void refreshPartyStatus()} />
                ) : null}
              </div>
            </ProfileFieldGrid>
            {amlWaiting ? <p className="text-ui text-muted-foreground">{amlWaiting}</p> : null}
          </section>
        </TabsContent>

        {showAccessTab ? (
          <TabsContent value="access" className="mt-6 space-y-4">
            <section className="space-y-4">
              <h2 className="text-card-title">Platform Access</h2>
              {accessLabel === "No access" || accessLabel === "Invitation expired" ? (
                <>
                  <ProfileReadField
                    label="Access"
                    value={accessLabel === "No access" ? "No CashSouk account" : accessLabel}
                  />
                  <p className="text-ui text-muted-foreground">
                    {accessLabel === "No access"
                      ? "This person does not currently have access to this organisation."
                      : "The previous invitation expired before it was accepted."}
                  </p>
                  {canEdit ? (
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
                    <ProfileReadField
                      label="Account Email"
                      value={
                        invitations.find((item) => item.id === party.platformAccess.invitationId)?.email || "—"
                      }
                    />
                  </ProfileFieldGrid>
                  {canEdit ? (
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
                      label="Account Email"
                      value={accountEmail || row?.accountEmail || "—"}
                    />
                  </ProfileFieldGrid>
                  {canEdit && accessLabel !== "Owner" && party.userId !== currentUserId ? (
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
