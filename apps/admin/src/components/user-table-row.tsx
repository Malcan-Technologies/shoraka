"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import {
  useUpdateUserRoles,
  useUpdateUserKyc,
  useUpdateUserOnboarding,
  useUpdateUserProfile,
} from "../hooks/use-users";
import type { UserRole } from "@cashsouk/types";
import { EditUserDialog } from "./edit-user-dialog";
import { EditUserIdDialog } from "./edit-user-id-dialog";

interface User {
  id: string;
  user_id?: string | null;
  email: string;
  cognito_sub: string;
  cognito_username: string;
  roles: UserRole[];
  first_name: string;
  last_name: string;
  phone: string | null;
  email_verified: boolean;
  kyc_verified: boolean;
  investor_onboarding_completed: boolean;
  issuer_onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserTableRowProps {
  user: User;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updatedUser: Partial<User>) => void;
  onCancel: () => void;
}

const roleColors: Record<string, string> = {
  INVESTOR: "bg-blue-100 text-blue-800 border-blue-200",
  ISSUER: "bg-purple-100 text-purple-800 border-purple-200",
  ADMIN: "bg-red-100 text-red-800 border-red-200",
};

export function UserTableRow({ user, isEditing, onEdit, onSave, onCancel }: UserTableRowProps) {
  const [editedUser, setEditedUser] = React.useState<Partial<User>>(user);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [showEditUserIdDialog, setShowEditUserIdDialog] = React.useState(false);
  const updateRoles = useUpdateUserRoles();
  const updateKyc = useUpdateUserKyc();
  const updateOnboarding = useUpdateUserOnboarding();
  const updateProfile = useUpdateUserProfile();

  React.useEffect(() => {
    if (isEditing) {
      setEditedUser(user);
      // Reset dialog state when entering edit mode
      setShowConfirmDialog(false);
      setIsConfirming(false);
    }
  }, [isEditing, user]);

  const handleSaveClick = () => {
    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleCancel = () => {
    // Reset dialog state when canceling
    setShowConfirmDialog(false);
    setIsConfirming(false);
    onCancel();
  };

  const handleConfirmSave = async () => {
    setIsConfirming(true);
    try {
      // Update profile (name, phone) if changed
      const firstNameChanged =
        editedUser.first_name !== undefined && editedUser.first_name !== user.first_name;
      const lastNameChanged =
        editedUser.last_name !== undefined && editedUser.last_name !== user.last_name;
      const phoneChanged = editedUser.phone !== user.phone;

      if (firstNameChanged || lastNameChanged || phoneChanged) {
        const profileUpdate: { firstName?: string; lastName?: string; phone?: string | null } = {};
        if (firstNameChanged) {
          profileUpdate.firstName = editedUser.first_name;
        }
        if (lastNameChanged) {
          profileUpdate.lastName = editedUser.last_name;
        }
        if (phoneChanged) {
          profileUpdate.phone = editedUser.phone || null;
        }
        await updateProfile.mutateAsync({ userId: user.id, data: profileUpdate });
      }

      // Update roles if changed
      const rolesChanged =
        JSON.stringify(editedUser.roles?.sort()) !== JSON.stringify(user.roles.sort());
      if (rolesChanged && editedUser.roles) {
        await updateRoles.mutateAsync({
          userId: user.id,
          data: { roles: editedUser.roles as UserRole[] },
        });
      }

      // Update KYC if changed
      if (editedUser.kyc_verified !== undefined && editedUser.kyc_verified !== user.kyc_verified) {
        await updateKyc.mutateAsync({ userId: user.id, data: { kycVerified: editedUser.kyc_verified } });
      }

      // Update onboarding if changed - only send changed fields
      // Normalize null/undefined to false for comparison (switches use ?? false)
      const normalizeBoolean = (val: boolean | null | undefined) => val ?? false;

      const investorChanged =
        editedUser.investor_onboarding_completed !== undefined &&
        normalizeBoolean(editedUser.investor_onboarding_completed) !==
          normalizeBoolean(user.investor_onboarding_completed);
      const issuerChanged =
        editedUser.issuer_onboarding_completed !== undefined &&
        normalizeBoolean(editedUser.issuer_onboarding_completed) !==
          normalizeBoolean(user.issuer_onboarding_completed);

      if (investorChanged || issuerChanged) {
        const onboarding: { investorOnboarded?: boolean; issuerOnboarded?: boolean } = {};

        // Only include fields that actually changed
        if (investorChanged) {
          onboarding.investorOnboarded = editedUser.investor_onboarding_completed;
        }
        if (issuerChanged) {
          onboarding.issuerOnboarded = editedUser.issuer_onboarding_completed;
        }

        await updateOnboarding.mutateAsync({
          userId: user.id,
          data: onboarding,
        });

        // Backend auto-adds/removes roles based on onboarding status
        // Update local state to reflect these changes
        let updatedRoles = [...(editedUser.roles || user.roles)];

        if (
          onboarding.investorOnboarded === true &&
          !updatedRoles.includes("INVESTOR" as UserRole)
        ) {
          updatedRoles.push("INVESTOR" as UserRole);
        }
        if (
          onboarding.investorOnboarded === false &&
          updatedRoles.includes("INVESTOR" as UserRole)
        ) {
          updatedRoles = updatedRoles.filter((r) => r !== "INVESTOR");
        }

        if (onboarding.issuerOnboarded === true && !updatedRoles.includes("ISSUER" as UserRole)) {
          updatedRoles.push("ISSUER" as UserRole);
        }
        if (onboarding.issuerOnboarded === false && updatedRoles.includes("ISSUER" as UserRole)) {
          updatedRoles = updatedRoles.filter((r) => r !== "ISSUER");
        }

        // Update editedUser with the new roles
        setEditedUser({ ...editedUser, roles: updatedRoles });
      }

      // Close dialog and save only after all updates succeed
      setShowConfirmDialog(false);
      onSave(editedUser);
    } catch (error) {
      // Error handling is done in the mutation hooks via toast
      // Don't close dialog on error so user can try again
    } finally {
      setIsConfirming(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    const currentRoles = editedUser.roles || user.roles;
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];
    setEditedUser({ ...editedUser, roles: newRoles });
  };

  const isSaving =
    updateRoles.isPending ||
    updateKyc.isPending ||
    updateOnboarding.isPending ||
    updateProfile.isPending;

  const userName =
    user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email;

  if (isEditing) {
    return (
      <>
        <TableRow className="bg-muted/30">
          <TableCell className="font-mono text-sm">
            {user.user_id || <span className="text-muted-foreground italic">Not assigned</span>}
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Input
                value={editedUser.first_name || ""}
                onChange={(e) => setEditedUser({ ...editedUser, first_name: e.target.value })}
                className="h-9 text-sm"
                placeholder="First name"
              />
              <Input
                value={editedUser.last_name || ""}
                onChange={(e) => setEditedUser({ ...editedUser, last_name: e.target.value })}
                className="h-9 text-sm"
                placeholder="Last name"
              />
            </div>
          </TableCell>
          <TableCell>
            <Input
              value={editedUser.email || ""}
              onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
              className="h-9 text-sm"
              type="email"
              disabled
            />
          </TableCell>
          <TableCell>
            <Input
              value={editedUser.phone || ""}
              onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
              className="h-9 text-sm"
              placeholder="+60..."
            />
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {(["INVESTOR", "ISSUER", "ADMIN"] as UserRole[]).map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className={`cursor-pointer text-xs ${
                    editedUser.roles?.includes(role) ? roleColors[role] : "opacity-40"
                  }`}
                  onClick={() => toggleRole(role)}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </TableCell>
          <TableCell>
            <Switch
              checked={editedUser.kyc_verified ?? false}
              onCheckedChange={(checked) => setEditedUser({ ...editedUser, kyc_verified: checked })}
            />
          </TableCell>
          <TableCell>
            <Switch
              checked={editedUser.investor_onboarding_completed ?? false}
              onCheckedChange={(checked) =>
                setEditedUser({ ...editedUser, investor_onboarding_completed: checked })
              }
            />
          </TableCell>
          <TableCell>
            <Switch
              checked={editedUser.issuer_onboarding_completed ?? false}
              onCheckedChange={(checked) =>
                setEditedUser({ ...editedUser, issuer_onboarding_completed: checked })
              }
            />
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {formatDistanceToNow(user.created_at, { addSuffix: true })}
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                onClick={handleSaveClick}
                className="h-7 text-xs"
                disabled={isSaving}
              >
                <CheckIcon className="h-3.5 w-3.5 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                className="h-7 text-xs"
                disabled={isSaving}
              >
                <XMarkIcon className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            </div>
          </TableCell>
        </TableRow>
        <EditUserDialog
          open={showConfirmDialog}
          onOpenChange={(open) => {
            // Only allow closing if not currently saving or confirming
            if (!isSaving && !isConfirming) {
              setShowConfirmDialog(open);
            }
          }}
          userName={userName}
          onConfirm={handleConfirmSave}
        />
      </>
    );
  }

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell className="font-mono text-sm">
          <div className="flex items-center gap-2">
            <span>
              {user.user_id || <span className="text-muted-foreground italic">Not assigned</span>}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEditUserIdDialog(true)}
              className="h-6 px-2 text-xs"
            >
              Change
            </Button>
          </div>
        </TableCell>
        <TableCell className="font-medium text-[15px]">
          {user.first_name} {user.last_name}
        </TableCell>
        <TableCell className="text-[15px]">{user.email}</TableCell>
        <TableCell className="text-[15px]">{user.phone || "—"}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role} variant="outline" className={`text-xs ${roleColors[role]}`}>
                {role}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          {user.kyc_verified ? (
            <CheckIcon className="h-5 w-5 text-green-600" />
          ) : (
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          )}
        </TableCell>
        <TableCell>
          {user.investor_onboarding_completed ? (
            <CheckIcon className="h-5 w-5 text-green-600" />
          ) : (
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          )}
        </TableCell>
        <TableCell>
          {user.issuer_onboarding_completed ? (
            <CheckIcon className="h-5 w-5 text-green-600" />
          ) : (
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDistanceToNow(user.created_at, { addSuffix: true })}
        </TableCell>
        <TableCell>
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </TableCell>
      </TableRow>

      <EditUserIdDialog
        user={{
          id: user.id,
          user_id: user.user_id || null,
          first_name: user.first_name,
          last_name: user.last_name,
        }}
        open={showEditUserIdDialog}
        onOpenChange={setShowEditUserIdDialog}
        onSuccess={(newUserId: string) => {
          // Update user_id through parent callback to maintain React state
          onSave({ user_id: newUserId });
        }}
      />
    </>
  );
}
