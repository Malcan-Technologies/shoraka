"use client";

import * as React from "react";
import { toast } from "sonner";
import type { OrganizationDetailResponse, PortalType } from "@cashsouk/types";
import {
  firstIssueMessage,
  humanizeApiValidationMessage,
  isProfileValidationError,
  optionalEmailIssue,
  phoneFormatIssue,
  picContactsDiffer,
  PROFILE_LABEL,
  validateIssuerContactPersonForm,
} from "@cashsouk/types";
import { UserIcon } from "@heroicons/react/24/outline";
import { AdminDetailCardHeader } from "@/components/admin-detail";
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
import { OrganizationCardEditActions } from "./organization-card-edit-actions";
import { EditableField, EditablePhoneField, ReadField } from "./organization-profile-helpers";
import { useUpdateOrganizationProfile } from "@/organizations/hooks/use-update-organization-profile";
import { usePermissions } from "@/hooks/use-permissions";
import {
  buildDraft,
  buildSectionPayload,
  SECTION_LABEL,
  type OrgProfileDraft,
} from "./organization-profile-payload";

export function OrganizationPicCard({
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
  const updateProfile = useUpdateOrganizationProfile();
  const [editingPic, setEditingPic] = React.useState(false);
  const [draft, setDraft] = React.useState<OrgProfileDraft>(() => buildDraft(org));
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [picFieldErrors, setPicFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!editingPic) setDraft(buildDraft(org));
  }, [org, editingPic]);

  const contact = org.corporateOnboardingData?.contactPerson;
  const picEvidence = org.corporateOnboardingData?.personInCharge;
  if (org.type !== "COMPANY") return null;

  const issuerContact = portal === "issuer";
  const picEmailLabel = PROFILE_LABEL.personEmail;
  const picPhoneLabel = PROFILE_LABEL.phone;
  const picHasChanges = Object.keys(buildSectionPayload(org, draft, "pic")).length > 0;
  const differs = picContactsDiffer(contact, picEvidence);
  const evidencePresent = Boolean(
    picEvidence?.name || picEvidence?.email || picEvidence?.contactNumber || picEvidence?.position
  );

  const handleStartPicEdit = () => {
    if (updateProfile.isPending) return;
    setDraft(buildDraft(org));
    setEditingPic(true);
    setPicFieldErrors({});
  };

  const handleCancelPic = () => {
    setDraft(buildDraft(org));
    setEditingPic(false);
    setPicFieldErrors({});
  };

  const handleSavePic = () => {
    const issues = issuerContact
      ? validateIssuerContactPersonForm({
          email: draft.picEmail,
          contact: draft.picContactNumber,
        })
      : [
          optionalEmailIssue(draft.picEmail, "picEmail", PROFILE_LABEL.email),
          phoneFormatIssue(draft.picContactNumber, "picContactNumber", PROFILE_LABEL.phone),
        ].filter((issue): issue is NonNullable<typeof issue> => Boolean(issue));
    if (issues.length > 0) {
      setPicFieldErrors(Object.fromEntries(issues.map((issue) => [issue.field, issue.message])));
      toast.error(firstIssueMessage(issues) ?? issues[0]?.message);
      return;
    }
    setPicFieldErrors({});
    setShowConfirm(true);
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
      setPicFieldErrors({});
    } catch (error) {
      if (isProfileValidationError(error) && Object.keys(error.fieldErrors).length > 0) {
        const next = { ...error.fieldErrors };
        if (error.fieldErrors["corporateOnboardingData.contactPerson.contact"]) {
          next.picContactNumber = error.fieldErrors["corporateOnboardingData.contactPerson.contact"];
        }
        if (error.fieldErrors["corporateOnboardingData.contactPerson.email"]) {
          next.picEmail = error.fieldErrors["corporateOnboardingData.contactPerson.email"];
        }
        if (error.fieldErrors["contactPersonEmail"]) {
          next.picEmail = error.fieldErrors["contactPersonEmail"];
        }
        if (error.fieldErrors["contactPersonPhone"]) {
          next.picContactNumber = error.fieldErrors["contactPersonPhone"];
        }
        setPicFieldErrors(next);
        setShowConfirm(false);
      }
      toast.error(
        error instanceof Error ? humanizeApiValidationMessage(error.message) : "Failed to update organization"
      );
    }
  };

  return (
    <Card id={portal === "issuer" ? "profile-contact" : "profile-pic"} className="rounded-2xl">
      <AdminDetailCardHeader
        icon={UserIcon}
        title="Person in Charge"
        description="Main company contact. Not a director, shareholder, or platform user unless they also separately appear in People & Access."
        actions={
          <OrganizationCardEditActions
            canEdit={canManage}
            isEditing={editingPic}
            canSave={editingPic && picHasChanges}
            isSaving={updateProfile.isPending}
            onEdit={handleStartPicEdit}
            onCancel={handleCancelPic}
            onSave={handleSavePic}
          />
        }
      />
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-card-title">Current contact</h3>
            <p className="mt-1 text-meta text-muted-foreground">Saved company contact on this profile.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editingPic ? (
                <>
                  <EditableField
                    label={PROFILE_LABEL.fullName}
                    value={draft.picName}
                    onChange={(picName) => setDraft((current) => ({ ...current, picName }))}
                  />
                  <EditableField
                    label={PROFILE_LABEL.position}
                    value={draft.picPosition}
                    onChange={(picPosition) => setDraft((current) => ({ ...current, picPosition }))}
                  />
                  <EditableField
                    label={picEmailLabel}
                    value={draft.picEmail}
                    onChange={(picEmail) => setDraft((current) => ({ ...current, picEmail }))}
                    maxLength={255}
                    required={issuerContact}
                    error={picFieldErrors.picEmail || picFieldErrors.contactPersonEmail}
                  />
                  <EditablePhoneField
                    label={picPhoneLabel}
                    value={draft.picContactNumber}
                    onChange={(picContactNumber) =>
                      setDraft((current) => ({ ...current, picContactNumber }))
                    }
                    required={issuerContact}
                    error={picFieldErrors.picContactNumber || picFieldErrors.contactPersonPhone}
                  />
                </>
              ) : (
                <>
                  <ReadField label={PROFILE_LABEL.fullName} value={contact?.name} />
                  <ReadField label={PROFILE_LABEL.position} value={contact?.position} />
                  <ReadField label={picEmailLabel} value={contact?.email} />
                  <ReadField label={picPhoneLabel} value={contact?.contact} />
                </>
              )}
            </div>
          </div>

          {evidencePresent ? (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-card-title">RegTank evidence</h3>
                  <p className="mt-1 text-meta text-muted-foreground">
                    Read-only person-in-charge details from RegTank. This is not the saved current contact.
                  </p>
                </div>
                {differs ? (
                  <p className="text-meta text-status-action-text">Differs from current contact</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ReadField label={PROFILE_LABEL.fullName} value={picEvidence?.name} />
                <ReadField label={PROFILE_LABEL.position} value={picEvidence?.position} />
                <ReadField label={PROFILE_LABEL.personEmail} value={picEvidence?.email} />
                <ReadField label={PROFILE_LABEL.phone} value={picEvidence?.contactNumber} />
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>

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
    </Card>
  );
}
