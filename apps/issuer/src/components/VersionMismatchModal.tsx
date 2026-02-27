/* Modal: VersionMismatchModal
 *
 * Purpose:
 * - Display when product has been updated or deleted.
 * - Offer user to Restart (clear app, go to /new) or Cancel (stay blocked).
 * - Used by edit page guard when isMismatch is true.
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

interface VersionMismatchModalProps {
  open: boolean;
  blockReason?: "PRODUCT_DELETED" | "PRODUCT_VERSION_CHANGED" | null;
  applicationId?: string;
  onOpenChange?: (open: boolean) => void;
  // optional primary action (used by /new to refresh products instead of archive)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>
            {blockReason === "PRODUCT_DELETED"
              ? "Product No Longer Available"
              : "Product Updated"}
          </DialogTitle>
          <DialogDescription>
            {blockReason === "PRODUCT_DELETED" ? (
              <>
                The financing product used for this application has been removed
                and is no longer available. To continue, please start a new
                application with a different product.
              </>
            ) : (
              <>
                This financing product has been updated with new requirements.
                To continue, you'll need to restart your application using the
                latest version.
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
