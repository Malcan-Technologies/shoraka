"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import {
  type NoteDetail,
  type PaymasterAssignmentNoticeStatus,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { notesKeys } from "@/notes/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assignmentNoticeStatusLabel,
  assignmentNoticeStatusToken,
} from "@/lib/admin-status-token";
import { paymasterHref } from "@/lib/admin-directory-hrefs";
import Link from "next/link";
import {
  CollapsibleDetailTimeline,
  WorkflowStepTitle,
} from "@/notes/components/note-detail-ui-blocks";
import {
  workflowTaskSurfaceClass,
  type WorkflowStatusTone,
} from "@/notes/utils/workflow-status-tokens";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function snapshotString(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function putFile(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/pdf" },
    body: file,
  });
  if (!response.ok) throw new Error("Failed to upload file");
}

function assignmentCardTone(
  status: PaymasterAssignmentNoticeStatus | null,
  acknowledged: boolean
): WorkflowStatusTone {
  if (acknowledged || status === "ACKNOWLEDGED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "SENT") return "warning";
  return "active";
}

function stepDescription(
  status: PaymasterAssignmentNoticeStatus | null | undefined,
  acknowledged: boolean
): string {
  if (acknowledged || status === "ACKNOWLEDGED") {
    return "Paymaster acknowledgement confirmed.";
  }
  if (status === "ACKNOWLEDGEMENT_UPLOADED") {
    return "Confirm the uploaded acknowledgement to complete this step.";
  }
  if (status === "SENT") {
    return "Upload the written Paymaster acknowledgement.";
  }
  if (status === "GENERATED") {
    return "Download the notice, send it to the Paymaster, then mark it sent.";
  }
  if (status === "FAILED") {
    return "Notice generation failed. Generate it again.";
  }
  return "Generate the Notice of Assignment, send it to the Paymaster, then upload their written acknowledgement.";
}

export function PaymasterAssignmentCard({
  note,
  canManage,
}: {
  note: NoteDetail;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const { viewDocumentPending } = useAdminS3DocumentViewDownload();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmAction, setConfirmAction] = React.useState<
    "generate" | "sent" | "confirm" | null
  >(null);

  const notice = note.assignmentNotice ?? null;
  const acknowledged = note.paymasterAcknowledgementSatisfied === true;
  const status = notice?.status ?? null;
  const tone = assignmentCardTone(status, acknowledged);
  const paymasterName =
    snapshotString(note.paymasterSnapshot, "name") ?? note.paymasterName ?? "—";
  const registration =
    snapshotString(note.paymasterSnapshot, "ssm_number") ??
    snapshotString(note.paymasterSnapshot, "registrationNumber") ??
    "—";
  const entityType =
    snapshotString(note.paymasterSnapshot, "entity_type") ??
    snapshotString(note.paymasterSnapshot, "entityType") ??
    "—";
  const country =
    snapshotString(note.paymasterSnapshot, "country") ??
    snapshotString(note.paymasterSnapshot, "registrationCountry") ??
    "—";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
  };

  const generate = useMutation({
    mutationFn: async () => {
      const response = await apiClient.generateNoteAssignmentNotice(note.id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Notice of Assignment generated");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const markSent = useMutation({
    mutationFn: async () => {
      const response = await apiClient.markNoteAssignmentNoticeSent(note.id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Notice marked sent");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const confirmAck = useMutation({
    mutationFn: async () => {
      const response = await apiClient.confirmNoteAssignmentNoticeAcknowledgement(note.id);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Paymaster acknowledgement confirmed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const [uploadPending, setUploadPending] = React.useState(false);

  const downloadNotice = async (kind: "notice" | "acknowledgement") => {
    const response = await apiClient.downloadNoteAssignmentNotice(note.id, kind);
    if (!response.success) {
      toast.error(response.error.message);
      return;
    }
    window.open(response.data.downloadUrl, "_blank", "noopener,noreferrer");
  };

  const handleAckFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadPending(true);
    try {
      const upload = await apiClient.requestNoteAssignmentNoticeUploadUrl(note.id, {
        kind: "acknowledgement",
        fileName: file.name,
        contentType: file.type || "application/pdf",
        fileSize: file.size,
      });
      if (!upload.success) throw new Error(upload.error.message);
      await putFile(upload.data.uploadUrl, file);
      const attached = await apiClient.attachNoteAssignmentNoticeFile(note.id, {
        kind: "acknowledgement",
        s3Key: upload.data.s3Key,
        fileName: file.name,
      });
      if (!attached.success) throw new Error(attached.error.message);
      toast.success("Acknowledgement uploaded. Confirm it to complete this step.");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload acknowledgement");
    } finally {
      setUploadPending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const pendingAny =
    generate.isPending || markSent.isPending || confirmAck.isPending || uploadPending;

  return (
    <div className={cn("rounded-xl border p-4", workflowTaskSurfaceClass(tone))}>
      <div className="flex flex-wrap items-center gap-2">
        <WorkflowStepTitle complete={acknowledged} completeLabel="Paymaster assignment complete">
          Paymaster assignment
        </WorkflowStepTitle>
        {acknowledged ? null : (
          <StatusBadge
            label={status ? assignmentNoticeStatusLabel(status) : "Not generated"}
            status={status ? assignmentNoticeStatusToken(status) : "action"}
          />
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{stepDescription(status, acknowledged)}</p>

      {notice?.noticeS3Key && notice.generatedAt ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground">Notice of Assignment</span>
          <span aria-hidden>·</span>
          <span>{format(new Date(notice.generatedAt), "dd MMM yyyy, h:mm a")}</span>
        </div>
      ) : null}

      <div className="mt-2 rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
        <div className="font-medium">Paymaster</div>
        <dl className="mt-1.5 space-y-1 text-muted-foreground">
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
            <dt>Name</dt>
            <dd className="font-medium text-foreground">
              {note.paymasterId ? (
                <Link
                  href={paymasterHref(note.paymasterId)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {paymasterName}
                </Link>
              ) : (
                paymasterName
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
            <dt>SSM / registration</dt>
            <dd className="font-medium text-foreground">{registration}</dd>
          </div>
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
            <dt>Entity type</dt>
            <dd className="font-medium text-foreground">{entityType}</dd>
          </div>
          <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5">
            <dt>Country</dt>
            <dd className="font-medium text-foreground">{country}</dd>
          </div>
        </dl>
      </div>

      <CollapsibleDetailTimeline
        rows={[
          ...(notice?.generatedAt
            ? [
                {
                  label: "Generated",
                  value: format(new Date(notice.generatedAt), "dd MMM yyyy, h:mm a"),
                },
              ]
            : []),
          ...(notice?.sentAt
            ? [
                {
                  label: "Sent",
                  value: format(new Date(notice.sentAt), "dd MMM yyyy, h:mm a"),
                },
              ]
            : []),
          ...(notice?.acknowledgementUploadedAt
            ? [
                {
                  label: "Acknowledgement uploaded",
                  value: format(new Date(notice.acknowledgementUploadedAt), "dd MMM yyyy, h:mm a"),
                },
              ]
            : []),
          ...(notice?.acknowledgedAt
            ? [
                {
                  label: "Acknowledged",
                  value: format(new Date(notice.acknowledgedAt), "dd MMM yyyy, h:mm a"),
                },
              ]
            : []),
        ]}
      />

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
        {!notice || notice.status === "FAILED" ? (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={pendingAny || !canManage}
            title={!canManage ? "You do not have permission to perform this action." : undefined}
            onClick={() => setConfirmAction("generate")}
          >
            <DocumentTextIcon className="h-4 w-4" />
            Generate Notice
          </Button>
        ) : null}
        {notice?.noticeS3Key ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={viewDocumentPending}
            onClick={() => void downloadNotice("notice")}
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            Download Notice
          </Button>
        ) : null}
        {status === "GENERATED" ? (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={pendingAny || !canManage}
            title={!canManage ? "You do not have permission to perform this action." : undefined}
            onClick={() => setConfirmAction("sent")}
          >
            Mark Sent
          </Button>
        ) : null}
        {status === "SENT" || status === "ACKNOWLEDGEMENT_UPLOADED" ? (
          <>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(event) => void handleAckFile(event.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={pendingAny || !canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Acknowledgement
            </Button>
          </>
        ) : null}
        {notice?.acknowledgementFileName ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => void downloadNotice("acknowledgement")}
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            Download Acknowledgement
          </Button>
        ) : null}
        {status === "ACKNOWLEDGEMENT_UPLOADED" ? (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={pendingAny || !canManage}
            title={!canManage ? "You do not have permission to perform this action." : undefined}
            onClick={() => setConfirmAction("confirm")}
          >
            <CheckCircleIcon className="h-4 w-4" />
            Confirm Acknowledgement
          </Button>
        ) : null}
        {pendingAny ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
            Working…
          </span>
        ) : null}
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "generate"
                ? "Generate Notice of Assignment?"
                : confirmAction === "sent"
                  ? "Mark Notice as sent?"
                  : "Confirm Paymaster acknowledgement?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "generate"
                ? "This creates the Notice of Assignment for this financing. Download it and send it to the Paymaster."
                : confirmAction === "sent"
                  ? "Confirm that the Notice has been sent to the Paymaster. This does not mark acknowledgement complete."
                  : "Confirm that the uploaded written acknowledgement is accepted. This completes the Paymaster step for disbursement."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "generate") void generate.mutateAsync();
                if (action === "sent") void markSent.mutateAsync();
                if (action === "confirm") void confirmAck.mutateAsync();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
