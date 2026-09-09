"use client";

import * as React from "react";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

export interface InviteMemberDialogHooks {
  invite: (data: {
    email?: string;
    role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
    partyProfileId?: string;
  }) => Promise<{
    success: boolean;
    invitationId: string;
    emailSent: boolean;
    invitationUrl?: string;
    emailError?: string;
    linkedExistingMember?: boolean;
  }>;
  generateLink?: (data: {
    email?: string;
    role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
    partyProfileId?: string;
  }) => Promise<{
    invitationUrl: string;
  }>;
  isInviting: boolean;
  isGeneratingLink?: boolean;
}

export interface InviteMemberDialogProps {
  portalType: "investor" | "issuer";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hooks: InviteMemberDialogHooks;
  // UI Components - these will be provided by the app
  Dialog: React.ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }>;
  DialogContent: React.ComponentType<{ className?: string; children: React.ReactNode }>;
  DialogDescription: React.ComponentType<{ className?: string; children: React.ReactNode }>;
  DialogFooter: React.ComponentType<{ className?: string; children: React.ReactNode }>;
  DialogHeader: React.ComponentType<{ children: React.ReactNode }>;
  DialogTitle: React.ComponentType<{ children: React.ReactNode }>;
  Button: React.ComponentType<{
    type?: "button" | "submit";
    variant?: "default" | "outline" | "ghost";
    size?: "sm" | "default";
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
  }>;
  Input: React.ComponentType<{
    id?: string;
    type?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    readOnly?: boolean;
    className?: string;
  }>;
  Label: React.ComponentType<{ htmlFor?: string; className?: string; children: React.ReactNode }>;
  Select: React.ComponentType<{
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }>;
  SelectTrigger: React.ComponentType<{ children: React.ReactNode }>;
  SelectValue: React.ComponentType<{ placeholder?: string }>;
  SelectContent: React.ComponentType<{ children: React.ReactNode }>;
  SelectItem: React.ComponentType<{ value: string; children: React.ReactNode }>;
  personContext?: {
    partyProfileId: string;
    personName: string;
    defaultEmail?: string;
    linkedLoginEmail?: string;
    restoreExistingLink?: boolean;
  };
}

export function InviteMemberDialog({
  portalType: _portalType, // Reserved for future use
  open,
  onOpenChange,
  hooks,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  personContext,
}: InviteMemberDialogProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER">(
    "ORGANIZATION_MEMBER"
  );
  const [invitationUrl, setInvitationUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("ORGANIZATION_MEMBER");
      setInvitationUrl(null);
      setCopied(false);
      return;
    }
    setEmail(
      personContext?.restoreExistingLink
        ? (personContext.linkedLoginEmail ?? personContext.defaultEmail ?? "")
        : (personContext?.defaultEmail ?? "")
    );
  }, [open, personContext?.defaultEmail, personContext?.linkedLoginEmail, personContext?.restoreExistingLink]);

  const handleCopy = async () => {
    if (invitationUrl) {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      toast.success("Invitation link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerateAndCopyLink = async () => {
    if (!hooks.generateLink) {
      toast.error("Generate link functionality not available");
      return;
    }

    if (personContext && !email.trim()) {
      toast.error("Enter an invitation email before copying a person-scoped link");
      return;
    }

    try {
      const result = await hooks.generateLink({
        email: email || undefined,
        role,
        partyProfileId: personContext?.partyProfileId,
      });

      setInvitationUrl(result.invitationUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(result.invitationUrl);
      setCopied(true);
      toast.success("Invitation link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to generate link", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await hooks.invite({
        email: email || undefined,
        role,
        partyProfileId: personContext?.partyProfileId,
      });
      if (result?.linkedExistingMember) {
        setEmail("");
        setRole("ORGANIZATION_MEMBER");
        onOpenChange(false);
        return;
      }
      // Always show the invitation URL so user can copy it, especially if email fails
      if (result?.invitationUrl) {
        setInvitationUrl(result.invitationUrl);
      } else if (result?.emailSent && !result.invitationUrl) {
        // If email was sent but no URL returned (shouldn't happen), close dialog
        setEmail("");
        setRole("ORGANIZATION_MEMBER");
        onOpenChange(false);
      }
    } catch {
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
          <DialogTitle>
            {personContext?.restoreExistingLink
              ? "Restore access"
              : personContext
                ? "Invite to platform"
                : "Invite Member"}
          </DialogTitle>
          <DialogDescription>
            {personContext?.restoreExistingLink
              ? `Restore platform access for ${personContext.personName} using the already-linked CashSouk account. This does not change the Person identity link.`
              : personContext
                ? `Invite ${personContext.personName} to this organization. Invitation email is for delivery only and is not this person’s identity.`
                : "Send an invitation to join this organization. You can send via email or generate a shareable link."}
          </DialogDescription>
        </DialogHeader>
        {!invitationUrl ? (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {personContext?.restoreExistingLink
                    ? "Platform login email"
                    : personContext
                      ? "Invitation email (delivery only)"
                      : "Email (Optional)"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@example.com"
                  required={Boolean(personContext) && !personContext?.restoreExistingLink}
                  readOnly={Boolean(personContext?.restoreExistingLink)}
                />
                <p className="text-xs text-muted-foreground">
                  {personContext?.restoreExistingLink
                    ? "This person is already linked to this CashSouk account. Restoring access does not ask for a different email."
                    : personContext
                      ? "This email is used to send the invitation. It does not identify the person and is not synchronized with onboarding email or login email. Copy Link requires this addressed email."
                      : "Leave empty to generate a shareable link that works for anyone"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER")}>
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
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between items-center">
              <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-1">
                <Button type="button" variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                {(personContext?.restoreExistingLink || email) && (
                  <Button
                    type="submit"
                    disabled={hooks.isInviting || !role}
                    className="flex-1 sm:flex-none"
                  >
                    {hooks.isInviting
                      ? personContext?.restoreExistingLink
                        ? "Restoring..."
                        : "Sending..."
                      : personContext?.restoreExistingLink
                        ? "Restore access"
                        : "Send Invitation"}
                  </Button>
                )}
              </div>
              {hooks.generateLink && !personContext?.restoreExistingLink && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateAndCopyLink}
                  disabled={!role || hooks.isGeneratingLink || Boolean(personContext && !email.trim())}
                  className="w-full sm:w-auto order-1 sm:order-2 flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="h-4 w-4 text-green-600" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              )}
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
