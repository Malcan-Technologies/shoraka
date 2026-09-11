"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  EllipsisHorizontalIcon,
  PlusIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken, PARTY_STATUS_REFRESHED_MESSAGE, PARTY_STATUS_REFRESH_FAILED_MESSAGE, PROVIDER_REFRESH_RECENTLY_MESSAGE } from "@cashsouk/config";
import {
  buildPeopleAccessRows,
  canManageDirectorShareholder,
  computeIssuerPersonCompleteness,
  filterPeopleAccessRows,
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  getKycGroup,
  getRelatedPartyStatusToken,
  isMissingGovernmentIdPerson,
  isPersonEmailLifecycleLocked,
  issuerPersonCompletenessInputFromParty,
  normalizeDirectorShareholderIdKey,
  normalizeDirectorShareholderPartyEmail,
  peopleAccessAmlChipPresentation,
  peopleAccessKycChipPresentation,
  peopleAccessPlatformBadgeStatus,
  PERSON_EMAIL_HELP,
  profileValidationErrorFromApi,
  addCompanyPersonUsesOnboardingFlow,
  relatedPartyVerificationCaption,
  resolveCustomerDirectorShareholderEmptyWarning,
  shouldShowPartyAmlRefresh,
  shouldShowPartyKycRefresh,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
  type ApplicationPersonRow,
  type DirectorShareholderListSource,
  type OrganizationPartyProfileDto,
  type PeopleAccessFilter,
  type PeopleAccessInvitation,
  type PeopleAccessMember,
  type PeopleAccessRow,
} from "@cashsouk/types";
import { inviteableCompanyPeople, InviteUserDialog } from "./invite-user-dialog";
import { PartyStatusRefreshControl } from "./party-status-refresh-control";
import { DirectorShareholderCtosEmptyAlert } from "../director-shareholder-ctos-empty-alert";
import { DirectorShareholderUnresolvedIdentitySection } from "../director-shareholder-unresolved-identity-card";
import { CustomerPartyProfileOverview } from "./customer-person-overview";
import { AddPersonForm, type AddPersonInitial } from "../portal-person-forms";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { EmptyState } from "../components/empty-state";
import { StatusBadge } from "../components/status-badge";
import { ConfirmDialog } from "../components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/sheet";
import { Tabs, TabsList, TabsTrigger } from "../components/tabs";
import type { PortalPeoplePortal } from "../portal-people-section";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function AccessBadge({ label }: { label: PeopleAccessRow["platformAccess"] }) {
  const status = peopleAccessPlatformBadgeStatus(label);
  if (!status) return <span className="text-ui text-muted-foreground">—</span>;
  return <StatusBadge status={status} label={label} />;
}

function toastPartyRefreshFailure(code?: string) {
  if (code === "REGTANK_RATE_LIMITED" || code === "RATE_LIMITED" || code === "REFRESH_IN_PROGRESS") {
    toast.error(PROVIDER_REFRESH_RECENTLY_MESSAGE);
    return;
  }
  toast.error(PARTY_STATUS_REFRESH_FAILED_MESSAGE);
}

function refreshParams(row: PeopleAccessRow) {
  return {
    person: row.person,
    origin: row.party?.origin,
    partyKey: row.party?.partyKey ?? row.partyKey,
    kind: row.kind,
  };
}

function PeopleAccessKycStatus({
  row,
  canEdit,
  refreshing,
  onRefresh,
}: {
  row: PeopleAccessRow;
  canEdit: boolean;
  refreshing: boolean;
  onRefresh?: () => void;
}) {
  const person = row.person;
  const presentation = peopleAccessKycChipPresentation(person);
  if (!presentation || !person) {
    return <span className="text-ui text-muted-foreground">—</span>;
  }
  const showRefresh = Boolean(canEdit && onRefresh && shouldShowPartyKycRefresh(refreshParams(row)));
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-meta text-muted-foreground">{relatedPartyVerificationCaption(person.entityType)}</span>
      <div className="flex items-center gap-1">
        <StatusBadge
          size="sm"
          label={presentation.label}
          status={getRelatedPartyStatusToken(presentation, "user")}
        />
        {showRefresh ? <PartyStatusRefreshControl busy={refreshing} onRefresh={onRefresh!} /> : null}
      </div>
    </div>
  );
}

