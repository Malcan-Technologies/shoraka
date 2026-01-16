"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InviteMemberDialog as SharedInviteMemberDialog } from "@cashsouk/ui";
import { useOrganizationInvitations } from "../hooks/use-organization-invitations";

interface InviteMemberDialogProps {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
  organizationId,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const hooks = useOrganizationInvitations(organizationId);

  return (
    <SharedInviteMemberDialog
      portalType="investor"
      open={open}
      onOpenChange={onOpenChange}
      hooks={{
        invite: hooks.invite,
        generateLink: hooks.generateLink,
        isInviting: hooks.isInviting,
        isGeneratingLink: hooks.isGeneratingLink,
      }}
      Dialog={Dialog}
      DialogContent={DialogContent}
      DialogDescription={DialogDescription}
      DialogFooter={DialogFooter}
      DialogHeader={DialogHeader}
      DialogTitle={DialogTitle}
      Button={Button}
      Input={Input}
      Label={Label}
      Select={Select}
      SelectTrigger={SelectTrigger}
      SelectValue={SelectValue}
      SelectContent={SelectContent}
      SelectItem={SelectItem}
    />
  );
}
