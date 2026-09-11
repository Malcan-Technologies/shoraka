"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { EllipsisHorizontalIcon, UsersIcon } from "@heroicons/react/24/outline";
import type { OrganizationDetailResponse, PortalType } from "@cashsouk/types";
import {
  ADMIN_PEOPLE_ACCESS_FILTERS,
  adminPeopleAccessCtosBadgeStatus,
  adminPeopleAccessRowNeedsAttention,
  buildAdminPeopleAccessRows,
  filterAdminPeopleAccessRows,
  getRelatedPartyStatusToken,
  isAdminPeopleAccessFilter,
  isIssuerShareholderOnlyBelowMinimum,
  observedPartyBlockedByIdentityConflict,
  peopleAccessAmlChipPresentation,
  peopleAccessKycChipPresentation,
  peopleAccessPlatformBadgeStatus,
  relatedPartyVerificationCaption,
  type AdminPeopleAccessFilter,
  type AdminPeopleAccessRow,
  type PeopleAccessMember,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrganizationMasterPeople } from "@/organizations/hooks/use-organization-master-people";
import { adminActionRowClass } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { OrganizationMemberEditDialog } from "./organization-member-edit-dialog";
import { OrganizationPeopleAccessDetail } from "./organization-people-access-detail";
import {
  OrganizationPersonEditorDialog,
  partyToEditorValues,
  type PartyEditorValues,
} from "./organization-person-editor-dialog";
import { adminMayInactivateMasterParty } from "@/organizations/utils/organization-profile-overview";

