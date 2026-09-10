"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  buildPeopleAccessRows,
  canManageDirectorShareholder,
  formatPeopleAccessCompanyRoleLine,
  getKycGroup,
  isPersonEmailLifecycleLocked,
  matchPersonToParty,
  peopleAccessAmlLabel,
  peopleAccessKycLabel,
  peopleAccessPlatformLabel,
  peopleAccessCompanyRolesFromParty,
  PERSON_EMAIL_HELP,
  profileValidationErrorFromApi,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
  type PeopleAccessInvitation,
  type PeopleAccessMember,
} from "@cashsouk/types";
import { PartyProfileDetailFields } from "../party-profile-detail-fields";
import { PartyFillEmptyForm } from "../portal-person-forms";
import { InviteUserDialog, inviteableCompanyPeople } from "./invite-user-dialog";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { StatusBadge } from "../components/status-badge";
import { ConfirmDialog } from "../components/confirm-dialog";
import { DetailHeader } from "../components/detail-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { ProfileReadField, ProfileFieldGrid } from "../components/profile-read-field";
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
  const roles = party ? peopleAccessCompanyRolesFromParty(party) : [];
  const orgBase = `/v1/organizations/${portal}/${organizationId}`;
  const blockOnboarding = organizationOnboardingStatus !== "COMPLETED";
  const kycGroup = joinedPerson ? getKycGroup(joinedPerson.onboarding?.status ?? "") : "NOT_STARTED";
  const hasVerifyLink = Boolean(joinedPerson?.onboarding?.verifyLink);
  const inProgressKyc = kycGroup === "IN_PROGRESS";
  const onboardingId = joinedPerson?.onboarding?.id?.trim() || "";
  const kycId =
    joinedPerson?.screeningRequestId?.trim() ||
    (onboardingId.startsWith("KYC") || onboardingId.startsWith("KYB") ? onboardingId : "");
  const showResendKycEmail = canEdit && !blockOnboarding && joinedPerson && inProgressKyc && hasVerifyLink;
  const showCreateKyc =
    canEdit &&
    !blockOnboarding &&
    joinedPerson &&
    canManageDirectorShareholder(joinedPerson) &&
    !inProgressKyc;
  const emailLocked = isPersonEmailLifecycleLocked({
    onboardingStatus: joinedPerson?.onboarding?.status,
    screeningStatus: joinedPerson?.screening?.status,
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

  React.useEffect(() => {
    setEmailDraft(party?.email ?? joinedPerson?.email ?? "");
  }, [joinedPerson?.email, party?.email]);

  const invalidate = async () => {
    await loadParties();
    await onChanged?.();
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
        status={inactive ? <StatusBadge status="neutral" label="Inactive" /> : undefined}
        facts={formatPeopleAccessCompanyRoleLine(roles)}
      />

      <Tabs value={section} onValueChange={(value) => setSection(value as PersonDetailSection)}>
        <TabsList className="h-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="aml">AML</TabsTrigger>
          <TabsTrigger value="access">Platform Access</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          {editing && canEdit && !inactive ? (
            <PartyFillEmptyForm
              party={party}
              onCancel={() => setEditing(false)}
              onSave={async (data) => {
                const res = await api.patchPartyProfile(portal, organizationId, party.id, data);
                if (!res.success) throw profileValidationErrorFromApi(res.error);
                toast.success("Person updated");
                setEditing(false);
                await invalidate();
              }}
            />
          ) : (
            <>
              <PartyProfileDetailFields party={party} person={joinedPerson} />
              {canEdit && party.entityType !== "CORPORATE" && !inactive ? (
                <div className="space-y-2 rounded-xl border bg-card p-4">
                  <Label htmlFor="person-email">Person Email</Label>
                  <Input
                    id="person-email"
                    type="email"
                    value={emailDraft}
                    disabled={emailLocked}
                    onChange={(event) => setEmailDraft(event.target.value)}
                  />
                  <p className="text-meta text-muted-foreground">{PERSON_EMAIL_HELP}</p>
                  {party.linkedUser?.email ? (
                    <p className="text-meta text-muted-foreground">Account Email: {party.linkedUser.email}</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={emailLocked}
                    onClick={async () => {
                      const saveRes = await api.patch(`${orgBase}/ctos-party-email`, {
                        partyKey: party.partyKey,
                        email: emailDraft,
                      });
                      if (!saveRes.success) {
                        toast.error(saveRes.error.message);
                        return;
                      }
                      toast.success("Person Email saved");
                      await invalidate();
                    }}
                  >
                    Save Person Email
                  </Button>
                </div>
              ) : null}
              {canEdit && !inactive ? (
                <Button type="button" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="kyc" className="mt-6 space-y-4">
          <div className="rounded-xl border bg-card p-6">
            <ProfileFieldGrid>
              <ProfileReadField label="KYC" value={peopleAccessKycLabel(joinedPerson)} />
              <ProfileReadField label="Onboarding stage" value={joinedPerson?.onboarding?.status || "—"} />
              <ProfileReadField label="Request ID" value={joinedPerson?.requestId || onboardingId || "—"} />
              <ProfileReadField label="KYC ID" value={kycId || "—"} />
              <ProfileReadField label="Person Email" value={party.email || joinedPerson?.email || "—"} />
            </ProfileFieldGrid>
            {showCreateKyc ? (
              <Button
                type="button"
                className="mt-4"
                disabled={sendPending || !emailDraft.trim()}
                onClick={async () => {
                  setSendPending(true);
                  try {
                    const saveRes = await api.patch(`${orgBase}/ctos-party-email`, {
                      partyKey: party.partyKey,
                      email: emailDraft,
                    });
                    if (!saveRes.success) {
                      toast.error(saveRes.error.message);
                      return;
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
                  } finally {
                    setSendPending(false);
                  }
                }}
              >
                Send onboarding
              </Button>
            ) : null}
            {showResendKycEmail ? (
              <Button
                type="button"
                className="mt-4"
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
            ) : null}
            {inProgressKyc && hasVerifyLink ? (
              <p className="mt-3 text-meta text-muted-foreground">
                An onboarding request is already in progress. Resend uses the stored link and does not create a new RegTank request.
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="aml" className="mt-6">
          <div className="rounded-xl border bg-card p-6">
            <ProfileFieldGrid>
              <ProfileReadField label="AML" value={peopleAccessAmlLabel(joinedPerson)} />
              <ProfileReadField label="Screening status" value={joinedPerson?.screening?.status || "—"} />
              <ProfileReadField label="Screening ID" value={joinedPerson?.screening?.id || "—"} />
              <ProfileReadField
                label="Risk"
                value={
                  [joinedPerson?.screening?.riskLevel, joinedPerson?.screening?.riskScore]
                    .filter((value) => value != null && String(value).trim() !== "")
                    .join(" · ") || "—"
                }
              />
            </ProfileFieldGrid>
          </div>
        </TabsContent>

        <TabsContent value="access" className="mt-6 space-y-4">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            {accessLabel === "No access" || accessLabel === "Invitation expired" ? (
              <>
                <ProfileReadField
                  label="Platform Access"
                  value={accessLabel === "No access" ? "No CashSouk access" : accessLabel}
                />
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
                  <ProfileReadField label="Platform Access" value="Invitation sent" />
                  <ProfileReadField
                    label="Account Email"
                    value={
                      invitations.find((item) => item.id === party.platformAccess.invitationId)?.email ||
                      party.email ||
                      "—"
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
                  <ProfileReadField label="Platform Access" value="Active" />
                  <ProfileReadField label="Account Email" value={party.linkedUser?.email || row?.accountEmail || "—"} />
                  <ProfileReadField label="Access level" value={accessLabel} />
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
          </div>
          {canInactivate && !inactive ? (
            <Button type="button" variant="outline" onClick={() => setConfirm("inactivate")}>
              Mark inactive
            </Button>
          ) : null}
        </TabsContent>
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
