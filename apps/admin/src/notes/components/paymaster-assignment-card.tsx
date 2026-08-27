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
  ASSIGNMENT_NOTICE_LEGAL_TEMPLATE_PENDING,
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
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
import { WorkflowStepTitle } from "@/notes/components/note-detail-ui-blocks";
import { workflowTaskSurfaceClass } from "@/notes/utils/workflow-status-tokens";
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

function readinessCopy(status: PaymasterAssignmentNoticeStatus | null | undefined): string {
  if (status === "ACKNOWLEDGED") return "Paymaster acknowledgement confirmed.";
  if (status === "ACKNOWLEDGEMENT_UPLOADED") {
    return "Acknowledgement uploaded. Confirm it before disbursement.";
  }
  if (status === "SENT") {
    return "Waiting for written Paymaster acknowledgement.";
  }
  if (status === "GENERATED") {
    return "Notice generated. Mark it sent after it is delivered to the Paymaster.";
  }
  return "Generate the Notice of Assignment after the existing execution pack is complete.";
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
      toast.success("Acknowledgement uploaded. Confirm it to satisfy the disbursement prerequisite.");
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
  const status = notice?.status ?? null;

  return (
    <div className={cn("rounded-xl border p-4", workflowTaskSurfaceClass(acknowledged ? "success" : "active"))}>
      <div className="flex flex-wrap items-center gap-2">
        <WorkflowStepTitle complete={acknowledged} completeLabel="Paymaster / Assignment complete">
          Paymaster / Assignment
        </WorkflowStepTitle>
        {status ? (
          <StatusBadge
            label={assignmentNoticeStatusLabel(status)}
            status={assignmentNoticeStatusToken(status)}
          />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{readinessCopy(status)}</p>
      {!acknowledged ? (
        <p className="mt-1 text-xs text-muted-foreground">{PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE}</p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Paymaster</dt>
          <dd className="font-medium">
            {note.paymasterId ? (
              <Link href={paymasterHref(note.paymasterId)} className="text-primary underline-offset-4 hover:underline">
                {paymasterName}
              </Link>
            ) : (
              paymasterName
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">SSM / registration</dt>
          <dd className="font-mono">{registration}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Entity type</dt>
          <dd>{entityType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Country</dt>
          <dd>{country}</dd>
        </div>
      </dl>

      {notice?.generatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Generated {format(new Date(notice.generatedAt), "dd MMM yyyy, h:mm a")}
          {notice.sentAt ? ` · Sent ${format(new Date(notice.sentAt), "dd MMM yyyy, h:mm a")}` : ""}
          {notice.acknowledgedAt
            ? ` · Acknowledged ${format(new Date(notice.acknowledgedAt), "dd MMM yyyy, h:mm a")}`
            : ""}
        </p>
      ) : null}

      {notice?.templatePending ? (
        <p className="mt-2 text-xs text-muted-foreground">{ASSIGNMENT_NOTICE_LEGAL_TEMPLATE_PENDING}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
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

      <p className="mt-3 text-xs font-medium">
        Disbursement readiness: {acknowledged ? "Ready (Paymaster acknowledgement)" : "Blocked"}
      </p>

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
                ? "This records assignment particulars for this financing. Approved legal wording is pending if shown on the document."
                : confirmAction === "sent"
                  ? "Confirm that the Notice has been sent to the Paymaster. This does not mark acknowledgement complete."
                  : "Confirm that the uploaded written acknowledgement is accepted. This satisfies the Paymaster prerequisite for disbursement."}
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
