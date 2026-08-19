"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IdentificationIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { UserDetailResponse } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { AdminCardEditActions, AdminDetailCardHeader } from "@/components/admin-detail";
import { EditUserDialog } from "@/components/edit-user-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useUpdateUserId,
  useUpdateUserOnboarding,
  useUpdateUserProfile,
} from "@/hooks/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { accountHref } from "@/lib/admin-directory-hrefs";
import {
  EditableField,
  ReadField,
} from "@/organizations/components/organization-profile-helpers";
import {
  buildOnboardingPayload,
  buildUserAccountDraft,
  hasOnboardingChanges,
  hasProfileChanges,
  normalizeUserId,
  sectionHasChanges,
  userIdValidationMessage,
  type UserAccountDraft,
  type UserAccountSection,
} from "@/accounts/utils/user-account-draft";

function OnboardingFlagRow({
  label,
  description,
  checked,
  isEditing,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  isEditing: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
      <div>
        <div className="text-ui font-medium">{label}</div>
        <div className="text-meta text-muted-foreground">{description}</div>
      </div>
      {isEditing ? (
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      ) : (
        <StatusBadge label={checked ? "Yes" : "No"} status={checked ? "success" : "neutral"} />
      )}
    </div>
  );
}

export function UserAccountProfilePanel({
  user,
  routeUserId,
}: {
  user: UserDetailResponse;
  routeUserId: string;
}) {
  const { can } = usePermissions();
  const canManage = can("users.manage");
  const router = useRouter();
  const updateUserId = useUpdateUserId();
  const updateProfile = useUpdateUserProfile();
  const updateOnboarding = useUpdateUserOnboarding();

  const [editingSection, setEditingSection] = React.useState<UserAccountSection | null>(null);
  const [draft, setDraft] = React.useState<UserAccountDraft>(() => buildUserAccountDraft(user));
  const [showConfirm, setShowConfirm] = React.useState(false);

  React.useEffect(() => {
    if (!editingSection) setDraft(buildUserAccountDraft(user));
  }, [user, editingSection]);

  const original = buildUserAccountDraft(user);
  const isSaving =
    updateUserId.isPending || updateProfile.isPending || updateOnboarding.isPending;
  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.email;

  const handleStartEdit = (section: UserAccountSection) => {
    if (isSaving || (editingSection && editingSection !== section)) return;
    setDraft(buildUserAccountDraft(user));
    setEditingSection(section);
  };

  const handleCancel = () => {
    setDraft(buildUserAccountDraft(user));
    setEditingSection(null);
  };

  const requestSave = () => {
    if (editingSection === "profile") {
      const error = userIdValidationMessage(draft.userId);
      if (error) {
        toast.error(error);
        return;
      }
      if (!hasProfileChanges(draft, original)) {
        toast.error("No profile changes to save");
        return;
      }
    }
    if (editingSection === "onboarding" && !hasOnboardingChanges(draft, original)) {
      toast.error("No onboarding changes to save");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!editingSection) return;
    const currentUserId = user.user_id ?? routeUserId;
    const nextUserId = normalizeUserId(draft.userId);

    try {
      let effectiveUserId = currentUserId;
      if (editingSection === "profile") {
        if (nextUserId !== currentUserId) {
          const result = await updateUserId.mutateAsync({
            userId: currentUserId,
            newUserId: nextUserId,
          });
          effectiveUserId = result.user_id;
        }
        if (
          draft.firstName !== original.firstName ||
          draft.lastName !== original.lastName ||
          draft.phone !== original.phone
        ) {
          await updateProfile.mutateAsync({
            userId: effectiveUserId,
            data: {
              firstName: draft.firstName,
              lastName: draft.lastName,
              phone: draft.phone.trim() || null,
            },
          });
        }
      } else {
        await updateOnboarding.mutateAsync({
          userId: effectiveUserId,
          data: buildOnboardingPayload(draft, original),
        });
      }

      setShowConfirm(false);
      setEditingSection(null);
      toast.success("User updated successfully");
      if (effectiveUserId !== routeUserId) {
        router.replace(accountHref(effectiveUserId));
      }
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update user");
    }
  };

  const sectionActions = (section: UserAccountSection) => (
    <AdminCardEditActions
      canEdit={canManage && (editingSection === null || editingSection === section)}
      isEditing={editingSection === section}
      canSave={editingSection === section && sectionHasChanges(section, draft, original)}
      isSaving={isSaving}
      onEdit={() => handleStartEdit(section)}
      onCancel={handleCancel}
      onSave={requestSave}
    />
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <AdminDetailCardHeader
          icon={IdentificationIcon}
          title="Profile"
          description="Name, phone, and user ID"
          actions={sectionActions("profile")}
        />
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {editingSection === "profile" ? (
              <>
                <EditableField
                  label="User ID"
                  value={draft.userId}
                  maxLength={5}
                  inputClassName="font-mono uppercase"
                  onChange={(userId) =>
                    setDraft((current) => ({
                      ...current,
                      userId: userId.toUpperCase().slice(0, 5),
                    }))
                  }
                />
                <EditableField
                  label="First name"
                  value={draft.firstName}
                  onChange={(firstName) => setDraft((current) => ({ ...current, firstName }))}
                />
                <EditableField
                  label="Last name"
                  value={draft.lastName}
                  onChange={(lastName) => setDraft((current) => ({ ...current, lastName }))}
                />
                <EditableField
                  label="Phone"
                  value={draft.phone}
                  onChange={(phone) => setDraft((current) => ({ ...current, phone }))}
                />
              </>
            ) : (
              <>
                <ReadField
                  label="User ID"
                  value={user.user_id ? <span className="font-mono">{user.user_id}</span> : null}
                />
                <ReadField label="First name" value={user.first_name} />
                <ReadField label="Last name" value={user.last_name} />
                <ReadField label="Phone" value={user.phone} />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <AdminDetailCardHeader
          icon={ShieldCheckIcon}
          title="Portal access"
          description="Controls the investor and issuer roles and onboarding flags."
          actions={sectionActions("onboarding")}
        />
        <CardContent className="grid gap-4 md:grid-cols-2">
          <OnboardingFlagRow
            label="Investor onboarding"
            description="Controls the investor role and onboarding flag."
            checked={editingSection === "onboarding" ? draft.investorOnboarded : original.investorOnboarded}
            isEditing={editingSection === "onboarding"}
            onCheckedChange={(investorOnboarded) =>
              setDraft((current) => ({ ...current, investorOnboarded }))
            }
          />
          <OnboardingFlagRow
            label="Issuer onboarding"
            description="Controls the issuer role and onboarding flag."
            checked={editingSection === "onboarding" ? draft.issuerOnboarded : original.issuerOnboarded}
            isEditing={editingSection === "onboarding"}
            onCheckedChange={(issuerOnboarded) =>
              setDraft((current) => ({ ...current, issuerOnboarded }))
            }
          />
        </CardContent>
      </Card>

      <EditUserDialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!isSaving) setShowConfirm(open);
        }}
        userName={displayName}
        onConfirm={handleConfirmSave}
      />
    </div>
  );
}
