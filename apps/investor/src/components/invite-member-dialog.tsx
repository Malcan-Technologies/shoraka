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
import { useOrganizationInvitations } from "../hooks/use-organization-invitations";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

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
  const { invite, isInviting } = useOrganizationInvitations(organizationId);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER">(
    "ORGANIZATION_MEMBER"
  );
  const [invitationUrl, setInvitationUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (invitationUrl) {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      toast.success("Invitation URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await invite({ email, role });
      // Always show the invitation URL so user can copy it, especially if email fails
      if (result?.invitationUrl) {
        setInvitationUrl(result.invitationUrl);
      } else if (result?.emailSent) {
        // If email was sent but no URL returned (shouldn't happen), close dialog
        setEmail("");
        setRole("ORGANIZATION_MEMBER");
        onOpenChange(false);
      }
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("ORGANIZATION_MEMBER");
    setInvitationUrl(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join this organization. The invitee will receive an email with a link to accept.
          </DialogDescription>
        </DialogHeader>
        {!invitationUrl ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER") => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORGANIZATION_MEMBER">Organization Member</SelectItem>
                    <SelectItem value="ORGANIZATION_ADMIN">Organization Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="text-sm font-medium mb-2 block">Invitation URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={invitationUrl}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="h-4 w-4 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share this link with the invitee. The invitation expires in 7 days.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
