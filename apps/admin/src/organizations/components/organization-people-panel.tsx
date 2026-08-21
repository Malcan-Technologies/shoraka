"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  normalizeDirectorShareholderIdKey,
  type OrganizationDetailResponse,
  type PortalType,
} from "@cashsouk/types";
import {
  ArrowPathIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { DirectorShareholderTable } from "@/components/admin/director-shareholder-table";
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
import { useRefreshCorporateEntities } from "@/hooks/use-organization-detail";
import { usePermissions } from "@/hooks/use-permissions";
import { accountHref } from "@/lib/admin-directory-hrefs";
import { formatApiErrorMessage } from "@/lib/format-api-error-message";
import { OrganizationCardEditActions } from "./organization-card-edit-actions";
import { OrganizationMemberEditDialog } from "./organization-member-edit-dialog";
import { EditableField, ReadField } from "./organization-profile-helpers";
import { useUpdateOrganizationProfile } from "@/organizations/hooks/use-update-organization-profile";
import {
  buildDraft,
  buildSectionPayload,
  SECTION_LABEL,
  type OrgProfileDraft,
} from "./organization-profile-payload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function OrganizationPeoplePanel({
  org,
  portal,
  organizationId,
  displayName,
}: {
  org: OrganizationDetailResponse;
  portal: PortalType;
  organizationId: string;
  displayName: string;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const canViewAccounts = can("users.view");
  const canManageUsers = can("users.manage");
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const updateProfile = useUpdateOrganizationProfile();
  const refreshEntities = useRefreshCorporateEntities();

  const [editingPic, setEditingPic] = React.useState(false);
  const [draft, setDraft] = React.useState<OrgProfileDraft>(() => buildDraft(org));
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [ctosFetchSubjectKey, setCtosFetchSubjectKey] = React.useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editingPic) setDraft(buildDraft(org));
  }, [org, editingPic]);

  const editingMember = org.members.find((member) => member.id === editingMemberId) ?? null;
  const showPic = canManage || Boolean(org.corporateOnboardingData?.personInCharge);
  const picHasChanges = Object.keys(buildSectionPayload(org, draft, "pic")).length > 0;

  const fetchSubjectCtosMutation = useMutation({
    mutationFn: async (input: {
      subjectRef: string;
      subjectKind: "INDIVIDUAL" | "CORPORATE";
      displayName: string;
      idNumber: string;
    }) => {
      const idNumber = input.idNumber.trim();
      const subjectName = input.displayName.trim();
      if (!idNumber || !subjectName) {
        throw new Error("Missing display name or IC/SSM");
      }
      const res = await apiClient.createAdminOrganizationCtosSubjectReport(
        portal as "issuer" | "investor",
        organizationId,
        {
          subjectRef: input.subjectRef,
          subjectKind: input.subjectKind,
          enquiryOverride: { displayName: subjectName, idNumber },
        }
      );
      if (!res.success) throw new Error(formatApiErrorMessage(res.error));
      return res.data;
    },
    onMutate: (input) => {
      setCtosFetchSubjectKey(input.subjectRef);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ["admin", "organization-detail", portal, organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "organization-ctos-reports-inline", portal, organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "organization-ctos-reports", portal, organizationId],
      });
      toast.success("CTOS subject report saved.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "CTOS subject request failed");
    },
    onSettled: () => {
      setCtosFetchSubjectKey(null);
    },
  });

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

  if (org.type !== "COMPANY") return null;

  return (
    <div className="space-y-6">
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

      <Card className="rounded-2xl">
        <AdminDetailCardHeader
          icon={UsersIcon}
          title="Directors and Shareholders"
          description="Directors and shareholders details"
          actions={
            canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={refreshEntities.isPending}
                onClick={() => {
                  refreshEntities.mutate(
                    { organizationId, portal },
                    {
                      onSuccess: (result) => {
                        toast.success(result.message || "Corporate entities refreshed.");
                      },
                      onError: (error) => {
                        toast.error(error instanceof Error ? error.message : "Refresh failed");
                      },
                    }
                  );
                }}
              >
                <ArrowPathIcon className={refreshEntities.isPending ? "animate-spin" : undefined} />
                Refresh
              </Button>
            ) : null
          }
        />
        <CardContent>
          <DirectorShareholderTable
            people={org.people ?? []}
            directorShareholderListSource={org.directorShareholderListSource ?? null}
            ctosDirectorShareholderWarning={org.ctosDirectorShareholderWarning ?? null}
            portal={portal === "investor" ? "investor" : "issuer"}
            organizationId={organizationId}
            subjectCtosReports={org.latestOrganizationCtosSubjectReports ?? null}
            ctosFetchPendingKey={ctosFetchSubjectKey}
            ctosFetchPending={fetchSubjectCtosMutation.isPending}
            canManageCtos={canManage}
            onFetchSubjectCtos={(person) => {
              if (!canManage) return;
              const idKey = normalizeDirectorShareholderIdKey(person.matchKey);
              if (!idKey) {
                toast.error("Missing IC / SSM. Cannot fetch CTOS report.");
                return;
              }
              const subjectName = person.name?.trim();
              if (!subjectName) {
                toast.error("Missing name. Cannot fetch CTOS report.");
                return;
              }
              fetchSubjectCtosMutation.mutate({
                subjectRef: idKey,
                subjectKind: person.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
                displayName: subjectName,
                idNumber: idKey,
              });
            }}
          />
        </CardContent>
      </Card>

      <OrganizationMemberEditDialog
        member={editingMember}
        open={editingMemberId != null}
        onOpenChange={(open) => {
          if (!open) setEditingMemberId(null);
        }}
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
