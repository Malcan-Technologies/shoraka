/**
 * Admin signing envelope panel for the application review screen. Reads the product's
 * signing template, lets the admin build a draft (binding real people to roles), send it,
 * void it, and nudge recipients — and shows the live documents×recipients progress matrix.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  buildInitialBindings,
  readSigningTemplate,
} from "./build-recipients";
import { SigningProgressMatrix } from "./signing-progress-matrix";
import {
  useAdminSigningEnvelopes,
  useCreateSigningEnvelope,
  useSendSigningEnvelope,
  useVoidSigningEnvelope,
  useRemindSigningRecipient,
} from "@/hooks/use-signing-envelopes";
import type {
  ApplicationPersonRow,
  RecipientBinding,
  SigningEnvelopeDto,
  SigningEnvelopeStatus,
} from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_STYLES: Record<SigningEnvelopeStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-primary/10 text-primary",
  VOIDED: "bg-muted text-muted-foreground line-through",
  EXPIRED: "bg-muted text-muted-foreground",
};

export interface SigningEnvelopePanelProps {
  applicationId: string;
  /** Product.workflow JSON (holds the signing template config). */
  workflow: unknown;
  people: ApplicationPersonRow[];
  guarantors: unknown;
  contractId?: string | null;
  invoiceId?: string | null;
  productVersion?: number | null;
  /** Whether the admin can manage (send/void) this application's signing. */
  canManage?: boolean;
}

export function SigningEnvelopePanel({
  applicationId,
  workflow,
  people,
  guarantors,
  contractId,
  invoiceId,
  productVersion,
  canManage = true,
}: SigningEnvelopePanelProps) {
  const template = React.useMemo(() => readSigningTemplate(workflow), [workflow]);
  const { data: envelopes = [], isLoading } = useAdminSigningEnvelopes(applicationId);
  const createMutation = useCreateSigningEnvelope();
  const sendMutation = useSendSigningEnvelope(applicationId);
  const voidMutation = useVoidSigningEnvelope(applicationId);
  const remindMutation = useRemindSigningRecipient(applicationId);

  const [buildOpen, setBuildOpen] = React.useState(false);

  if (!template.enabled) {
    // Nothing to show when the product has no signing package configured.
    return null;
  }

  const hasActiveEnvelope = envelopes.some(
    (e) => e.status !== "VOIDED" && e.status !== "DECLINED" && e.status !== "EXPIRED"
  );

  const handleCreate = async (bindings: RecipientBinding[]) => {
    try {
      await createMutation.mutateAsync({
        applicationId,
        title: "Signing package",
        contractId: contractId ?? null,
        invoiceId: invoiceId ?? null,
        productVersion: productVersion ?? null,
        templateConfig: template,
        bindings,
      });
      toast.success("Draft signing package created");
      setBuildOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create signing package");
    }
  };

  const handleSend = async (envelopeId: string) => {
    try {
      await sendMutation.mutateAsync(envelopeId);
      toast.success("Signing package sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    }
  };

  const handleVoid = async (envelopeId: string) => {
    try {
      await voidMutation.mutateAsync({ envelopeId });
      toast.success("Signing package voided");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to void");
    }
  };

  const handleRemind = async (envelopeId: string, recipientId: string) => {
    try {
      await remindMutation.mutateAsync({ envelopeId, recipientId });
      toast.success("Reminder sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remind");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg">Signing package</CardTitle>
        {canManage && !hasActiveEnvelope && (
          <Button size="sm" onClick={() => setBuildOpen(true)}>
            Build signing package
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && envelopes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No signing package yet. Build one to bind signers to the product’s documents.
          </p>
        )}

        {envelopes.map((envelope) => (
          <div key={envelope.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{envelope.title}</span>
                <Badge className={STATUS_STYLES[envelope.status]}>
                  {envelope.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  {envelope.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={() => handleSend(envelope.id)}
                      disabled={sendMutation.isPending}
                    >
                      Send
                    </Button>
                  )}
                  {envelope.status !== "COMPLETED" && envelope.status !== "VOIDED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVoid(envelope.id)}
                      disabled={voidMutation.isPending}
                    >
                      Void
                    </Button>
                  )}
                </div>
              )}
            </div>

            <SigningProgressMatrix envelope={envelope} />

            {canManage && (envelope.status === "SENT" || envelope.status === "IN_PROGRESS") && (
              <RecipientReminders
                envelope={envelope}
                onRemind={(recipientId) => handleRemind(envelope.id, recipientId)}
                disabled={remindMutation.isPending}
              />
            )}
          </div>
        ))}
      </CardContent>

      {buildOpen && (
        <BuildEnvelopeDialog
          open={buildOpen}
          onOpenChange={setBuildOpen}
          initialBindings={buildInitialBindings(template, people, guarantors)}
          roleLabels={new Map(template.roles.map((r) => [r.key, r.label]))}
          onSubmit={handleCreate}
          submitting={createMutation.isPending}
        />
      )}
    </Card>
  );
}

function RecipientReminders({
  envelope,
  onRemind,
  disabled,
}: {
  envelope: SigningEnvelopeDto;
  onRemind: (recipientId: string) => void;
  disabled: boolean;
}) {
  const pending = envelope.recipients.filter((r) => r.status !== "SIGNED");
  if (pending.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <span className="text-xs text-muted-foreground">Nudge:</span>
      {pending.map((r) => (
        <Button
          key={r.id}
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onRemind(r.id)}
          disabled={disabled}
        >
          {r.name}
        </Button>
      ))}
    </div>
  );
}

function BuildEnvelopeDialog({
  open,
  onOpenChange,
  initialBindings,
  roleLabels,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBindings: RecipientBinding[];
  roleLabels: Map<string, string>;
  onSubmit: (bindings: RecipientBinding[]) => void;
  submitting: boolean;
}) {
  const [bindings, setBindings] = React.useState<RecipientBinding[]>(initialBindings);

  const update = (index: number, patch: Partial<RecipientBinding>) => {
    setBindings((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const canSubmit =
    bindings.length > 0 &&
    bindings.every((b) => b.name.trim() !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Build signing package</DialogTitle>
          <DialogDescription>
            Confirm who signs each role. Directors and guarantors are pre-filled from the
            application; adjust names and emails as needed.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          {bindings.map((binding, index) => (
            <div key={index} className="grid grid-cols-[8rem_1fr_1fr] items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                {roleLabels.get(binding.role_key) ?? binding.role_key}
              </span>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={binding.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={binding.email}
                  onChange={(e) => update(index, { email: e.target.value })}
                  placeholder="name@example.com"
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(bindings)} disabled={!canSubmit || submitting}>
            Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
