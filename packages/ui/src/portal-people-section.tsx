"use client";

import * as React from "react";
import { toast } from "sonner";
import { PlusIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  canManageDirectorShareholder,
  findExistingPartyForIdentityKey,
  formatPartyRoleLine,
  formatPeopleRolesLine,
  filterVisiblePeopleRows,
  computeIssuerPersonCompleteness,
  issuerPersonCompletenessInputFromParty,
  isMissingGovernmentIdPerson,
  normalizeDirectorShareholderIdKey,
  normalizeDirectorShareholderPartyEmail,
  PERSON_EMAIL_HELP,
  resolveCustomerDirectorShareholderEmptyWarning,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
  type ApplicationPersonRow,
  type DirectorShareholderListSource,
  type OrganizationPartyProfileDto,
  profileValidationErrorFromApi,
} from "@cashsouk/types";
import { DirectorShareholderCtosEmptyAlert } from "./director-shareholder-ctos-empty-alert";
import { DirectorShareholderUnresolvedIdentitySection } from "./director-shareholder-unresolved-identity-card";
import { CustomerPartyProfileOverview } from "./people-access/customer-person-overview";
import { PersonIdentityCard } from "./person-identity-card";
import { InviteMemberDialog } from "./invite-member-dialog";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { Label } from "./components/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/select";
import { Tabs, TabsList, TabsTrigger } from "./components/tabs";
import { ConfirmDialog } from "./components/confirm-dialog";
import { AddPersonForm, PartyFillEmptyForm, type AddPersonInitial } from "./portal-person-forms";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type PortalPeoplePortal = "issuer" | "investor";

type PeopleFilter = "all" | "directors" | "shareholders" | "board" | "management";

function matchesFilter(party: OrganizationPartyProfileDto, filter: PeopleFilter): boolean {
  if (filter === "all") return true;
  if (filter === "directors") return party.isDirector;
  if (filter === "shareholders") return party.isShareholder;
  if (filter === "board") return party.isBoard;
  return party.isManagement;
}

function personMatchesFilter(person: ApplicationPersonRow, filter: PeopleFilter): boolean {
  if (filter === "all") return true;
  const roles = (person.roles ?? []).map((role) => role.toUpperCase());
  if (filter === "directors") return roles.includes("DIRECTOR");
  if (filter === "shareholders") return roles.includes("SHAREHOLDER");
  if (filter === "board") return roles.includes("BOARD");
  return roles.includes("MANAGEMENT");
}

function matchPersonToParty(
  person: ApplicationPersonRow,
  parties: OrganizationPartyProfileDto[]
): OrganizationPartyProfileDto | undefined {
  const identity = person.matchKey?.trim();
  if (!identity) return undefined;
  return parties.find((party) =>
    Boolean(
      findExistingPartyForIdentityKey(
        [
          {
            partyKey: party.partyKey,
            identityNumber: party.identityNumber,
            entityType: party.entityType,
          },
        ],
        identity,
        { entityType: person.entityType }
      )
    )
  );
}

