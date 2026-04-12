/* Modal: VersionMismatchModal
 *
 * Purpose:
 * - Display when product has been updated or is no longer available.
 * - Offer user to Restart (clear app, go to /new) or Cancel (stay blocked).
 * - Used by edit and new application flows when version guard blocks.
 */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useArchiveApplication } from "@/hooks/use-applications";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { IssuerProductBlockReason } from "@cashsouk/types";

interface VersionMismatchModalProps {
  open: boolean;
  blockReason?: IssuerProductBlockReason;
  applicationId?: string;
  onOpenChange?: (open: boolean) => void;
  primaryLabel?: string;
  onPrimary?: () => Promise<void> | void;
}

export function VersionMismatchModal({
  open,
  blockReason,
  applicationId,
  onOpenChange,
  primaryLabel,
  onPrimary,
}: VersionMismatchModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const archiveMutation = useArchiveApplication();

  const handleRestart = async () => {
    if (!applicationId) return;
    try {
      await archiveMutation.mutateAsync(applicationId);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      router.replace("/applications/new");
    } catch {
      toast.error("Unable to restart. Please try again.");
    }
  };

  const handlePrimary = async () => {
    if (onPrimary) {
      try {
        await onPrimary();
      } catch {
        toast.error("Action failed. Please try again.");
      }
      return;
    }
    await handleRestart();
  };

  const isVersionUpdated = blockReason === "PRODUCT_VERSION_CHANGED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>
            {isVersionUpdated ? "Product Updated" : "Product No Longer Available"}
          </DialogTitle>
          <DialogDescription>
            {isVersionUpdated ? (
              <>
                This financing product has been updated with new requirements.
                To continue, you&apos;ll need to restart your application using the
                latest version.
              </>
            ) : (
              <>
                This application does not have a valid financing product selected,
                or the product is no longer available. To continue, please start a
                new application and select an available product.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
          <DialogFooter>
            <Button
              onClick={handlePrimary}
              className="w-full"
              disabled={archiveMutation.isPending && !onPrimary}
            >
              {archiveMutation.isPending && !onPrimary
                ? "Working..."
                : primaryLabel || "Start New Application"}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
