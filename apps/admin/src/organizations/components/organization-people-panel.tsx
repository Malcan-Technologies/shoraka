"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon, UserIcon, UsersIcon } from "@heroicons/react/24/outline";
import type { OrganizationDetailResponse, PortalType } from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { accountHref } from "@/lib/admin-directory-hrefs";
import { useOrganizationMasterPeople } from "@/organizations/hooks/use-organization-master-people";
import { unifyOrganizationPeople } from "@/organizations/utils/organization-profile-overview";
import { OrganizationCardEditActions } from "./organization-card-edit-actions";
import { OrganizationMemberEditDialog } from "./organization-member-edit-dialog";
import { OrganizationPersonCard } from "./organization-person-card";
import {
  OrganizationPersonEditorDialog,
  partyToEditorValues,
  type PartyEditorValues,
} from "./organization-person-editor-dialog";
import { EditableField, ReadField } from "./organization-profile-helpers";
import { useUpdateOrganizationProfile } from "@/organizations/hooks/use-update-organization-profile";
import {
  buildDraft,
  buildSectionPayload,
  SECTION_LABEL,
  type OrgProfileDraft,
} from "./organization-profile-payload";

export function OrganizationPeoplePanel({
  org,
  portal,
  organizationId,
  displayName,
  highlightedPartyId,
}: {
  org: OrganizationDetailResponse;
  portal: PortalType;
  organizationId: string;
  displayName: string;
  highlightedPartyId?: string | null;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const canViewAccounts = can("users.view");
  const canManageUsers = can("users.manage");
  const updateProfile = useUpdateOrganizationProfile();
  const peopleMutations = useOrganizationMasterPeople(portal, organizationId);

  const [editingPic, setEditingPic] = React.useState(false);
  const [draft, setDraft] = React.useState<OrgProfileDraft>(() => buildDraft(org));
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [editingMemberId, setEditingMemberId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingPartyId, setEditingPartyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editingPic) setDraft(buildDraft(org));
  }, [org, editingPic]);

  React.useEffect(() => {
    if (!highlightedPartyId) return;
    document.getElementById(`person-${highlightedPartyId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedPartyId]);

  const editingMember = org.members.find((member) => member.id === editingMemberId) ?? null;
  const showPic = canManage || Boolean(org.corporateOnboardingData?.personInCharge);
  const picHasChanges = Object.keys(buildSectionPayload(org, draft, "pic")).length > 0;
  const unified = unifyOrganizationPeople(org.partyProfiles, org.people);
  const editingParty = org.partyProfiles?.find((party) => party.id === editingPartyId) ?? null;

  const handleStartPicEdit = () => {
    if (updateProfile.isPending) return;
    setDraft(buildDraft(org));
    setEditingPic(true);
  };

  const handleCancelPic = () => {
    setDraft(buildDraft(org));
    setEditingPic(false);
  };

  const handleConfirmSave = async () => {
    const data = buildSectionPayload(org, draft, "pic");
    if (Object.keys(data).length === 0) {
      toast.error("No profile changes to save");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        portal,
        id: organizationId,
        data,
      });
      toast.success("Organization profile updated");
      setShowConfirm(false);
      setEditingPic(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update organization");
    }
  };

  const saveParty = async (values: PartyEditorValues, partyId?: string) => {
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      identityPrefix: values.identityPrefix || null,
      identityNumber: values.identityNumber.trim() || null,
      entityType: values.entityType,
      isDirector: values.isDirector,
      isShareholder: values.isShareholder,
      isBoard: values.isBoard,
      isManagement: values.isManagement,
      shareholdingPercentage: values.shareholdingPercentage.trim() || null,
      shareType: values.shareType || null,
    };
    if (partyId) {
      await peopleMutations.patchParty.mutateAsync({ partyId, data: payload });
      setEditingPartyId(null);
      return;
    }
    await peopleMutations.createParty.mutateAsync(payload);
    setAddOpen(false);
  };

  if (org.type !== "COMPANY") return null;

  return (
    <div className="space-y-6">
      <Card id="profile-people" className="rounded-2xl">
        <AdminDetailCardHeader
          icon={UsersIcon}
          title="People"
          description="Directors, shareholders, board, and management — one person, one master record"
          actions={
            canManage ? (
              <Button type="button" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <PlusIcon className="h-4 w-4" />
                Add person
              </Button>
            ) : null
          }
        />
        <CardContent className="space-y-6">
          {unified.external.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-card-title">External changes requiring review</h3>
              {unified.external.map((item) => (
                <div key={item.key} id={item.party ? `person-${item.party.id}` : undefined}>
                  <OrganizationPersonCard
                    item={item}
                    canManage={canManage}
                    onView={() => item.party && setEditingPartyId(item.party.id)}
                    onAdopt={item.party ? () => peopleMutations.adopt.mutate(item.party!.id) : undefined}
                  />
                </div>
              ))}
            </div>
          ) : null}

          {unified.master.length === 0 && unified.peopleOnly.length === 0 ? (
            <p className="text-ui text-muted-foreground">No people stored on the master record yet.</p>
          ) : null}

          {unified.master.map((item) => (
            <div key={item.key} id={item.party ? `person-${item.party.id}` : undefined}>
              <OrganizationPersonCard
                item={item}
                canManage={canManage}
                onView={() => item.party && setEditingPartyId(item.party.id)}
                onEdit={item.party ? () => setEditingPartyId(item.party!.id) : undefined}
                onKeep={
                  item.party
                    ? (field) => peopleMutations.resolve.mutate({ partyId: item.party!.id, action: "KEEP", field })
                    : undefined
                }
                onUseExternal={
                  item.party
                    ? (field) =>
                        peopleMutations.resolve.mutate({ partyId: item.party!.id, action: "USE_EXTERNAL", field })
                    : undefined
                }
                onInactivate={item.party ? () => peopleMutations.inactivate.mutate(item.party!.id) : undefined}
                onKeepAbsent={() => toast.success("Kept on the CashSouk master list")}
              />
            </div>
          ))}

          {unified.peopleOnly.map((item) => (
            <OrganizationPersonCard
              key={item.key}
              item={item}
              canManage={canManage}
              onView={() => toast.message("This person is linked from onboarding KYC and is not a separate profile.")}
            />
          ))}

          {unified.inactive.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-card-title">Inactive</h3>
              {unified.inactive.map((item) => (
                <OrganizationPersonCard
                  key={item.key}
                  item={item}
                  canManage={canManage}
                  onView={() => item.party && setEditingPartyId(item.party.id)}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <AdminDetailCardHeader icon={UsersIcon} title={`Members (${org.members.length})`} />
        <CardContent>
          {org.members.length > 0 ? (
            <div className="space-y-3">
              {org.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      {canViewAccounts ? (
                        <Link
                          href={accountHref(member.userId)}
                          className="text-ui font-medium hover:text-primary hover:underline"
                        >
                          {member.firstName} {member.lastName}
                        </Link>
                      ) : (
                        <div className="text-ui font-medium">
                          {member.firstName} {member.lastName}
                        </div>
                      )}
                      <div className="text-meta text-muted-foreground">{member.email}</div>
                      {member.phone ? (
                        <div className="text-meta text-muted-foreground">{member.phone}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {member.role.toLowerCase()}
                    </Badge>
                    {canManageUsers ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingMemberId(member.id)}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ui text-muted-foreground">No members found</p>
          )}
        </CardContent>
      </Card>

      {showPic ? (
        <Card className="rounded-2xl">
          <AdminDetailCardHeader
            icon={UserIcon}
            title="Person in charge"
            description="Main contact for this business"
            actions={
              <OrganizationCardEditActions
                canEdit={canManage}
                isEditing={editingPic}
                canSave={editingPic && picHasChanges}
                isSaving={updateProfile.isPending}
                onEdit={handleStartPicEdit}
                onCancel={handleCancelPic}
                onSave={() => setShowConfirm(true)}
              />
            }
          />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingPic ? (
                <>
                  <EditableField
                    label="Name"
                    value={draft.picName}
                    onChange={(picName) => setDraft((current) => ({ ...current, picName }))}
                  />
                  <EditableField
                    label="Position"
                    value={draft.picPosition}
                    onChange={(picPosition) => setDraft((current) => ({ ...current, picPosition }))}
                  />
                  <EditableField
                    label="Email"
                    value={draft.picEmail}
                    onChange={(picEmail) => setDraft((current) => ({ ...current, picEmail }))}
                  />
                  <EditableField
                    label="Contact Number"
                    value={draft.picContactNumber}
                    onChange={(picContactNumber) =>
                      setDraft((current) => ({ ...current, picContactNumber }))
                    }
                  />
                </>
              ) : (
                <>
                  <ReadField label="Name" value={org.corporateOnboardingData?.personInCharge?.name} />
                  <ReadField
                    label="Position"
                    value={org.corporateOnboardingData?.personInCharge?.position}
                  />
                  <ReadField
                    label="Email"
                    value={org.corporateOnboardingData?.personInCharge?.email}
                  />
                  <ReadField
                    label="Contact Number"
                    value={org.corporateOnboardingData?.personInCharge?.contactNumber}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <OrganizationMemberEditDialog
        member={editingMember}
        open={editingMemberId != null}
        onOpenChange={(open) => {
          if (!open) setEditingMemberId(null);
        }}
      />

      <OrganizationPersonEditorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add person"
        description="Adds this person to the CashSouk master record used by the issuer or investor profile."
        isSaving={peopleMutations.createParty.isPending}
        onSave={(values) => saveParty(values)}
      />

      <OrganizationPersonEditorDialog
        open={Boolean(editingParty)}
        onOpenChange={(open) => {
          if (!open) setEditingPartyId(null);
        }}
        title={editingParty?.name || "Person"}
        description="Edits the same CashSouk master record the issuer or investor sees."
        initial={editingParty ? partyToEditorValues(editingParty) : null}
        isSaving={peopleMutations.patchParty.isPending}
        onSave={(values) => saveParty(values, editingParty?.id)}
      />

      <AlertDialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!updateProfile.isPending) setShowConfirm(open);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save changes to {SECTION_LABEL.pic} for{" "}
              <strong>{displayName}</strong>? This will update the organization profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateProfile.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmSave();
              }}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
