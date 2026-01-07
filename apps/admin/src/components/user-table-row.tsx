"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon, CheckIcon, XMarkIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { formatDistanceToNow, format } from "date-fns";
import {
  useUpdateUserOnboarding,
  useUpdateUserProfile,
  useUpdateUserId,
} from "../hooks/use-users";
import type { UserRole } from "@cashsouk/types";
import { EditUserDialog } from "./edit-user-dialog";
import { cn } from "@/lib/utils";

interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string;
  roles: UserRole[];
  investor_account: string[];
  issuer_account: string[];
  investor_organization_count?: number;
  issuer_organization_count?: number;
  password_changed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  cognito_sub: string;
  cognito_username: string;
}

interface UserTableRowProps {
  user: User;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updatedUser: Partial<User>) => void;
  onCancel: () => void;
}

const getRoleBadgeClasses = (role: UserRole): string => {
  switch (role) {
    case "INVESTOR":
      return "border-primary/30 text-primary";
    case "ISSUER":
      return "border-accent/30 text-accent";
    case "ADMIN":
      return "border-purple-500/30 text-purple-600 bg-purple-500/10";
    default:
      return "";
  }
};

export function UserTableRow({ user, isEditing, onEdit, onSave, onCancel }: UserTableRowProps) {
  const [editedUser, setEditedUser] = React.useState<Partial<User>>(user);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const updateOnboarding = useUpdateUserOnboarding();
  const updateProfile = useUpdateUserProfile();
  const updateUserId = useUpdateUserId();

  React.useEffect(() => {
    if (isEditing) {
      setEditedUser({
        ...user,
        investor_account: user.investor_account || [],
        issuer_account: user.issuer_account || [],
      });
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
      // Update user_id if changed
      const userIdChanged =
        editedUser.user_id !== undefined && editedUser.user_id !== user.user_id;
      if (userIdChanged && editedUser.user_id) {
        await updateUserId.mutateAsync({
          userId: user.user_id,
          newUserId: editedUser.user_id,
        });
      }

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
        await updateProfile.mutateAsync({ userId: user.user_id, data: profileUpdate });
      }

      // Update onboarding if changed - only send changed fields
      // Note: Roles are now read-only badges, managed elsewhere
      // Compare array lengths to determine if onboarding status changed
      const investorChanged =
        editedUser.investor_account !== undefined &&
        editedUser.investor_account.length !== user.investor_account.length;
      const issuerChanged =
        editedUser.issuer_account !== undefined &&
        editedUser.issuer_account.length !== user.issuer_account.length;

      if (investorChanged || issuerChanged) {
        const onboarding: { investorOnboarded?: boolean; issuerOnboarded?: boolean } = {};

        // Only include fields that actually changed
        if (investorChanged) {
          onboarding.investorOnboarded = (editedUser.investor_account?.length ?? 0) > 0;
        }
        if (issuerChanged) {
          onboarding.issuerOnboarded = (editedUser.issuer_account?.length ?? 0) > 0;
        }

        await updateOnboarding.mutateAsync({
          userId: user.user_id,
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

  const isSaving =
    updateOnboarding.isPending ||
    updateProfile.isPending ||
    updateUserId.isPending;

  const userName =
    user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email;

  if (isEditing) {
    return (
      <>
        <TableRow className="bg-muted/30">
          {/* User ID */}
          <TableCell className="font-mono text-sm">
            <Input
              value={editedUser.user_id || ""}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().slice(0, 5);
                setEditedUser({ ...editedUser, user_id: value });
              }}
              className="h-9 text-sm font-mono"
              placeholder="ABCDE"
              maxLength={5}
            />
          </TableCell>
          {/* First Name */}
          <TableCell>
            <Input
              value={editedUser.first_name || ""}
              onChange={(e) => setEditedUser({ ...editedUser, first_name: e.target.value })}
              className="h-9 text-sm"
              placeholder="First name"
            />
          </TableCell>
          {/* Last Name */}
          <TableCell>
            <Input
              value={editedUser.last_name || ""}
              onChange={(e) => setEditedUser({ ...editedUser, last_name: e.target.value })}
              className="h-9 text-sm"
              placeholder="Last name"
            />
          </TableCell>
          {/* Phone */}
          <TableCell>
            <Input
              value={editedUser.phone || ""}
              onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
              className="h-9 text-sm"
              placeholder="+60..."
            />
          </TableCell>
          {/* Email */}
          <TableCell>
            <Input
              value={editedUser.email || ""}
              onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
              className="h-9 text-sm"
              type="email"
              disabled
            />
          </TableCell>
          {/* Roles - Read Only */}
          <TableCell>
            <div className="flex flex-col gap-1">
              {(editedUser.roles || user.roles).map((role) => (
                <Badge key={role} variant="outline" className={cn("text-xs w-fit capitalize", getRoleBadgeClasses(role))}>
                  {role.toLowerCase()}
                </Badge>
              ))}
            </div>
          </TableCell>
          {/* Investor Orgs - Read Only */}
          <TableCell>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BuildingOffice2Icon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {user.investor_organization_count ?? user.investor_account?.length ?? 0}
              </span>
            </div>
          </TableCell>
          {/* Issuer Orgs - Read Only */}
          <TableCell>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BuildingOffice2Icon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {user.issuer_organization_count ?? user.issuer_account?.length ?? 0}
              </span>
            </div>
          </TableCell>
          {/* Password Changed */}
          <TableCell className="text-sm text-muted-foreground">
            {user.password_changed_at
              ? formatDistanceToNow(user.password_changed_at, { addSuffix: true })
              : "Never"}
          </TableCell>
        {/* Created */}
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(user.created_at), "dd MMM yyyy")}
        </TableCell>
        {/* Updated */}
        <TableCell className="text-sm text-muted-foreground">
          {formatDistanceToNow(user.updated_at, { addSuffix: true })}
        </TableCell>
        {/* Actions */}
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
        {/* User ID */}
        <TableCell className="font-mono text-sm">
          {user.user_id || <span className="text-muted-foreground italic">Not assigned</span>}
        </TableCell>
        {/* First Name */}
        <TableCell className="font-medium text-sm">{user.first_name}</TableCell>
        {/* Last Name */}
        <TableCell className="font-medium text-sm">{user.last_name}</TableCell>
        {/* Phone */}
        <TableCell className="text-sm">{user.phone || "—"}</TableCell>
        {/* Email */}
        <TableCell className="text-sm">{user.email}</TableCell>
        {/* Roles */}
        <TableCell>
          <div className="flex flex-col gap-1">
            {user.roles.map((role) => (
              <Badge key={role} variant="outline" className={cn("text-xs w-fit capitalize", getRoleBadgeClasses(role))}>
                {role.toLowerCase()}
              </Badge>
            ))}
          </div>
        </TableCell>
        {/* Investor Orgs */}
        <TableCell>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BuildingOffice2Icon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {user.investor_organization_count ?? user.investor_account?.length ?? 0}
            </span>
          </div>
        </TableCell>
        {/* Issuer Orgs */}
        <TableCell>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BuildingOffice2Icon className="h-4 w-4" />
            <span className="text-sm font-medium">
              {user.issuer_organization_count ?? user.issuer_account?.length ?? 0}
            </span>
          </div>
        </TableCell>
        {/* Password Changed */}
        <TableCell className="text-sm text-muted-foreground">
          {user.password_changed_at
            ? formatDistanceToNow(user.password_changed_at, { addSuffix: true })
            : "Never"}
        </TableCell>
      {/* Created */}
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(user.created_at), "dd MMM yyyy")}
      </TableCell>
      {/* Updated */}
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(user.updated_at, { addSuffix: true })}
      </TableCell>
      {/* Actions */}
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
          <PencilIcon className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </TableCell>
    </TableRow>
    </>
  );
}