export function PortalPeopleSection({
  portal,
  organizationId,
  organizationOnboardingStatus,
  people,
  directorShareholderListSource,
  ctosDirectorShareholderWarning,
  focusedMatchKey,
  canEdit,
  canInactivate = false,
  onChanged,
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
  onChanged?: () => void | Promise<void>;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const [filter, setFilter] = React.useState<PeopleFilter>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [addInitial, setAddInitial] = React.useState<AddPersonInitial | null>(null);
  const [viewPartyId, setViewPartyId] = React.useState<string | null>(null);
  const [viewPeopleOnlyKey, setViewPeopleOnlyKey] = React.useState<string | null>(null);
  const [editPartyId, setEditPartyId] = React.useState<string | null>(null);
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [sendPending, setSendPending] = React.useState(false);
  const [parties, setParties] = React.useState<OrganizationPartyProfileDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inactivatePartyId, setInactivatePartyId] = React.useState<string | null>(null);
  const [inactivatePending, setInactivatePending] = React.useState(false);
  const [invitePartyId, setInvitePartyId] = React.useState<string | null>(null);
  const [managePartyId, setManagePartyId] = React.useState<string | null>(null);
  const [onboardKey, setOnboardKey] = React.useState<string | null>(null);
  const [invitePending, setInvitePending] = React.useState(false);
  const [generateLinkPending, setGenerateLinkPending] = React.useState(false);
  const [managePending, setManagePending] = React.useState(false);

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
  const visiblePeople = filterVisiblePeopleRows(people);
  const matchedKeys = new Set<string>();
  const activeParties = parties.filter((party) => party.membershipStatus === "MASTER_ACTIVE");
  const inactiveParties = parties.filter((party) => party.membershipStatus === "MASTER_INACTIVE");
  const personForParty = (party: OrganizationPartyProfileDto): ApplicationPersonRow | null => {
    const person = visiblePeople.find((row) => {
      if (!row.matchKey) return false;
      const hit = matchPersonToParty(row, [party]);
      if (hit && row.matchKey) matchedKeys.add(row.matchKey);
      return Boolean(hit);
    });
    return person ?? null;
  };
  const masterCards = activeParties.filter((party) => matchesFilter(party, filter)).map((party) => {
    return { key: party.id, party, person: personForParty(party) };
  });
  const inactiveCards = inactiveParties.filter((party) => matchesFilter(party, filter)).map((party) => {
    return { key: party.id, party, person: personForParty(party) };
  });
  const peopleOnly = visiblePeople.filter(
    (person) =>
      person.matchKey &&
      !matchedKeys.has(person.matchKey) &&
      !matchPersonToParty(person, parties) &&
      !isMissingGovernmentIdPerson(person) &&
      personMatchesFilter(person, filter)
  );
  const unresolvedPeople = visiblePeople.filter((person) => isMissingGovernmentIdPerson(person));
  const ctosEmpty = resolveCustomerDirectorShareholderEmptyWarning({
    directorShareholderListSource,
    ctosDirectorShareholderWarning,
  });
  const inactivating = parties.find((party) => party.id === inactivatePartyId) ?? null;
  const viewing = parties.find((party) => party.id === viewPartyId) ?? null;
  const viewingPerson =
    masterCards.find((item) => item.party.id === viewPartyId)?.person ??
    inactiveCards.find((item) => item.party.id === viewPartyId)?.person ??
    peopleOnly.find((person) => person.matchKey === viewPeopleOnlyKey) ??
    null;
  const editing =
    parties.find(
      (party) => party.id === editPartyId && party.membershipStatus === "MASTER_ACTIVE"
    ) ?? null;
  const inviteParty = parties.find((party) => party.id === invitePartyId) ?? null;
  const manageParty = parties.find((party) => party.id === managePartyId) ?? null;
  const onboardPerson =
    masterCards.find((item) => item.party.id === onboardKey)?.person ??
    peopleOnly.find((person) => person.matchKey === onboardKey) ??
    null;
  const blockOnboarding = organizationOnboardingStatus !== "COMPLETED";

  React.useEffect(() => {
    const norm = normalizeDirectorShareholderIdKey(focusedMatchKey ?? "");
    if (!norm) return;
    const el = document.querySelector<HTMLElement>(`[data-person-key="${norm}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedMatchKey, parties]);

  const invalidate = async () => {
    await loadParties();
    await onChanged?.();
  };

  const orgBase = `/v1/organizations/${portal}/${organizationId}`;

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
      const saveRes = await api.patch(`${orgBase}/ctos-party-email`, {
        partyKey,
        email,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error.message);
        return;
      }
      const sendRes = await api.post(`${orgBase}/send-director-onboarding`, {
        partyKey,
      });
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

  return (
    <div id="profile-people" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">People</h2>
          <p className="text-ui text-muted-foreground">
            Directors, shareholders, board, and management. Platform access is optional.
          </p>
        </div>
        {canEdit ? (
          <Button type="button" size="sm" className="h-8 gap-1.5 rounded-xl" onClick={() => {
            setAddInitial(null);
            setAddOpen(true);
          }}>
            <PlusIcon className="h-4 w-4" />
            Add person
          </Button>
        ) : null}
      </div>
      <div className="space-y-4 p-6">
        {ctosEmpty ? <DirectorShareholderCtosEmptyAlert message={ctosEmpty} /> : null}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as PeopleFilter)}>
          <TabsList className="h-9">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="directors">Directors</TabsTrigger>
            <TabsTrigger value="shareholders">Shareholders</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? <p className="text-ui text-muted-foreground">Loading…</p> : null}
        {!loading &&
        masterCards.length === 0 &&
        peopleOnly.length === 0 &&
        unresolvedPeople.length === 0 &&
        inactiveCards.length === 0 ? (
          <p className="text-ui text-muted-foreground">No people have been added yet.</p>
        ) : null}

        {masterCards.map((item) => (
          <PersonIdentityCard
            key={item.key}
            name={item.party.name || item.party.partyKey}
            party={item.party}
            person={item.person}
            missingCount={
              portal === "issuer"
                ? computeIssuerPersonCompleteness(
                    issuerPersonCompletenessInputFromParty({
                      ...item.party,
                      kycOnboardingStatus: item.person?.onboarding?.status ?? null,
                    })
                  ).length
                : 0
            }
            identityKey={normalizeDirectorShareholderIdKey(item.party.identityNumber ?? "")}
            canSendOnboarding={Boolean(
              canEdit && item.person && !blockOnboarding && canManageDirectorShareholder(item.person)
            )}
            canManagePlatform={canEdit}
            onView={() => setViewPartyId(item.party.id)}
            onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}
            onInactivate={canInactivate ? () => setInactivatePartyId(item.party.id) : undefined}
            onSendOnboarding={() => {
              setDraftEmails((current) => ({
                ...current,
                [item.party.id]: current[item.party.id] ?? item.person?.email ?? "",
              }));
              setOnboardKey(item.party.id);
            }}
            onInviteToPlatform={() => setInvitePartyId(item.party.id)}
            onResendInvitation={
              item.party.platformAccess.invitationId
                ? async () => {
                    const res = await api.post(
                      `${orgBase}/invitations/${item.party.platformAccess.invitationId}/resend`
                    );
                    if (!res.success) {
                      toast.error(res.error.message);
                      return;
                    }
                    toast.success("Invitation resent");
                    await invalidate();
                  }
                : undefined
            }
            onManageAccess={() => setManagePartyId(item.party.id)}
          />
        ))}

        {peopleOnly.map((person) => (
              <PersonIdentityCard
                key={person.matchKey || person.name}
                name={person.name || "Unnamed"}
                person={person}
                identityKey={normalizeDirectorShareholderIdKey(person.matchKey ?? "")}
                canSendOnboarding={canEdit && !blockOnboarding && canManageDirectorShareholder(person)}
                onView={() => setViewPeopleOnlyKey(person.matchKey)}
                onEdit={
                  canEdit
                    ? () => {
                        const roles = (person.roles ?? []).map((role) => role.toUpperCase());
                        setAddInitial({
                          name: person.name ?? "",
                          identityNumber: person.matchKey,
                          email: person.email ?? "",
                          entityType: person.entityType,
                          isDirector: roles.includes("DIRECTOR"),
                          isShareholder: roles.includes("SHAREHOLDER"),
                          isBoard: roles.includes("BOARD"),
                          isManagement: roles.includes("MANAGEMENT"),
                          shareholdingPercentage:
                            person.sharePercentage != null ? String(person.sharePercentage) : "",
                        });
                        setAddOpen(true);
                      }
                    : undefined
                }
                onSendOnboarding={() => {
                  setDraftEmails((current) => ({
                    ...current,
                    [person.matchKey || ""]: current[person.matchKey || ""] ?? person.email ?? "",
                  }));
                  setOnboardKey(person.matchKey);
                }}
              />
            ))}

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

        {inactiveCards.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-card-title">Inactive</h3>
            <p className="text-meta text-muted-foreground">
              This person is no longer active on the current profile.
            </p>
            {inactiveCards.map((item) => (
              <PersonIdentityCard
                key={item.key}
                name={item.party.name || item.party.partyKey}
                party={item.party}
                person={item.person}
                identityKey={normalizeDirectorShareholderIdKey(item.party.identityNumber ?? "")}
                inactive
                onView={() => setViewPartyId(item.party.id)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddInitial(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{addInitial ? "Edit person" : "Add person"}</DialogTitle>
            <DialogDescription>
              {addInitial
                ? "Add this person to the company profile. Existing details are kept if they are already filled."
                : "Add this person to the company profile."}
            </DialogDescription>
          </DialogHeader>
          <AddPersonForm
            initial={addInitial}
            onCancel={() => {
              setAddOpen(false);
              setAddInitial(null);
            }}
            onSave={async (data) => {
              const res = await api.createManagementParty(portal, organizationId, data);
              if (!res.success) throw profileValidationErrorFromApi(res.error);
              toast.success("Person added");
              setAddOpen(false);
              await invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewing) || Boolean(viewPeopleOnlyKey)}
        onOpenChange={(open) => {
          if (!open) {
            setViewPartyId(null);
            setViewPeopleOnlyKey(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name || viewingPerson?.name || "Person"}</DialogTitle>
            <DialogDescription>
              {viewing ? formatPartyRoleLine(viewing) : "Onboarding details for this person"}
            </DialogDescription>
          </DialogHeader>
          {viewing || viewingPerson ? (
            <CustomerPartyProfileOverview party={viewing} person={viewingPerson} />
          ) : null}
          {canEdit &&
          viewing &&
          viewing.entityType !== "CORPORATE" &&
          viewing.membershipStatus === "MASTER_ACTIVE" ? (
            <div className="space-y-2">
              <Label htmlFor="onboarding-email">Email</Label>
              <Input
                id="onboarding-email"
                type="email"
                value={draftEmails[viewing.id] ?? viewing.email ?? viewingPerson?.email ?? ""}
                onChange={(event) =>
                  setDraftEmails((current) => ({ ...current, [viewing.id]: event.target.value }))
                }
              />
              <p className="text-meta text-muted-foreground">
                {PERSON_EMAIL_HELP}
              </p>
              {viewing.linkedUser?.email ? (
                <p className="text-meta text-muted-foreground">
                  Platform login email: {viewing.linkedUser.email}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={async () => {
                  const email = draftEmails[viewing.id] ?? viewing.email ?? viewingPerson?.email ?? "";
                  const saveRes = await api.patch(`${orgBase}/ctos-party-email`, {
                    partyKey: viewing.partyKey,
                    email,
                  });
                  if (!saveRes.success) {
                    toast.error(saveRes.error.message);
                    return;
                  }
                  toast.success("Email saved");
                  await invalidate();
                }}
              >
                Save email
              </Button>
            </div>
          ) : null}
          {canEdit && viewing?.membershipStatus === "MASTER_ACTIVE" ? (
            <Button
              className="h-10"
              onClick={() => {
                setEditPartyId(viewing.id);
                setViewPartyId(null);
              }}
            >
              Edit
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditPartyId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit person</DialogTitle>
            <DialogDescription>Update this person’s details on the company profile.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <PartyFillEmptyForm
              party={editing}
              onCancel={() => setEditPartyId(null)}
              onSave={async (data) => {
                const res = await api.patchPartyProfile(portal, organizationId, editing.id, data);
                if (!res.success) throw profileValidationErrorFromApi(res.error);
                toast.success("Person updated");
                setEditPartyId(null);
                await invalidate();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <InviteMemberDialog
        portalType={portal}
        open={Boolean(inviteParty)}
        onOpenChange={(open) => {
          if (!open) setInvitePartyId(null);
        }}
        personContext={
          inviteParty
            ? {
                partyProfileId: inviteParty.id,
                personName: inviteParty.name || inviteParty.partyKey,
                defaultEmail:
                  masterCards.find((item) => item.party.id === inviteParty.id)?.person?.email ||
                  inviteParty.linkedUser?.email ||
                  "",
                linkedLoginEmail: inviteParty.linkedUser?.email || "",
                restoreExistingLink: inviteParty.platformAccess.status === "NO_PLATFORM_ACCESS",
              }
            : undefined
        }
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
                toast.success(
                  inviteParty?.platformAccess.status === "NO_PLATFORM_ACCESS"
                    ? "Platform access restored for the linked account"
                    : "Platform access linked to this person"
                );
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
        Dialog={Dialog}
        DialogContent={DialogContent}
        DialogDescription={DialogDescription}
        DialogFooter={DialogFooter}
        DialogHeader={DialogHeader}
        DialogTitle={DialogTitle}
        Button={Button}
        Input={Input}
        Label={Label}
        Select={Select}
        SelectTrigger={SelectTrigger}
        SelectValue={SelectValue}
        SelectContent={SelectContent}
        SelectItem={SelectItem}
      />

      <Dialog open={Boolean(onboardPerson)} onOpenChange={(open) => !open && setOnboardKey(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send onboarding</DialogTitle>
            <DialogDescription>
              KYC/AML onboarding is separate from platform access. Person Email is not the platform login email.
            </DialogDescription>
          </DialogHeader>
          {onboardPerson ? (
            <div className="space-y-2">
              <Label htmlFor="send-onboarding-email">Email</Label>
              <Input
                id="send-onboarding-email"
                type="email"
                value={draftEmails[onboardKey || ""] ?? onboardPerson.email ?? ""}
                disabled={sendPending}
                onChange={(event) =>
                  setDraftEmails((current) => ({
                    ...current,
                    [onboardKey || ""]: event.target.value,
                  }))
                }
              />
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

      <Dialog open={Boolean(manageParty)} onOpenChange={(open) => !open && !managePending && setManagePartyId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage platform access</DialogTitle>
            <DialogDescription>
              Platform membership is separate from this person’s company role. Removing access does not mark them inactive.
            </DialogDescription>
          </DialogHeader>
          {manageParty ? (
            <p className="text-ui">
              {manageParty.name || manageParty.partyKey} · {manageParty.platformAccess.label}
            </p>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {manageParty?.platformAccess.memberRole === "ORGANIZATION_MEMBER" ? (
              <Button
                type="button"
                variant="outline"
                disabled={managePending || !manageParty.userId}
                onClick={async () => {
                  if (!manageParty.userId) return;
                  setManagePending(true);
                  try {
                    const res = await api.patch(`${orgBase}/members/${manageParty.userId}/role`, {
                      role: "ORGANIZATION_ADMIN",
                    });
                    if (!res.success) {
                      toast.error(res.error.message);
                      return;
                    }
                    toast.success("Role updated to Organization Admin");
                    setManagePartyId(null);
                    await invalidate();
                  } finally {
                    setManagePending(false);
                  }
                }}
              >
                Make admin
              </Button>
            ) : null}
            {manageParty?.platformAccess.memberRole === "ORGANIZATION_ADMIN" ? (
              <Button
                type="button"
                variant="outline"
                disabled={managePending || !manageParty.userId}
                onClick={async () => {
                  if (!manageParty.userId) return;
                  setManagePending(true);
                  try {
                    const res = await api.patch(`${orgBase}/members/${manageParty.userId}/role`, {
                      role: "ORGANIZATION_MEMBER",
                    });
                    if (!res.success) {
                      toast.error(res.error.message);
                      return;
                    }
                    toast.success("Role updated to Organization Member");
                    setManagePartyId(null);
                    await invalidate();
                  } finally {
                    setManagePending(false);
                  }
                }}
              >
                Make member
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              disabled={managePending || !manageParty?.userId}
              onClick={async () => {
                if (!manageParty?.userId) return;
                setManagePending(true);
                try {
                  const res = await api.delete(`${orgBase}/members/${manageParty.userId}`);
                  if (!res.success) {
                    toast.error(res.error.message);
                    return;
                  }
                  toast.success("Platform access removed. This person remains on the company profile.");
                  setManagePartyId(null);
                  await invalidate();
                } finally {
                  setManagePending(false);
                }
              }}
            >
              Remove platform access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