const FILTER_LABEL: Record<AdminPeopleAccessFilter, string> = {
  all: "All",
  company: "Company people",
  platform: "Platform access",
  pending: "Pending",
  "ctos-review": "CTOS review",
  inactive: "Inactive",
};

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function CellDash({ children }: { children: React.ReactNode }) {
  if (children === "—" || children == null || children === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  return <>{children}</>;
}

export function OrganizationPeopleAccessPanel({
  org,
  portal,
  organizationId,
  selectedKey,
  filter,
  drawerEnabled = true,
  onSelectedKeyChange,
  onFilterChange,
}: {
  org: OrganizationDetailResponse;
  portal: PortalType;
  organizationId: string;
  selectedKey: string | null;
  filter: AdminPeopleAccessFilter;
  drawerEnabled?: boolean;
  onSelectedKeyChange: (key: string | null) => void;
  onFilterChange: (filter: AdminPeopleAccessFilter) => void;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const canViewAccounts = can("users.view");
  const canManageUsers = can("users.manage");
  const peopleMutations = useOrganizationMasterPeople(portal, organizationId);
  const [search, setSearch] = React.useState("");
  const [editingPartyId, setEditingPartyId] = React.useState<string | null>(null);
  const [editingMemberUserId, setEditingMemberUserId] = React.useState<string | null>(null);

  const members: PeopleAccessMember[] = org.members.map((member) => ({
    id: member.userId,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    role: member.role,
  }));

  const built = React.useMemo(
    () =>
      buildAdminPeopleAccessRows({
        parties: org.partyProfiles,
        people: org.people,
        members,
        owner: org.owner,
      }),
    [members, org.owner, org.partyProfiles, org.people]
  );
  const allRows = React.useMemo(() => [...built.active, ...built.inactive], [built]);
  const rows = React.useMemo(
    () => filterAdminPeopleAccessRows(allRows, filter, search),
    [allRows, filter, search]
  );
  const selected = allRows.find((row) => row.key === selectedKey) ?? null;

  React.useEffect(() => {
    if (selectedKey && !allRows.some((row) => row.key === selectedKey)) {
      onSelectedKeyChange(null);
    }
  }, [allRows, onSelectedKeyChange, selectedKey]);

  const editingParty = org.partyProfiles?.find((party) => party.id === editingPartyId) ?? null;
  const editingMember = org.members.find((member) => member.userId === editingMemberUserId) ?? null;

  const saveParty = async (values: PartyEditorValues, partyId: string) => {
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      identityPrefix: values.entityType === "CORPORATE" ? "ROC" : values.identityPrefix || null,
      identityNumber: values.identityNumber.trim() || null,
      entityType: values.entityType,
      isDirector: values.isDirector,
      isShareholder: values.isShareholder,
      isBoard: values.isBoard,
      isManagement: values.isManagement,
      gender: values.entityType === "CORPORATE" ? "NOT_APPLICABLE" : values.gender || null,
      salutation: values.entityType === "CORPORATE" ? null : values.salutation.trim() || null,
      nationality: values.nationality.trim() || null,
      countryOfIncorporation: values.countryOfIncorporation.trim() || null,
      dateOfBirth: values.dateOfBirth || null,
      dateOfIncorporation: values.dateOfIncorporation || null,
      address:
        values.line1 || values.line2 || values.state || values.postalCode
          ? {
              line1: values.line1.trim() || null,
              line2: values.line2.trim() || null,
              state: values.state || null,
              postalCode: values.postalCode.trim() || null,
            }
          : null,
      shareholdingPercentage: values.shareholdingPercentage.trim() || null,
      shareType: values.shareType || null,
      shareTypeOther: values.shareType === "OTHERS" ? values.shareTypeOther.trim() || null : null,
      shareholdingUnits: values.shareholdingUnits.trim() || null,
      shareholdingAmount: values.shareholdingAmount.trim() || null,
      designation: values.designation || null,
      designationOther: values.designation === "OTHERS" ? values.designationOther.trim() || null : null,
      appointmentDate: values.appointmentDate || null,
      resignationDate: values.resignationDate || null,
      email: values.email.trim() || null,
    };
    await peopleMutations.patchParty.mutateAsync({ partyId, data: payload });
    setEditingPartyId(null);
  };

  const detail = selected ? (
    <OrganizationPeopleAccessDetail
      row={selected}
      org={org}
      canManage={canManage}
      canViewAccounts={canViewAccounts}
      canManageUsers={canManageUsers}
      applyIssuerComrep={portal === "issuer"}
      onEdit={selected.party ? () => setEditingPartyId(selected.party!.id) : undefined}
      onAdopt={selected.party ? () => peopleMutations.adopt.mutate(selected.party!.id) : undefined}
      onInactivate={selected.party ? () => peopleMutations.inactivate.mutate(selected.party!.id) : undefined}
      onKeep={
        selected.party
          ? (field) => peopleMutations.resolve.mutate({ partyId: selected.party!.id, action: "KEEP", field })
          : undefined
      }
      onUseExternal={
        selected.party
          ? (field) => peopleMutations.resolve.mutate({ partyId: selected.party!.id, action: "USE_EXTERNAL", field })
          : undefined
      }
      onKeepOnboardingIdentity={
        selected.party
          ? () =>
              peopleMutations.resolveIdentityConflict.mutate({
                partyId: selected.party!.id,
                action: "KEEP_ONBOARDING",
              })
          : undefined
      }
      onKeepCtosPerson={
        selected.party
          ? () =>
              peopleMutations.resolveIdentityConflict.mutate({
                partyId: selected.party!.id,
                action: "KEEP_CTOS",
              })
          : undefined
      }
      onEditMember={selected.userId ? () => setEditingMemberUserId(selected.userId) : undefined}
    />
  ) : null;

  return (
    <div>
      <Card id="profile-people" className="rounded-2xl">
        <AdminDetailCardHeader
          icon={UsersIcon}
          title="People & Access"
          description="Company role is regulatory. Platform access is login. Owner is the platform organisation owner, not a shareholder."
        />
        <CardContent className="space-y-4 p-0 pb-4">
          <div className="flex flex-wrap gap-2 px-6">
            {ADMIN_PEOPLE_ACCESS_FILTERS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                className="rounded-full"
                onClick={() => onFilterChange(value)}
              >
                {FILTER_LABEL[value]}
              </Button>
            ))}
          </div>
          <div className="px-6">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or identity"
              aria-label="Search people"
            />
          </div>
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-ui text-muted-foreground">
              {allRows.length === 0
                ? "No people or platform users have been added yet."
                : "No people match this filter."}
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-10 bg-card">Name</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Company Role</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">Platform Access</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">KYC/KYB</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">AML</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-card">CTOS</TableHead>
                    <TableHead className="sticky top-0 z-10 w-20 bg-card">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <PeopleAccessTableRow
                      key={row.key}
                      row={row}
                      org={org}
                      selected={row.key === selectedKey}
                      canManage={canManage}
                      canManageUsers={canManageUsers}
                      onSelect={() => onSelectedKeyChange(row.key)}
                      onEdit={() => row.party && setEditingPartyId(row.party.id)}
                      onAdopt={() => row.party && peopleMutations.adopt.mutate(row.party.id)}
                      onInactivate={() => row.party && peopleMutations.inactivate.mutate(row.party.id)}
                      onEditMember={() => row.userId && setEditingMemberUserId(row.userId)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={drawerEnabled && Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && drawerEnabled) onSelectedKeyChange(null);
        }}
      >
        <SheetContent
          aria-label="Selected person"
          className="flex w-full flex-col overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selected?.name ?? "Person"}</SheetTitle>
            <SheetDescription>Selected person details</SheetDescription>
          </SheetHeader>
          <div className="mt-4 min-w-0">{detail}</div>
        </SheetContent>
      </Sheet>

      <OrganizationPersonEditorDialog
        open={Boolean(editingParty)}
        onOpenChange={(open) => {
          if (!open) setEditingPartyId(null);
        }}
        title={editingParty?.name || "Person"}
        description="Update this person’s details on the company profile."
        initial={editingParty ? partyToEditorValues(editingParty) : null}
        isSaving={peopleMutations.patchParty.isPending}
        enforceIssuerShareholderMinimum
        onSave={async (values) => {
          if (!editingParty) return;
          await saveParty(values, editingParty.id);
        }}
      />

      <OrganizationMemberEditDialog
        member={editingMember}
        open={Boolean(editingMember)}
        onOpenChange={(open) => {
          if (!open) setEditingMemberUserId(null);
        }}
      />
    </div>
  );
}

