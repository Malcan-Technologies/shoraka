"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  canManageDirectorShareholder,
  findExistingPartyForIdentityKey,
  formatPartyRoleLine,
  formatPeopleRolesLine,
  formatPeopleRolesLineTitleCase,
  filterVisiblePeopleRows,
  getFinalStatusLabel,
  getFinalStatusToken,
  isMissingGovernmentIdPerson,
  normalizeDirectorShareholderIdKey,
  normalizeDirectorShareholderPartyEmail,
  resolveDirectorShareholderCtosEmptyWarning,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
  type ApplicationPersonRow,
  type DirectorShareholderListSource,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import {
  DirectorShareholderCtosEmptyAlert,
  DirectorShareholderUnresolvedIdentitySection,
  StatusBadge,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileCard } from "./profile-card";
import { AddPersonForm, PartyDetailFields, PartyFillEmptyForm } from "./issuer-person-forms";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
        [{ partyKey: party.partyKey, identityNumber: party.identityNumber }],
        identity
      )
    )
  );
}

export function IssuerPeopleSection({
  organizationId,
  organizationOnboardingStatus,
  people,
  directorShareholderListSource,
  ctosDirectorShareholderWarning,
  focusedMatchKey,
  canEdit,
  onChanged,
}: {
  organizationId: string;
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  directorShareholderListSource?: DirectorShareholderListSource | null;
  ctosDirectorShareholderWarning?: string | null;
  focusedMatchKey?: string | null;
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<PeopleFilter>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [viewPartyId, setViewPartyId] = React.useState<string | null>(null);
  const [editPartyId, setEditPartyId] = React.useState<string | null>(null);
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [sendPending, setSendPending] = React.useState(false);

  const query = useQuery({
    queryKey: ["issuer", "party-profiles", organizationId],
    queryFn: async () => {
      const res = await api.getPartyProfiles("issuer", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data.filter((party) => party.membershipStatus === "MASTER_ACTIVE");
    },
  });

  const parties = query.data ?? [];
  const visiblePeople = filterVisiblePeopleRows(people);
  const matchedKeys = new Set<string>();
  const masterCards = parties.filter((party) => matchesFilter(party, filter)).map((party) => {
    const person = visiblePeople.find((row) => {
      if (!row.matchKey) return false;
      const hit = matchPersonToParty(row, [party]);
      if (hit && row.matchKey) matchedKeys.add(row.matchKey);
      return Boolean(hit);
    });
    return { key: party.id, party, person: person ?? null };
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
  const ctosEmpty = resolveDirectorShareholderCtosEmptyWarning({
    directorShareholderListSource,
    ctosDirectorShareholderWarning,
  });
  const viewing = parties.find((party) => party.id === viewPartyId) ?? null;
  const editing = parties.find((party) => party.id === editPartyId) ?? null;
  const blockOnboarding = organizationOnboardingStatus !== "COMPLETED";

  React.useEffect(() => {
    const norm = normalizeDirectorShareholderIdKey(focusedMatchKey ?? "");
    if (!norm) return;
    const el = document.querySelector<HTMLElement>(`[data-person-key="${norm}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedMatchKey, parties]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["issuer", "party-profiles", organizationId] });
    await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", organizationId] });
    await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
    await onChanged?.();
  };

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
      const saveRes = await api.patch(`/v1/organizations/issuer/${organizationId}/ctos-party-email`, {
        partyKey,
        email,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error.message);
        return;
      }
      const sendRes = await api.post(`/v1/organizations/issuer/${organizationId}/send-director-onboarding`, {
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
    <ProfileCard
      id="profile-people"
      title="People"
      description="Directors, shareholders, board, and management — one person, one record"
      action={
        canEdit ? (
          <Button type="button" size="sm" className="h-8 gap-1.5 rounded-xl" onClick={() => setAddOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Add person
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
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

        {query.isLoading ? <p className="text-ui text-muted-foreground">Loading…</p> : null}
        {!query.isLoading &&
        masterCards.length === 0 &&
        peopleOnly.length === 0 &&
        unresolvedPeople.length === 0 ? (
          <p className="text-ui text-muted-foreground">No people stored on the company record yet.</p>
        ) : null}

        {masterCards.map((item) => (
          <PersonRow
            key={item.key}
            name={item.party.name || item.party.partyKey}
            roles={formatPartyRoleLine(item.party)}
            person={item.person}
            identityKey={item.party.identityNumber}
            draftEmail={draftEmails[item.key] ?? item.person?.email ?? ""}
            onDraftEmail={(value) => setDraftEmails((current) => ({ ...current, [item.key]: value }))}
            canSend={Boolean(item.person && !blockOnboarding && canManageDirectorShareholder(item.person))}
            sendPending={sendPending}
            onSend={() => item.person && sendOnboarding(item.person, draftEmails[item.key] ?? item.person.email ?? "")}
            onView={() => setViewPartyId(item.party.id)}
            onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}
          />
        ))}

        {peopleOnly.map((person) => (
              <PersonRow
                key={person.matchKey || person.name}
                name={person.name || "Unnamed"}
                roles={formatPeopleRolesLineTitleCase({
                  roles: person.roles ?? [],
                  sharePercentage: person.sharePercentage ?? null,
                })}
                person={person}
                identityKey={person.matchKey}
                draftEmail={draftEmails[person.matchKey || ""] ?? person.email ?? ""}
                onDraftEmail={(value) =>
                  setDraftEmails((current) => ({ ...current, [person.matchKey || ""]: value }))
                }
                canSend={!blockOnboarding && canManageDirectorShareholder(person)}
                sendPending={sendPending}
                onSend={() => sendOnboarding(person, draftEmails[person.matchKey || ""] ?? person.email ?? "")}
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
              const result = await api.patch(`/v1/organizations/issuer/${organizationId}/unresolved-identity`, payload);
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
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
            <DialogDescription>Adds someone to the CashSouk company record.</DialogDescription>
          </DialogHeader>
          <AddPersonForm
            onCancel={() => setAddOpen(false)}
            onSave={async (data) => {
              const res = await api.createManagementParty("issuer", organizationId, data);
              if (!res.success) throw new Error(res.error.message);
              toast.success("Person added");
              setAddOpen(false);
              await invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewPartyId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name || "Person"}</DialogTitle>
            <DialogDescription>{viewing ? formatPartyRoleLine(viewing) : ""}</DialogDescription>
          </DialogHeader>
          {viewing ? <PartyDetailFields party={viewing} /> : null}
          {canEdit && viewing ? (
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
            <DialogDescription>Fill empty fields only. Existing values stay as they are.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <PartyFillEmptyForm
              party={editing}
              onCancel={() => setEditPartyId(null)}
              onSave={async (data) => {
                const res = await api.patchPartyProfile("issuer", organizationId, editing.id, data);
                if (!res.success) throw new Error(res.error.message);
                toast.success("Person updated");
                setEditPartyId(null);
                await invalidate();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </ProfileCard>
  );
}

function PersonRow({
  name,
  roles,
  person,
  identityKey,
  draftEmail,
  onDraftEmail,
  canSend,
  sendPending,
  onSend,
  onView,
  onEdit,
}: {
  name: string;
  roles: string;
  person: ApplicationPersonRow | null;
  identityKey?: string | null;
  draftEmail: string;
  onDraftEmail: (value: string) => void;
  canSend: boolean;
  sendPending: boolean;
  onSend: () => void;
  onView?: () => void;
  onEdit?: () => void;
}) {
  const kyc = person
    ? getFinalStatusLabel(person, { displayMode: "kyc_only" })
    : { label: "—", tone: "neutral" as const };
  const aml = person
    ? getFinalStatusLabel({ screening: person.screening })
    : { label: "—", tone: "neutral" as const };
  const needsEmail = canSend && !draftEmail.trim();

  return (
    <div
      data-person-key={normalizeDirectorShareholderIdKey(identityKey ?? "") ?? undefined}
      className="space-y-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-ui font-medium">{name}</p>
          <p className="text-meta text-muted-foreground">{roles || "—"}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusBadge status={getFinalStatusToken(kyc.tone)} label={`KYC: ${kyc.label}`} />
            <StatusBadge status={getFinalStatusToken(aml.tone)} label={`AML: ${aml.label}`} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onView ? (
            <Button type="button" variant="outline" size="sm" onClick={onView}>
              View details
            </Button>
          ) : null}
          {onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </div>
      </div>
      {canSend ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="email"
            className="h-10 text-ui sm:max-w-xs"
            placeholder={needsEmail ? "Add email" : "Email"}
            value={draftEmail}
            disabled={sendPending}
            onChange={(event) => onDraftEmail(event.target.value)}
          />
          <Button
            type="button"
            className="h-10"
            disabled={sendPending || !draftEmail.trim()}
            onClick={onSend}
          >
            Send onboarding
          </Button>
        </div>
      ) : person?.email ? (
        <p className="text-meta text-muted-foreground">{person.email}</p>
      ) : null}
    </div>
  );
}