function PeopleAccessAmlStatus({
  row,
  canEdit,
  refreshing,
  onRefresh,
}: {
  row: PeopleAccessRow;
  canEdit: boolean;
  refreshing: boolean;
  onRefresh?: () => void;
}) {
  const person = row.person;
  const presentation = peopleAccessAmlChipPresentation(person);
  if (!presentation || !person) {
    return <span className="text-ui text-muted-foreground">—</span>;
  }
  const showRefresh = Boolean(canEdit && onRefresh && shouldShowPartyAmlRefresh(refreshParams(row)));
  return (
    <div className="flex items-center gap-1">
      <StatusBadge
        size="sm"
        label={presentation.label}
        status={getRelatedPartyStatusToken(presentation, "user")}
      />
      {showRefresh ? <PartyStatusRefreshControl busy={refreshing} onRefresh={onRefresh!} /> : null}
    </div>
  );
}

export function PeopleAccessSection({
  portal,
  organizationId,
  organizationOnboardingStatus,
  people,
  directorShareholderListSource,
  ctosDirectorShareholderWarning,
  focusedMatchKey,
  canEdit,
  canInactivate = false,
  currentUserId,
  ownerUserId,
  members,
  invitations,
  onChanged,
  onViewPerson,
  invitePortalUrl,
}: {
  portal: PortalPeoplePortal;
  organizationId: string;
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  directorShareholderListSource?: DirectorShareholderListSource | null;
  ctosDirectorShareholderWarning?: string | null;
  focusedMatchKey?: string | null;
  canEdit: boolean;
  canInactivate?: boolean;
  currentUserId?: string | null;
  ownerUserId?: string | null;
  members: PeopleAccessMember[];
  invitations: PeopleAccessInvitation[];
  onChanged?: () => void | Promise<void>;
  onViewPerson?: (partyId: string) => void;
  invitePortalUrl?: string;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const [filter, setFilter] = React.useState<PeopleAccessFilter>("all");
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [addInitial, setAddInitial] = React.useState<AddPersonInitial | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [invitePartyId, setInvitePartyId] = React.useState<string | null>(null);
  const [parties, setParties] = React.useState<OrganizationPartyProfileDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewPeopleOnlyKey, setViewPeopleOnlyKey] = React.useState<string | null>(null);
  const [inactivatePartyId, setInactivatePartyId] = React.useState<string | null>(null);
  const [inactivatePending, setInactivatePending] = React.useState(false);
  const [onboardKey, setOnboardKey] = React.useState<string | null>(null);
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [sendPending, setSendPending] = React.useState(false);
  const [invitePending, setInvitePending] = React.useState(false);
  const [generateLinkPending, setGenerateLinkPending] = React.useState(false);
  const [platformRowKey, setPlatformRowKey] = React.useState<string | null>(null);
  const [managePending, setManagePending] = React.useState(false);
  const [refreshingPartyId, setRefreshingPartyId] = React.useState<string | null>(null);
  const refreshInFlight = React.useRef<string | null>(null);
  const [confirm, setConfirm] = React.useState<{
    type: "remove" | "leave" | "transfer" | "cancel-invite";
    userId?: string;
    invitationId?: string;
    name?: string;
  } | null>(null);

  const loadParties = React.useCallback(async () => {
    const res = await api.getPartyProfiles(portal, organizationId);
    if (!res.success) throw profileValidationErrorFromApi(res.error);
    setParties(
      res.data.filter(
        (party) =>
          party.membershipStatus === "MASTER_ACTIVE" || party.membershipStatus === "MASTER_INACTIVE"
      )
    );
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

  const { active, inactive } = React.useMemo(
    () =>
      buildPeopleAccessRows({
        parties,
        people,
        members,
        invitations,
        ownerUserId: ownerUserId ?? null,
      }),
    [invitations, members, ownerUserId, parties, people]
  );
  const visibleRows = filterPeopleAccessRows(active, filter, search);
  const visiblePeople = filterVisiblePeopleRows(people);
  const unresolvedPeople = visiblePeople.filter((person) => isMissingGovernmentIdPerson(person));
  const ctosEmpty = resolveCustomerDirectorShareholderEmptyWarning({
    directorShareholderListSource,
    ctosDirectorShareholderWarning,
  });
  const invitePeople = inviteableCompanyPeople(active);
  const viewingPeopleOnly =
    visiblePeople.find((person) => person.matchKey === viewPeopleOnlyKey) ?? null;
  const inactivating = parties.find((party) => party.id === inactivatePartyId) ?? null;
  const platformRow = active.find((row) => row.key === platformRowKey) ?? null;
  const onboardPerson =
    active.find((row) => row.partyId === onboardKey || row.partyKey === onboardKey)?.person ??
    visiblePeople.find((person) => person.matchKey === onboardKey) ??
    null;
  const blockOnboarding = organizationOnboardingStatus !== "COMPLETED";
  const orgBase = `/v1/organizations/${portal}/${organizationId}`;
  const isOwnerViewer = Boolean(currentUserId && ownerUserId && currentUserId === ownerUserId);

  const invalidate = async () => {
    await loadParties();
    await onChanged?.();
  };

  const refreshPartyStatus = async (partyId: string) => {
    if (!partyId || refreshInFlight.current === partyId) return;
    refreshInFlight.current = partyId;
    setRefreshingPartyId(partyId);
    try {
      const res = await api.refreshPartyRegTankStatus(portal, organizationId, partyId);
      if (!res.success) {
        toastPartyRefreshFailure(res.error.code);
        return;
      }
      toast.success(PARTY_STATUS_REFRESHED_MESSAGE);
      await invalidate();
    } finally {
      if (refreshInFlight.current === partyId) refreshInFlight.current = null;
      setRefreshingPartyId((current) => (current === partyId ? null : current));
    }
  };

  React.useEffect(() => {
    const norm = normalizeDirectorShareholderIdKey(focusedMatchKey ?? "");
    if (!norm) return;
    const el = document.querySelector<HTMLElement>(`[data-person-key="${norm}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedMatchKey, parties]);

  const sendOnboarding = async (person: ApplicationPersonRow, email: string) => {
    const partyKey = person.matchKey;
    if (!email.trim() || !partyKey) {
      toast.error("Enter a valid email.");
      return;
    }
    const nextEmail = normalizeDirectorShareholderPartyEmail(email);
    for (const row of people) {
      if (row.matchKey === person.matchKey) continue;
      if (normalizeDirectorShareholderPartyEmail(row.email ?? "") === nextEmail) {
        toast.error("Email already used for another director/shareholder");
        return;
      }
    }
    setSendPending(true);
    try {
      const saveRes = await api.patch(`${orgBase}/ctos-party-email`, { partyKey, email });
      if (!saveRes.success) {
        toast.error(saveRes.error.message);
        return;
      }
      const sendRes = await api.post(`${orgBase}/send-director-onboarding`, { partyKey });
      if (!sendRes.success) {
        toast.error(sendRes.error.message);
        return;
      }
      toast.success("Email saved and onboarding link sent");
      await invalidate();
    } finally {
      setSendPending(false);
    }
  };

  const openInvite = (partyId?: string) => {
    setInvitePartyId(partyId ?? null);
    setInviteOpen(true);
  };

  const viewRow = (row: PeopleAccessRow) => {
    if (row.partyId && onViewPerson) {
      onViewPerson(row.partyId);
      return;
    }
    if (row.kind === "people_only") {
      setViewPeopleOnlyKey(row.partyKey);
      return;
    }
    if (row.kind === "platform_only") {
      setPlatformRowKey(row.key);
    }
  };

  const empty = !loading && active.length === 0 && inactive.length === 0 && unresolvedPeople.length === 0;

  return (
    <div id="profile-people" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">People & Access</h2>
          <p className="text-ui text-muted-foreground">
            Manage company representatives and who can access this organisation.
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => {
                setAddInitial(null);
                setAddOpen(true);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              Add company person
            </Button>
            <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => openInvite()}>
              <UserPlusIcon className="h-4 w-4" />
              Invite user
            </Button>
          </div>
        ) : null}
      </div>

      {ctosEmpty ? <DirectorShareholderCtosEmptyAlert message={ctosEmpty} /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as PeopleAccessFilter)}>
          <TabsList className="h-9">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="company">Company people</TabsTrigger>
            <TabsTrigger value="platform">Platform access</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="h-9 lg:max-w-xs"
        />
      </div>

      {loading ? <p className="text-ui text-muted-foreground">Loading…</p> : null}

      {empty ? (
        <EmptyState
          title="No people or users yet"
          message="Add company people such as directors and shareholders, or invite someone to access this organisation."
          action={
            canEdit ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddInitial(null);
                    setAddOpen(true);
                  }}
                >
                  Add company person
                </Button>
                <Button type="button" onClick={() => openInvite()}>
                  Invite user
                </Button>
              </div>
            ) : null
          }
        />
      ) : null}

      {!loading && !empty && visibleRows.length === 0 ? (
        <p className="text-ui text-muted-foreground">No matching people.</p>
      ) : null}

      {visibleRows.length > 0 ? (
        <>
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-full text-ui">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Company Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Platform Access</th>
                  <th className="px-4 py-3 text-left font-semibold">KYC/KYB</th>
                  <th className="px-4 py-3 text-left font-semibold">AML</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <PeopleAccessTableRow
                    key={row.key}
                    row={row}
                    portal={portal}
                    canEdit={canEdit}
                    canInactivate={canInactivate}
                    currentUserId={currentUserId}
                    isOwnerViewer={isOwnerViewer}
                    blockOnboarding={blockOnboarding}
                    refreshing={Boolean(row.partyId && refreshingPartyId === row.partyId)}
                    onRefreshStatus={
                      canEdit && row.partyId
                        ? () => {
                            void refreshPartyStatus(row.partyId!);
                          }
                        : undefined
                    }
                    onView={() => viewRow(row)}
                    onInvite={() => row.partyId && openInvite(row.partyId)}
                    onResend={
                      row.invitationId
                        ? async () => {
                            const res = await api.post(`${orgBase}/invitations/${row.invitationId}/resend`);
                            if (!res.success) {
                              toast.error(res.error.message);
                              return;
                            }
                            toast.success("Invitation resent");
                            await invalidate();
                          }
                        : undefined
                    }
                    onCancelInvite={
                      row.invitationId
                        ? () =>
                            setConfirm({
                              type: "cancel-invite",
                              invitationId: row.invitationId ?? undefined,
                              name: row.name,
                            })
                        : undefined
                    }
                    onChangeRole={async (next) => {
                      if (!row.userId) return;
                      const res = await api.patch(`${orgBase}/members/${row.userId}/role`, { role: next });
                      if (!res.success) {
                        toast.error(res.error.message);
                        return;
                      }
                      toast.success(next === "ORGANIZATION_ADMIN" ? "Access updated to Admin" : "Access updated to User");
                      await invalidate();
                    }}
                    onRemove={() =>
                      row.userId
                        ? setConfirm({ type: "remove", userId: row.userId, name: row.name })
                        : undefined
                    }
                    onLeave={() => setConfirm({ type: "leave", name: row.name })}
                    onTransfer={() => setConfirm({ type: "transfer", userId: row.userId ?? undefined, name: row.name })}
                    onInactivate={() => row.partyId && setInactivatePartyId(row.partyId)}
                    onSendOnboarding={() => {
                      const key = row.partyId || row.partyKey || "";
                      setDraftEmails((current) => ({
                        ...current,
                        [key]: current[key] ?? row.personEmail ?? "",
                      }));
                      setOnboardKey(key);
                    }}
                    onCopyInvite={
                      row.invitationToken && invitePortalUrl
                        ? () => {
                            navigator.clipboard.writeText(
                              `${invitePortalUrl}/accept-invitation?token=${row.invitationToken}`
                            );
                            toast.success("Invitation link copied to clipboard");
                          }
                        : undefined
                    }
                    onAdoptPeopleOnly={
                      canEdit && row.kind === "people_only" && row.person
                        ? () => {
                            const roles = (row.person?.roles ?? []).map((role) => role.toUpperCase());
                            setAddInitial({
                              name: row.person?.name ?? "",
                              identityNumber: row.partyKey ?? "",
                              email: row.personEmail ?? "",
                              entityType: row.person?.entityType,
                              isDirector: roles.includes("DIRECTOR"),
                              isShareholder: roles.includes("SHAREHOLDER"),
                              isBoard: roles.includes("BOARD"),
                              isManagement: roles.includes("MANAGEMENT"),
                              shareholdingPercentage:
                                row.person?.sharePercentage != null ? String(row.person.sharePercentage) : "",
                            });
                            setAddOpen(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {visibleRows.map((row) => (
              <div
                key={row.key}
                data-person-key={normalizeDirectorShareholderIdKey(row.party?.identityNumber ?? row.partyKey ?? "")}
                className="rounded-xl border bg-card p-4"
              >
                <p className="text-ui font-medium">{row.name}</p>
                <p className="text-meta text-muted-foreground">{row.companyRoleLine}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AccessBadge label={row.platformAccess} />
                  <PeopleAccessKycStatus
                    row={row}
                    canEdit={canEdit}
                    refreshing={Boolean(row.partyId && refreshingPartyId === row.partyId)}
                    onRefresh={
                      canEdit && row.partyId
                        ? () => {
                            void refreshPartyStatus(row.partyId!);
                          }
                        : undefined
                    }
                  />
                  <PeopleAccessAmlStatus
                    row={row}
                    canEdit={canEdit}
                    refreshing={Boolean(row.partyId && refreshingPartyId === row.partyId)}
                    onRefresh={
                      canEdit && row.partyId
                        ? () => {
                            void refreshPartyStatus(row.partyId!);
                          }
                        : undefined
                    }
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3 h-8" onClick={() => viewRow(row)}>
                  View
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {unresolvedPeople.length > 0 ? (
        <DirectorShareholderUnresolvedIdentitySection
          noticeTitle={UNRESOLVED_IDENTITY_RECOVERY_TITLE}
          noticeDescription={UNRESOLVED_IDENTITY_RECOVERY_COPY}
          showTechnicalIds={false}
          canRecover={!blockOnboarding}
          recoverPendingKey={null}
          onRecoverGovernmentId={async (payload) => {
            const result = await api.patch(`${orgBase}/unresolved-identity`, payload);
            if (!result.success) {
              toast.error(result.error.message);
              return;
            }
            toast.success("Government ID saved.");
            await invalidate();
          }}
          people={unresolvedPeople.map((person) => ({
            name: person.name,
            role: formatPeopleRolesLine(person),
            sharePercentage: person.sharePercentage,
            eodRequestId: person.requestId,
            email: person.email ?? null,
            recoverRole: person.roles.includes("DIRECTOR")
              ? "DIRECTOR"
              : person.roles.includes("SHAREHOLDER")
                ? "SHAREHOLDER"
                : undefined,
            onboardingStatus: person.onboarding?.status ?? null,
            amlStatus: person.screening?.status ?? null,
            kycId: person.onboarding?.id ?? null,
          }))}
        />
      ) : null}

      {inactive.length > 0 ? (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer text-ui font-medium">Inactive company people</summary>
          <div className="mt-3 space-y-2">
            {inactive.map((row) => (
              <button
                key={row.key}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left"
                onClick={() => viewRow(row)}
              >
                <span className="text-ui">{row.name}</span>
                <StatusBadge status="neutral" label="Inactive" />
              </button>
            ))}
          </div>
        </details>
      ) : null}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddInitial(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add company person</DialogTitle>
            <DialogDescription className="sr-only">
              Add a person to the company profile.
            </DialogDescription>
          </DialogHeader>
          <AddPersonForm
            initial={addInitial}
            layout="grouped"
            onCancel={() => {
              setAddOpen(false);
              setAddInitial(null);
            }}
            onSave={async (data) => {
              const res = await api.createManagementParty(portal, organizationId, data);
              if (!res.success) throw profileValidationErrorFromApi(res.error);
              const shouldSendOnboarding =
                addCompanyPersonUsesOnboardingFlow({
                  entityType: data.entityType,
                  isDirector: data.isDirector === true,
                  isShareholder: data.isShareholder === true,
                }) && Boolean(String(data.email ?? "").trim()) && Boolean(res.data.partyKey);
              if (shouldSendOnboarding) {
                const sendRes = await api.post(`${orgBase}/send-director-onboarding`, {
                  partyKey: res.data.partyKey,
                });
                if (!sendRes.success) {
                  toast.success("Person added");
                  toast.error(sendRes.error.message);
                } else {
                  toast.success("Person added and onboarding link sent");
                }
              } else {
                toast.success("Person added");
              }
              setAddOpen(false);
              await invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setInvitePartyId(null);
        }}
        people={invitePeople}
        initialPartyId={invitePartyId}
        hooks={{
          invite: async (data) => {
            setInvitePending(true);
            try {
              const res = await api.post<{
                success: boolean;
                invitationId: string;
                emailSent: boolean;
                invitationUrl?: string;
                emailError?: string;
                linkedExistingMember?: boolean;
              }>(`${orgBase}/members/invite`, data);
              if (!res.success) throw new Error(res.error.message);
              if (res.data.linkedExistingMember) {
                toast.success("Platform access linked to this person");
              } else if (res.data.emailSent) {
                toast.success("Invitation sent");
              } else {
                toast.warning("Invitation created but email failed to send", {
                  description: res.data.emailError || "You can copy the invitation link",
                });
              }
              await invalidate();
              return res.data;
            } finally {
              setInvitePending(false);
            }
          },
          generateLink: async (data) => {
            setGenerateLinkPending(true);
            try {
              const res = await api.post<{ invitationUrl: string; token: string }>(
                `${orgBase}/members/generate-link`,
                data
              );
              if (!res.success) throw new Error(res.error.message);
              await invalidate();
              return { invitationUrl: res.data.invitationUrl };
            } finally {
              setGenerateLinkPending(false);
            }
          },
          isInviting: invitePending,
          isGeneratingLink: generateLinkPending,
        }}
      />

      <Dialog
        open={Boolean(viewPeopleOnlyKey)}
        onOpenChange={(open) => {
          if (!open) setViewPeopleOnlyKey(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingPeopleOnly?.name || "Person"}</DialogTitle>
            <DialogDescription>Onboarding details for this person</DialogDescription>
          </DialogHeader>
          {viewingPeopleOnly ? <CustomerPartyProfileOverview person={viewingPeopleOnly} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(onboardPerson)} onOpenChange={(open) => !open && setOnboardKey(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send onboarding</DialogTitle>
            <DialogDescription>
              KYC onboarding is separate from platform access. Person Email is not the platform login email.
            </DialogDescription>
          </DialogHeader>
          {onboardPerson ? (
            <div className="space-y-2">
              <Label htmlFor="send-onboarding-email">Person Email</Label>
              <Input
                id="send-onboarding-email"
                type="email"
                value={draftEmails[onboardKey || ""] ?? onboardPerson.email ?? ""}
                disabled={sendPending || isPersonEmailLifecycleLocked({
                  onboardingStatus: onboardPerson.onboarding?.status,
                  screeningStatus: onboardPerson.screening?.status,
                })}
                onChange={(event) =>
                  setDraftEmails((current) => ({
                    ...current,
                    [onboardKey || ""]: event.target.value,
                  }))
                }
              />
              <p className="text-meta text-muted-foreground">{PERSON_EMAIL_HELP}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOnboardKey(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sendPending || !(draftEmails[onboardKey || ""] ?? onboardPerson?.email ?? "").trim()}
              onClick={async () => {
                if (!onboardPerson) return;
                await sendOnboarding(
                  onboardPerson,
                  draftEmails[onboardKey || ""] ?? onboardPerson.email ?? ""
                );
                setOnboardKey(null);
              }}
            >
              Send onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(platformRow)} onOpenChange={(open) => !open && setPlatformRowKey(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{platformRow?.name}</SheetTitle>
            <SheetDescription>Platform access only. This user is not a company person.</SheetDescription>
          </SheetHeader>
          {platformRow ? (
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-meta text-muted-foreground">Account Email</p>
                <p className="text-ui">{platformRow.accountEmail || "—"}</p>
              </div>
              <div>
                <p className="text-meta text-muted-foreground">Platform Access</p>
                <AccessBadge label={platformRow.platformAccess} />
              </div>
              <div>
                <p className="text-meta text-muted-foreground">Company Role</p>
                <p className="text-ui">None</p>
              </div>
              {canEdit && platformRow.userId && platformRow.platformAccess !== "Owner" ? (
                <div className="flex flex-col gap-2">
                  {platformRow.platformAccess === "User" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={managePending}
                      onClick={async () => {
                        setManagePending(true);
                        try {
                          const res = await api.patch(`${orgBase}/members/${platformRow.userId}/role`, {
                            role: "ORGANIZATION_ADMIN",
                          });
                          if (!res.success) {
                            toast.error(res.error.message);
                            return;
                          }
                          toast.success("Access updated to Admin");
                          await invalidate();
                        } finally {
                          setManagePending(false);
                        }
                      }}
                    >
                      Change to Admin
                    </Button>
                  ) : null}
                  {platformRow.platformAccess === "Admin" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={managePending}
                      onClick={async () => {
                        setManagePending(true);
                        try {
                          const res = await api.patch(`${orgBase}/members/${platformRow.userId}/role`, {
                            role: "ORGANIZATION_MEMBER",
                          });
                          if (!res.success) {
                            toast.error(res.error.message);
                            return;
                          }
                          toast.success("Access updated to User");
                          await invalidate();
                        } finally {
                          setManagePending(false);
                        }
                      }}
                    >
                      Change to User
                    </Button>
                  ) : null}
                  {platformRow.userId !== currentUserId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive"
                      onClick={() =>
                        setConfirm({ type: "remove", userId: platformRow.userId ?? undefined, name: platformRow.name })
                      }
                    >
                      Remove access
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {isOwnerViewer && platformRow.userId && platformRow.userId !== currentUserId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConfirm({ type: "transfer", userId: platformRow.userId ?? undefined, name: platformRow.name })
                  }
                >
                  Transfer ownership
                </Button>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(inactivating)}
        onOpenChange={(open) => {
          if (!open && !inactivatePending) setInactivatePartyId(null);
        }}
        title="Mark inactive"
        description="Mark this person as inactive? Their existing KYC, AML and onboarding history will be kept."
        confirmText="Mark inactive"
        isLoading={inactivatePending}
        onConfirm={async () => {
          if (!inactivating) return;
          setInactivatePending(true);
          try {
            const res = await api.inactivatePartyProfile(portal, organizationId, inactivating.id);
            if (!res.success) throw profileValidationErrorFromApi(res.error);
            toast.success("Person marked inactive");
            setInactivatePartyId(null);
            await invalidate();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not mark this person inactive");
          } finally {
            setInactivatePending(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirm?.type === "remove"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Remove access"
        description={`Remove CashSouk access for ${confirm?.name ?? "this user"}? The company person record, if any, will be kept.`}
        confirmText="Remove access"
        variant="destructive"
        isLoading={managePending}
        onConfirm={async () => {
          if (!confirm?.userId) return;
          setManagePending(true);
          try {
            const res = await api.delete(`${orgBase}/members/${confirm.userId}`);
            if (!res.success) {
              toast.error(res.error.message);
              return;
            }
            toast.success("Platform access removed");
            setConfirm(null);
            setPlatformRowKey(null);
            await invalidate();
          } finally {
            setManagePending(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirm?.type === "leave"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Leave organisation"
        description="Are you sure you want to leave this organisation? You will lose access and need a new invitation to return."
        confirmText="Leave"
        variant="destructive"
        isLoading={managePending}
        onConfirm={async () => {
          setManagePending(true);
          try {
            const res = await api.post(`${orgBase}/leave`);
            if (!res.success) {
              toast.error(res.error.message);
              return;
            }
            toast.success("Left organisation");
            setConfirm(null);
            await invalidate();
          } finally {
            setManagePending(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirm?.type === "cancel-invite"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Cancel invitation"
        description={`Cancel the invitation for ${confirm?.name ?? "this user"}?`}
        confirmText="Cancel invitation"
        variant="destructive"
        isLoading={managePending}
        onConfirm={async () => {
          if (!confirm?.invitationId) return;
          setManagePending(true);
          try {
            const res = await api.delete(`${orgBase}/invitations/${confirm.invitationId}`);
            if (!res.success) {
              toast.error(res.error.message);
              return;
            }
            toast.success("Invitation cancelled");
            setConfirm(null);
            await invalidate();
          } finally {
            setManagePending(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirm?.type === "transfer"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Transfer ownership"
        description={`Transfer CashSouk organisation ownership to ${confirm?.name ?? "this user"}? This changes platform ownership only. Company roles, shareholding, PIC, KYC and AML are unchanged.`}
        confirmText="Transfer ownership"
        isLoading={managePending}
        onConfirm={async () => {
          if (!confirm?.userId) return;
          setManagePending(true);
          try {
            const res = await api.post(`${orgBase}/transfer-ownership`, { newOwnerId: confirm.userId });
            if (!res.success) {
              toast.error(res.error.message);
              return;
            }
            toast.success("Ownership transferred");
            setConfirm(null);
            await invalidate();
          } finally {
            setManagePending(false);
          }
        }}
      />

    </div>
  );
}

function PeopleAccessTableRow({
  row,
  portal,
  canEdit,
  canInactivate,
  currentUserId,
  isOwnerViewer,
  blockOnboarding,
  onView,
  onInvite,
  onResend,
  onCancelInvite,
  onChangeRole,
  onRemove,
  onLeave,
  onTransfer,
  onInactivate,
  onSendOnboarding,
  onCopyInvite,
  onAdoptPeopleOnly,
  refreshing = false,
  onRefreshStatus,
}: {
  row: PeopleAccessRow;
  portal: PortalPeoplePortal;
  canEdit: boolean;
  canInactivate: boolean;
  currentUserId?: string | null;
  isOwnerViewer: boolean;
  blockOnboarding: boolean;
  onView: () => void;
  onInvite: () => void;
  onResend?: () => void | Promise<void>;
  onCancelInvite?: () => void;
  onChangeRole: (role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER") => void | Promise<void>;
  onRemove: () => void;
  onLeave: () => void;
  onTransfer: () => void;
  onInactivate: () => void;
  onSendOnboarding: () => void;
  onCopyInvite?: () => void;
  onAdoptPeopleOnly?: () => void;
  refreshing?: boolean;
  onRefreshStatus?: () => void;
}) {
  const isSelf = Boolean(currentUserId && row.userId === currentUserId);
  const isOwnerRow = row.platformAccess === "Owner";
  const missingCount =
    portal === "issuer" && row.party
      ? computeIssuerPersonCompleteness(
          issuerPersonCompletenessInputFromParty({
            ...row.party,
            kycOnboardingStatus: row.person?.onboarding?.status ?? null,
          })
        ).length
      : 0;
  const canSend =
    canEdit &&
    !blockOnboarding &&
    row.person != null &&
    canManageDirectorShareholder(row.person) &&
    getKycGroup(row.person.onboarding?.status ?? "") !== "IN_PROGRESS";
  const identityKey = normalizeDirectorShareholderIdKey(row.party?.identityNumber ?? row.partyKey ?? "");
  const showInvite =
    canEdit &&
    (row.platformAccess === "No access" || row.platformAccess === "Invitation expired") &&
    Boolean(row.partyId);
  const showChangeToAdmin =
    canEdit && Boolean(row.userId) && !isOwnerRow && row.platformAccess === "User";
  const showChangeToUser =
    canEdit && Boolean(row.userId) && !isOwnerRow && row.platformAccess === "Admin";
  const showRemove = canEdit && Boolean(row.userId) && !isOwnerRow && !isSelf;
  const showTransfer = isOwnerViewer && Boolean(row.userId) && !isSelf;
  const showLeave = isSelf && !isOwnerRow;
  const showInactivate = canInactivate && Boolean(row.partyId) && row.kind === "company_person";
  const hasOverflow =
    Boolean(onAdoptPeopleOnly) ||
    showInvite ||
    Boolean(canSend) ||
    Boolean(canEdit && onResend) ||
    Boolean(canEdit && onCopyInvite) ||
    Boolean(canEdit && onCancelInvite) ||
    showChangeToAdmin ||
    showChangeToUser ||
    showRemove ||
    showTransfer ||
    showLeave ||
    showInactivate;

  return (
    <tr
      data-person-key={identityKey}
      className="border-b last:border-0 odd:bg-muted/40 hover:bg-muted"
    >
      <td className="px-4 py-3 align-middle">
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          {missingCount > 0 ? (
            <p className="text-meta text-status-action-text">{missingCount} profile fields remaining</p>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="whitespace-normal">{row.companyRoleLine}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <AccessBadge label={row.platformAccess} />
      </td>
      <td className="px-4 py-3 align-middle">
        <PeopleAccessKycStatus
          row={row}
          canEdit={canEdit}
          refreshing={refreshing}
          onRefresh={onRefreshStatus}
        />
      </td>
      <td className="px-4 py-3 align-middle">
        <PeopleAccessAmlStatus
          row={row}
          canEdit={canEdit}
          refreshing={refreshing}
          onRefresh={onRefreshStatus}
        />
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={onView}>
            View
          </Button>
          {hasOverflow ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onAdoptPeopleOnly ? (
                <DropdownMenuItem onClick={onAdoptPeopleOnly}>Add to company profile</DropdownMenuItem>
              ) : null}
              {showInvite ? (
                <DropdownMenuItem onClick={onInvite}>Invite user</DropdownMenuItem>
              ) : null}
              {canSend ? <DropdownMenuItem onClick={onSendOnboarding}>Send KYC onboarding</DropdownMenuItem> : null}
              {canEdit && onResend ? <DropdownMenuItem onClick={() => void onResend()}>Resend invitation</DropdownMenuItem> : null}
              {canEdit && onCopyInvite ? <DropdownMenuItem onClick={onCopyInvite}>Copy invitation link</DropdownMenuItem> : null}
              {canEdit && onCancelInvite ? (
                <DropdownMenuItem onClick={onCancelInvite}>Cancel invitation</DropdownMenuItem>
              ) : null}
              {showChangeToAdmin ? (
                <DropdownMenuItem onClick={() => void onChangeRole("ORGANIZATION_ADMIN")}>
                  Change to Admin
                </DropdownMenuItem>
              ) : null}
              {showChangeToUser ? (
                <DropdownMenuItem onClick={() => void onChangeRole("ORGANIZATION_MEMBER")}>
                  Change to User
                </DropdownMenuItem>
              ) : null}
              {showRemove ? (
                <DropdownMenuItem onClick={onRemove}>Remove access</DropdownMenuItem>
              ) : null}
              {showTransfer ? (
                <DropdownMenuItem onClick={onTransfer}>Transfer ownership</DropdownMenuItem>
              ) : null}
              {showLeave ? <DropdownMenuItem onClick={onLeave}>Leave organisation</DropdownMenuItem> : null}
              {showInactivate ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onInactivate}>Mark inactive</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
