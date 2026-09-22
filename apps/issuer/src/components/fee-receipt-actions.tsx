"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import type { GatewayPaymentReceiptStatus } from "@cashsouk/types";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ReceiptPdfResponse = {
  url: string | null;
  expiresIn: number | null;
  fileName: string | null;
  mode: "view" | "download";
  hasPdf: boolean;
  receiptStatus: GatewayPaymentReceiptStatus | null;
};

export function FeeReceiptActions({
  endpoint,
  receiptActionLabel = "receipt",
}: {
  endpoint: string;
  receiptActionLabel?: string;
}) {
  const { getAccessToken } = useAuthToken();

  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const receiptPdfQuery = useMutation({
    mutationFn: async ({ mode }: { mode: "view" | "download" }) => {
      const res = await apiClient.get<ReceiptPdfResponse>(
        `${endpoint}?mode=${mode}`
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  async function openReceipt(mode: "view" | "download") {
    try {
      const data = await receiptPdfQuery.mutateAsync({ mode });

      if (!data.url) {
        const status = data.receiptStatus ? ` (${data.receiptStatus})` : "";
        if (data.receiptStatus === "PENDING") {
          toast.info(`Your ${receiptActionLabel} is not ready yet${status}.`);
          return;
        }
        if (data.receiptStatus === "FAILED") {
          toast.error(`Your ${receiptActionLabel} could not be generated${status}.`);
          return;
        }
        toast.info(`Your ${receiptActionLabel} is not available yet${status}.`);
        return;
      }

      if (mode === "view") {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = data.url;
      if (data.fileName) anchor.download = data.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not open ${receiptActionLabel}`);
    }
  }

  const disabled = receiptPdfQuery.isPending;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-xl"
        disabled={disabled}
        onClick={() => void openReceipt("view")}
      >
        View receipt
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-xl"
        disabled={disabled}
        onClick={() => void openReceipt("download")}
      >
        Download
      </Button>
    </div>
  );
}

