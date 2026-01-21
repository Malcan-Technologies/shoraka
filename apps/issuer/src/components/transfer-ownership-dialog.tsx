"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { OrganizationMember } from "@cashsouk/config";

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: OrganizationMember[];
  currentUserId: string;
  onConfirm: (newOwnerId: string) => void;
  isLoading?: boolean;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  members,
  currentUserId,
  onConfirm,
  isLoading = false,
}: TransferOwnershipDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>("");

  // Filter out current user from member list
  const otherMembers = members.filter((m) => m.id !== currentUserId);

  // Reset selection when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setSelectedMemberId("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (selectedMemberId) {
      onConfirm(selectedMemberId);
    }
  };

  const selectedMember = otherMembers.find((m) => m.id === selectedMemberId);
  const memberName = selectedMember
    ? [selectedMember.firstName, selectedMember.lastName].filter(Boolean).join(" ") || selectedMember.email
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle>Transfer Ownership</DialogTitle>
              <DialogDescription>
                Select a new owner for this organization
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm text-orange-800">
              <strong>Important:</strong> This action will immediately transfer full ownership and control
              of this organization to the selected member. You will lose owner privileges and cannot undo
              this action.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-owner">Select New Owner</Label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger id="new-owner" className="h-11 rounded-xl">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {otherMembers.map((member) => {
                  const name =
                    [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
                  return (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {member.firstName?.[0] || member.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedMemberId && (
            <div className="rounded-lg border bg-muted p-3">
              <p className="text-sm">
                <strong>{memberName}</strong> will become the new organization owner and will have
                full control over all settings, members, and data.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMemberId || isLoading}
            className="rounded-xl bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
