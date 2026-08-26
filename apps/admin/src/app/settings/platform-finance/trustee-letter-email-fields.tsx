"use client";

import * as React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  isValidTrusteeEmail,
  normalizeTrusteeCcEmails,
  splitTrusteeCcDraft,
} from "@/lib/trustee-letter-settings";

export function TrusteeLetterEmailFields({
  autoSendTrusteeEmail,
  trusteeEmail,
  trusteeCcEmails,
  ccDraft,
  disabled,
  trusteeEmailError,
  trusteeCcError,
  onAutoSendChange,
  onTrusteeEmailChange,
  onCcEmailsChange,
  onCcDraftChange,
}: {
  autoSendTrusteeEmail: boolean;
  trusteeEmail: string;
  trusteeCcEmails: string[];
  ccDraft: string;
  disabled?: boolean;
  trusteeEmailError: string | null;
  trusteeCcError: string | null;
  onAutoSendChange: (enabled: boolean) => void;
  onTrusteeEmailChange: (email: string) => void;
  onCcEmailsChange: (emails: string[]) => void;
  onCcDraftChange: (draft: string) => void;
}) {
  const commitCcDraft = () => {
    const next = splitTrusteeCcDraft(ccDraft);
    if (next.length === 0) return;
    if (next.some((email) => !isValidTrusteeEmail(email))) return;
    onCcEmailsChange(normalizeTrusteeCcEmails([...trusteeCcEmails, ...next]));
    onCcDraftChange("");
  };

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
        <div className="space-y-1">
          <Label htmlFor="trustee-auto-send" className="text-ui">
            Automatically email trustee
          </Label>
          <p className="text-meta text-muted-foreground">
            When enabled, marking an instruction submitted emails the generated signed trustee PDF.
            When disabled, admins submit the letter manually.
          </p>
        </div>
        <Switch
          id="trustee-auto-send"
          checked={autoSendTrusteeEmail}
          disabled={disabled}
          onCheckedChange={onAutoSendChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trustee-email" className="text-ui">
          Trustee email (To)
        </Label>
        <Input
          id="trustee-email"
          type="email"
          autoComplete="email"
          value={trusteeEmail}
          disabled={disabled}
          placeholder="e.g. trustee@example.com"
          aria-invalid={Boolean(trusteeEmailError)}
          aria-describedby={
            trusteeEmailError ? "trustee-email-error trustee-email-hint" : "trustee-email-hint"
          }
          className="h-11 rounded-xl px-4 focus-visible:ring-2 focus-visible:ring-primary"
          onChange={(event) => onTrusteeEmailChange(event.target.value)}
        />
        <p id="trustee-email-hint" className="text-meta text-muted-foreground">
          Required when automatic email is enabled.
        </p>
        {trusteeEmailError ? (
          <p id="trustee-email-error" className="text-meta text-destructive">
            {trusteeEmailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="trustee-cc-emails" className="text-ui">
          CC emails
        </Label>
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
          {trusteeCcEmails.map((email) => (
            <span
              key={email.toLowerCase()}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-meta text-foreground"
            >
              {email}
              <button
                type="button"
                disabled={disabled}
                className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${email}`}
                onClick={() =>
                  onCcEmailsChange(trusteeCcEmails.filter((item) => item.toLowerCase() !== email.toLowerCase()))
                }
              >
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <Input
            id="trustee-cc-emails"
            type="text"
            inputMode="email"
            autoComplete="off"
            value={ccDraft}
            disabled={disabled}
            placeholder={trusteeCcEmails.length === 0 ? "Add one email, then press Enter" : "Add another"}
            aria-invalid={Boolean(trusteeCcError)}
            aria-describedby={
              trusteeCcError ? "trustee-cc-error trustee-cc-hint" : "trustee-cc-hint"
            }
            className="h-8 min-w-[12rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            onChange={(event) => onCcDraftChange(event.target.value)}
            onBlur={commitCcDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "," || event.key === ";") {
                event.preventDefault();
                commitCcDraft();
              }
              if (event.key === "Backspace" && ccDraft.length === 0 && trusteeCcEmails.length > 0) {
                onCcEmailsChange(trusteeCcEmails.slice(0, -1));
              }
            }}
          />
        </div>
        <p id="trustee-cc-hint" className="text-meta text-muted-foreground">
          Optional. Add one email at a time.
        </p>
        {trusteeCcError ? (
          <p id="trustee-cc-error" className="text-meta text-destructive">
            {trusteeCcError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