function PeopleAccessTableRow({
  row,
  org,
  selected,
  canManage,
  canManageUsers,
  onSelect,
  onEdit,
  onAdopt,
  onInactivate,
  onEditMember,
}: {
  row: AdminPeopleAccessRow;
  org: OrganizationDetailResponse;
  selected: boolean;
  canManage: boolean;
  canManageUsers: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onAdopt: () => void;
  onInactivate: () => void;
  onEditMember: () => void;
}) {
  const kycPresentation = peopleAccessKycChipPresentation(row.person);
  const amlPresentation = peopleAccessAmlChipPresentation(row.person);
  const accessStatus = row.platformAccess === "—" ? null : peopleAccessPlatformBadgeStatus(row.platformAccess);
  const ctosStatus = adminPeopleAccessCtosBadgeStatus(row.ctos);
  const needsAction = adminPeopleAccessRowNeedsAttention(row);
  const party = row.party;
  const belowMinimumShareholder = isIssuerShareholderOnlyBelowMinimum({
    isShareholder: party?.isShareholder ?? false,
    isDirector: party?.isDirector ?? false,
    isBoard: party?.isBoard ?? false,
    isManagement: party?.isManagement ?? false,
    shareholdingPercentage: party?.shareholdingPercentage,
  });
  const conflictBlocksAdopt =
    Boolean(party) &&
    observedPartyBlockedByIdentityConflict({
      observedPartyId: party!.id,
      observedPartyKey: party!.partyKey,
      parties: org.partyProfiles ?? [],
    });
  const showAdopt = canManage && row.observed && !belowMinimumShareholder && !conflictBlocksAdopt;
  const showEdit = canManage && !row.observed && !row.inactive && row.kind !== "people_only" && row.kind !== "platform_only";
  const showInactivate = canManage && adminMayInactivateMasterParty(party);
  const showMemberEdit =
    row.kind === "platform_only" &&
    canManageUsers &&
    Boolean(row.userId) &&
    org.members.some((member) => member.userId === row.userId);

  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        selected && "bg-muted",
        adminActionRowClass(needsAction)
      )}
      onClick={onSelect}
    >
      <TableCell className="max-w-[180px]">
        <div className="truncate font-medium">{row.name}</div>
        {row.kind === "people_only" ? (
          <div className="text-meta text-status-action-text">Not on current profile</div>
        ) : null}
      </TableCell>
      <TableCell className="max-w-[160px] whitespace-normal">
        <CellDash>{row.companyRoleLine}</CellDash>
      </TableCell>
      <TableCell>
        {accessStatus ? <StatusBadge status={accessStatus} label={row.platformAccess} /> : <CellDash>—</CellDash>}
      </TableCell>
      <TableCell>
        {kycPresentation ? (
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-meta text-muted-foreground">
              {relatedPartyVerificationCaption(row.person?.entityType ?? row.party?.entityType)}
            </span>
            <StatusBadge
              status={getRelatedPartyStatusToken(kycPresentation, "admin")}
              label={kycPresentation.label}
            />
          </div>
        ) : (
          <CellDash>—</CellDash>
        )}
      </TableCell>
      <TableCell>
        {amlPresentation ? (
          <StatusBadge
            status={getRelatedPartyStatusToken(amlPresentation, "admin")}
            label={amlPresentation.label}
          />
        ) : (
          <CellDash>—</CellDash>
        )}
      </TableCell>
      <TableCell>
        {ctosStatus ? <StatusBadge status={ctosStatus} label={row.ctos} /> : <CellDash>—</CellDash>}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Actions for ${row.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <EllipsisHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onClick={onSelect}>View</DropdownMenuItem>
            {showAdopt ? <DropdownMenuItem onClick={onAdopt}>Adopt</DropdownMenuItem> : null}
            {showEdit ? <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem> : null}
            {showInactivate ? <DropdownMenuItem onClick={onInactivate}>Mark inactive</DropdownMenuItem> : null}
            {showMemberEdit ? <DropdownMenuItem onClick={onEditMember}>Edit name and phone</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function usePeopleAccessUrlState(): {
  selectedKey: string | null;
  filter: AdminPeopleAccessFilter;
  setSelectedKey: (key: string | null) => void;
  setFilter: (filter: AdminPeopleAccessFilter) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedKey, setSelectedKeyState] = React.useState<string | null>(() => readParam("person"));
  const [filter, setFilterState] = React.useState<AdminPeopleAccessFilter>(() => {
    const value = readParam("filter");
    return isAdminPeopleAccessFilter(value) ? value : "all";
  });

  React.useEffect(() => {
    const syncFromUrl = () => {
      setSelectedKeyState(readParam("person"));
      const value = readParam("filter");
      setFilterState(isAdminPeopleAccessFilter(value) ? value : "all");
    };
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const write = React.useCallback(
    (nextPerson: string | null, nextFilter: AdminPeopleAccessFilter) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (nextPerson) params.set("person", nextPerson);
      else params.delete("person");
      if (nextFilter !== "all") params.set("filter", nextFilter);
      else params.delete("filter");
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === href) return;
      router.push(href, { scroll: false });
    },
    [pathname, router]
  );

  return {
    selectedKey,
    filter,
    setSelectedKey: (key) => {
      setSelectedKeyState(key);
      write(key, filter);
    },
    setFilter: (next) => {
      setFilterState(next);
      write(selectedKey, next);
    },
  };
}
