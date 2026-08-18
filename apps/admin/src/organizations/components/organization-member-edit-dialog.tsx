"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OrganizationMemberDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateUserProfile } from "@/hooks/use-users";

export function OrganizationMemberEditDialog({
  member,
  open,
  onOpenChange,
}: {
  member: OrganizationMemberDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const updateProfile = useUpdateUserProfile();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    if (!member) return;
    setFirstName(member.firstName ?? "");
    setLastName(member.lastName ?? "");
    setPhone(member.phone ?? "");
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    try {
      await updateProfile.mutateAsync({
        userId: member.userId,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "organization-detail"] });
      toast.success("Member updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update member");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>
            Update this member&apos;s name and phone. Email stays locked to the Cognito account.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-first-name">First name</Label>
            <Input
              id="member-first-name"
              className="text-ui"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-last-name">Last name</Label>
            <Input
              id="member-last-name"
              className="text-ui"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-phone">Phone</Label>
            <Input
              id="member-phone"
              className="text-ui"
              value={phone}
              placeholder="+60..."
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              className="text-ui"
              value={member?.email ?? ""}
              readOnly
              disabled
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateProfile.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={updateProfile.isPending || !firstName.trim() || !lastName.trim()}
          >
            {updateProfile.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
