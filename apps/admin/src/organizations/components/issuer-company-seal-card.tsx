"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE,
  SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE,
  SIGNINGCLOUD_LEGAL_IMAGE_UNSUPPORTED_TYPE_MESSAGE,
  humanizeApiValidationMessage,
  profileValidationErrorFromApi,
  signingCloudLegalImageDeclaredFileRejection,
} from "@cashsouk/types";
import { ConfirmDialog, EmptyState } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permissions";
import { uploadFileToS3 } from "@/lib/upload-file-to-s3";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatUploadedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SealPreview({ organizationId }: { organizationId: string }) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const previewQuery = useQuery({
    queryKey: ["issuer-company-seal-preview", organizationId],
    queryFn: async () => {
      const res = await api.getIssuerCompanySealPreview(organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data.viewUrl;
    },
  });

  if (previewQuery.isLoading) {
    return <p className="text-ui text-muted-foreground">Loading preview…</p>;
  }
  if (!previewQuery.data) {
    return <p className="text-ui text-muted-foreground">Company seal</p>;
  }

  return (
    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border bg-background p-2">
      <img
        src={previewQuery.data}
        alt="Company seal"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function IssuerCompanySealAdminCard({
  org,
  organizationId,
}: {
  org: import("@cashsouk/types").OrganizationDetailResponse;
  organizationId: string;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { can } = usePermissions();

  const currentUserId = currentUser?.user?.id ?? null;
  const isOwner = org.owner.userId === currentUserId;
  const member = org.members.find((m) => m.userId === currentUserId) ?? null;
  const canViewViaPermission = can("organizations.view");
  const canManageViaPermission = can("organizations.manage");

  const canView = canViewViaPermission || Boolean(isOwner || member);
  const canManage = canManageViaPermission || Boolean(isOwner || member?.role === "ORGANIZATION_ADMIN");

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [removeOpen, setRemoveOpen] = React.useState(false);

  const sealQuery = useQuery({
    queryKey: ["issuer-company-seal", organizationId],
    enabled: canView,
    queryFn: async () => {
      const res = await api.getIssuerCompanySeal(organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data.seal;
    },
  });

  const invalidate = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["issuer-company-seal", organizationId] });
    await queryClient.invalidateQueries({ queryKey: ["issuer-company-seal-preview", organizationId] });
  }, [organizationId, queryClient]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const rejection = signingCloudLegalImageDeclaredFileRejection(file.type, file.size);
      if (rejection) throw new Error(rejection);

      const uploadUrlRes = await api.requestIssuerCompanySealUploadUrl(organizationId, {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      if (!uploadUrlRes.success) throw profileValidationErrorFromApi(uploadUrlRes.error);

      await uploadFileToS3(uploadUrlRes.data.uploadUrl, file);

      const confirmed = await api.confirmIssuerCompanySeal(organizationId, {
        s3Key: uploadUrlRes.data.s3Key,
        fileName: file.name,
      });

      if (!confirmed.success) throw profileValidationErrorFromApi(confirmed.error);
      return confirmed.data.seal;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Company seal saved");
    },
    onError: (error: Error) => {
      toast.error(humanizeApiValidationMessage(error.message));
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await api.deleteIssuerCompanySeal(organizationId);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Company seal removed");
    },
    onError: (error: Error) => {
      toast.error(humanizeApiValidationMessage(error.message));
    },
  });

  const seal = sealQuery.data ?? null;
  const busy = upload.isPending || remove.isPending;
  const openPicker = () => fileInputRef.current?.click();

  const SEAL_HELP = `${SIGNINGCLOUD_LEGAL_IMAGE_UNSUPPORTED_TYPE_MESSAGE} ${SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE} ${SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE}`;

  return (
    <Card id="profile-company-seal" className="rounded-2xl">
      <CardContent className="p-6">
        {canView ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <SealPreview organizationId={organizationId} />
                <div className="space-y-1">
                  <p className="text-ui font-medium">Company seal</p>
                  <p className="text-meta text-muted-foreground">
                    {seal?.fileName ?? "No company seal uploaded"}
                  </p>
                  {seal?.createdAt ? (
                    <p className="text-meta text-muted-foreground">
                      Uploaded {formatUploadedAt(seal.createdAt)}
                    </p>
                  ) : null}
                  <p className="text-meta text-muted-foreground">{SEAL_HELP}</p>
                </div>
              </div>

              {canManage ? (
                <div className="flex flex-col items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) upload.mutate(file);
                    }}
                  />

                  <Button type="button" className="h-10 text-ui" disabled={busy} onClick={openPicker}>
                    {upload.isPending ? "Uploading…" : seal ? "Replace" : "Upload"}
                  </Button>

                  {seal ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 text-ui"
                      disabled={busy}
                      onClick={() => setRemoveOpen(true)}
                    >
                      <TrashIcon className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!seal && !canManage ? (
              <EmptyState
                icon={<PhotoIcon className="h-6 w-6" aria-hidden />}
                title="No company seal yet"
                message={SEAL_HELP}
              />
            ) : null}
          </div>
        ) : (
          <p className="text-ui text-muted-foreground">Not authorized to view this company seal.</p>
        )}
      </CardContent>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove company seal"
        description="Remove the active company seal? Historical signing packages keep the version they used."
        confirmText="Remove"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutateAsync()}
      />
    </Card>
  );
}

