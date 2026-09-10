"use client";

import * as React from "react";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { PeopleAccessRow } from "@cashsouk/types";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import type { InviteMemberDialogHooks } from "../invite-member-dialog";

export type InviteUserPersonOption = {
  partyId: string;
  name: string;
  personEmail: string;
  restoreExistingLink: boolean;
  linkedLoginEmail: string;
};

export function inviteableCompanyPeople(rows: PeopleAccessRow[]): InviteUserPersonOption[] {
  return rows
    .filter((row) => row.kind === "company_person" && row.partyId && row.party?.entityType !== "CORPORATE")
    .filter((row) => row.platformAccess === "No access" || row.platformAccess === "Invitation expired")
    .map((row) => ({
      partyId: row.partyId!,
      name: row.name,
      personEmail: row.personEmail ?? "",
      restoreExistingLink: row.party?.platformAccess.status === "NO_PLATFORM_ACCESS",
      linkedLoginEmail: row.accountEmail ?? row.party?.linkedUser?.email ?? "",
    }));
}

export function InviteUserDialog({
  open,
  onOpenChange,
  hooks,
  people,
  initialPartyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hooks: InviteMemberDialogHooks;
  people: InviteUserPersonOption[];
  initialPartyId?: string | null;
}) {
  const [mode, setMode] = React.useState<"existing" | "other">("other");
  const [partyId, setPartyId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER">(
    "ORGANIZATION_MEMBER"
  );
  const [invitationUrl, setInvitationUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const selected = people.find((person) => person.partyId === partyId) ?? null;

  React.useEffect(() => {
    if (!open) {
      setMode("other");
      setPartyId("");
      setEmail("");
      setRole("ORGANIZATION_MEMBER");
      setInvitationUrl(null);
      setCopied(false);
      return;
    }
    if (initialPartyId && people.some((person) => person.partyId === initialPartyId)) {
      setMode("existing");
      setPartyId(initialPartyId);
      const person = people.find((row) => row.partyId === initialPartyId);
      setEmail(
        person?.restoreExistingLink
          ? person.linkedLoginEmail || person.personEmail
          : person?.personEmail ?? ""
      );
      return;
    }
    setMode(people.length > 0 ? "existing" : "other");
  }, [open, initialPartyId, people]);

  React.useEffect(() => {
    if (!open || mode !== "existing") return;
    if (!selected) {
      setEmail("");
      return;
    }
    setEmail(
      selected.restoreExistingLink
        ? selected.linkedLoginEmail || selected.personEmail
        : selected.personEmail
    );
  }, [mode, open, selected]);

  const handleCopy = async () => {
    if (!invitationUrl) return;
    await navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
    toast.success("Invitation link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const submitInvite = async () => {
    const partyProfileId = mode === "existing" ? selected?.partyId : undefined;
    if (mode === "existing" && !partyProfileId) {
      toast.error("Select a company person");
      return;
    }
    if (mode === "existing" && !selected?.restoreExistingLink && !email.trim()) {
      toast.error("Enter an invitation email");
      return;
    }
    const result = await hooks.invite({
      email: email.trim() || undefined,
      role,
      partyProfileId,
    });
    if (result?.linkedExistingMember) {
      onOpenChange(false);
      return;
    }
    if (result?.invitationUrl) {
      setInvitationUrl(result.invitationUrl);
      return;
    }
    if (result?.emailSent) {
      onOpenChange(false);
    }
  };

  const handleGenerateAndCopyLink = async () => {
    if (!hooks.generateLink) {
      toast.error("Generate link functionality not available");
      return;
    }
    const partyProfileId = mode === "existing" ? selected?.partyId : undefined;
    if (mode === "existing" && !email.trim()) {
      toast.error("Enter an invitation email before copying a person-scoped link");
      return;
    }
    try {
      const result = await hooks.generateLink({
        email: email.trim() || undefined,
        role,
        partyProfileId,
      });
      setInvitationUrl(result.invitationUrl);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Grant CashSouk access to this organisation. This does not add a company person.
          </DialogDescription>
        </DialogHeader>
        {!invitationUrl ? (
          <form
            className="space-y-4 py-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await submitInvite();
              } catch {
                // Hook surfaces the error
              }
            }}
          >
            <fieldset className="space-y-3">
              <legend className="text-ui font-medium">Who are you inviting?</legend>
              <label className="flex items-start gap-2 text-ui">
                <input
                  type="radio"
                  name="invite-who"
                  className="mt-1"
                  checked={mode === "existing"}
                  disabled={people.length === 0}
                  onChange={() => setMode("existing")}
                />
                <span>
                  Existing company person
                  {people.length === 0 ? (
                    <span className="block text-meta text-muted-foreground">
                      Add a company person first, or invite someone else.
                    </span>
                  ) : null}
                </span>
              </label>
              <label className="flex items-start gap-2 text-ui">
                <input
                  type="radio"
                  name="invite-who"
                  className="mt-1"
                  checked={mode === "other"}
                  onChange={() => setMode("other")}
                />
                <span>Someone else</span>
              </label>
            </fieldset>

            {mode === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="invite-person">Company person</Label>
                <Select value={partyId} onValueChange={setPartyId}>
                  <SelectTrigger id="invite-person">
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.partyId} value={person.partyId}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="invite-email">
                {selected?.restoreExistingLink ? "Account Email" : "Email"}
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                required={mode === "existing" ? !selected?.restoreExistingLink : false}
                readOnly={Boolean(selected?.restoreExistingLink)}
              />
              <p className="text-meta text-muted-foreground">
                {selected?.restoreExistingLink
                  ? "This person is already linked to this CashSouk account. Restoring access does not change the Person identity link."
                  : mode === "existing"
                    ? "Prefills Person Email for delivery. This is not Account Email and does not link records by email."
                    : "Optional. Leave empty to copy a shareable link instead."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Access level</Label>
              <Select
                value={role}
                onValueChange={(value) =>
                  setRole(value as "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER")
                }
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORGANIZATION_MEMBER">User</SelectItem>
                  <SelectItem value="ORGANIZATION_ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex w-full gap-2 sm:w-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                {(selected?.restoreExistingLink || email.trim() || mode === "other") && (
                  <Button type="submit" disabled={hooks.isInviting || (mode === "existing" && !partyId)}>
                    {hooks.isInviting
                      ? selected?.restoreExistingLink
                        ? "Restoring..."
                        : "Sending..."
                      : selected?.restoreExistingLink
                        ? "Restore access"
                        : "Send invitation"}
                  </Button>
                )}
              </div>
              {hooks.generateLink && !selected?.restoreExistingLink ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateAndCopyLink}
                  disabled={hooks.isGeneratingLink || (mode === "existing" && !email.trim())}
                  className="gap-2"
                >
                  {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                  Copy link
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="mb-2 block text-ui font-medium">Invitation URL</Label>
              <div className="flex items-center gap-2">
                <Input value={invitationUrl} readOnly className="flex-1 font-mono text-sm" />
                <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                  {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                  Copy
                </Button>
              </div>
              <p className="mt-2 text-meta text-muted-foreground">
                Share this link with the invitee. The invitation expires in 7 days.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
