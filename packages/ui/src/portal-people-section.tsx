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
  getFinalStatusLabel,
  getFinalStatusToken,
  computeIssuerPersonCompleteness,
  issuerPersonCompletenessInputFromParty,
  isMissingGovernmentIdPerson,
  normalizeDirectorShareholderIdKey,
  normalizeDirectorShareholderPartyEmail,
  resolveDirectorShareholderCtosEmptyWarning,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
  type ApplicationPersonRow,
  type DirectorShareholderListSource,
  type OrganizationPartyProfileDto,
  profileValidationErrorFromApi,
} from "@cashsouk/types";
import { DirectorShareholderCtosEmptyAlert } from "./director-shareholder-ctos-empty-alert";
import { DirectorShareholderUnresolvedIdentitySection } from "./director-shareholder-unresolved-identity-card";
import { PartyProfileDetailFields, PartyRoleBadges } from "./party-profile-detail-fields";
import { StatusBadge } from "./components/status-badge";
import { Button } from "./components/button";
import { Input } from "./components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/dialog";
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
  const ctosEmpty = resolveDirectorShareholderCtosEmptyWarning({
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
            Directors, shareholders, board, and management. The same person can have more than one role.
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
          <PersonRow
            key={item.key}
            name={item.party.name || item.party.partyKey}
            party={item.party}
            person={item.person}
            missingCount={computeIssuerPersonCompleteness(issuerPersonCompletenessInputFromParty(item.party)).length}
            identityKey={item.party.identityNumber}
            draftEmail={draftEmails[item.key] ?? item.person?.email ?? ""}
            onDraftEmail={(value) => setDraftEmails((current) => ({ ...current, [item.key]: value }))}
            canSend={Boolean(item.person && !blockOnboarding && canManageDirectorShareholder(item.person))}
            sendPending={sendPending}
            onSend={() => item.person && sendOnboarding(item.person, draftEmails[item.key] ?? item.person.email ?? "")}
            onView={() => setViewPartyId(item.party.id)}
            onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}
            onInactivate={canInactivate ? () => setInactivatePartyId(item.party.id) : undefined}
          />
        ))}

        {peopleOnly.map((person) => (
              <PersonRow
                key={person.matchKey || person.name}
                name={person.name || "Unnamed"}
                person={person}
                identityKey={person.matchKey}
                draftEmail={draftEmails[person.matchKey || ""] ?? person.email ?? ""}
                onDraftEmail={(value) =>
                  setDraftEmails((current) => ({ ...current, [person.matchKey || ""]: value }))
                }
                canSend={!blockOnboarding && canManageDirectorShareholder(person)}
                sendPending={sendPending}
                onSend={() => sendOnboarding(person, draftEmails[person.matchKey || ""] ?? person.email ?? "")}
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
              <PersonRow
                key={item.key}
                name={item.party.name || item.party.partyKey}
                party={item.party}
                person={item.person}
                identityKey={item.party.identityNumber}
                draftEmail=""
                onDraftEmail={() => undefined}
                canSend={false}
                sendPending={false}
                onSend={() => undefined}
                onView={() => setViewPartyId(item.party.id)}
                inactive
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
            <PartyProfileDetailFields party={viewing} person={viewingPerson} />
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

function PersonRow({
  name,
  party,
  person,
  identityKey,
  draftEmail,
  onDraftEmail,
  canSend,
  sendPending,
  onSend,
  onView,
  onEdit,
  onInactivate,
  missingCount = 0,
  inactive = false,
}: {
  name: string;
  party?: OrganizationPartyProfileDto | null;
  person: ApplicationPersonRow | null;
  identityKey?: string | null;
  draftEmail: string;
  onDraftEmail: (value: string) => void;
  canSend: boolean;
  sendPending: boolean;
  onSend: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onInactivate?: () => void;
  missingCount?: number;
  inactive?: boolean;
}) {
  const corporate = party?.entityType === "CORPORATE";
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
          <PartyRoleBadges party={party} person={person} />
          {missingCount > 0 ? (
            <p className="text-meta text-status-action-text">
              {missingCount} {missingCount === 1 ? "field" : "fields"} missing
            </p>
          ) : null}
          {corporate ? (
            <p className="text-meta text-muted-foreground">Company shareholder. Individual KYC/AML is not required.</p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusBadge status={getFinalStatusToken(kyc.tone)} label={`KYC: ${kyc.label}`} />
              <StatusBadge status={getFinalStatusToken(aml.tone)} label={`AML: ${aml.label}`} />
              {inactive ? <StatusBadge status="neutral" label="Inactive" /> : null}
            </div>
          )}
          {corporate && inactive ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <StatusBadge status="neutral" label="Inactive" />
            </div>
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
              Edit
            </Button>
          ) : null}
          {onInactivate ? (
            <Button type="button" variant="outline" size="sm" onClick={onInactivate}>
              Mark inactive
            </Button>
          ) : null}
        </div>
      </div>
      {canSend && !corporate ? (
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
      ) : null}
    </div>
  );
}

