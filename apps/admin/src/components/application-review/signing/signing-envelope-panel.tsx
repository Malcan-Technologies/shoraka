/**
 * Admin signing envelope panel for the application review screen. Reads the product's
 * signing template, monitors issuer-created packages, and lets admins void or nudge
 * recipients while the live documents×recipients progress matrix updates.
 */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { readSigningTemplate } from "./build-recipients";
import { SigningProgressMatrix } from "./signing-progress-matrix";
import {
  useAdminSigningEnvelopes,
  useVoidSigningEnvelope,
  useRemindSigningRecipient,
} from "@/hooks/use-signing-envelopes";
import type {
  ApplicationPersonRow,
  SigningEnvelopeDto,
  SigningEnvelopeStatus,
} from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  /** Whether the admin can manage void/reminder actions for this application's signing. */
  canManage?: boolean;
}

export function SigningEnvelopePanel({
  applicationId,
  workflow,
  canManage = true,
}: SigningEnvelopePanelProps) {
  const template = React.useMemo(() => readSigningTemplate(workflow), [workflow]);
  const { data: envelopes = [], isLoading } = useAdminSigningEnvelopes(applicationId);
  const voidMutation = useVoidSigningEnvelope(applicationId);
  const remindMutation = useRemindSigningRecipient(applicationId);

  if (!template.enabled) {
    // Nothing to show when the product has no signing package configured.
    return null;
  }

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
      <CardHeader>
        <CardTitle className="text-lg">Signing package</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && envelopes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No signing package yet. The issuer creates and sends this package from their offer flow.
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
