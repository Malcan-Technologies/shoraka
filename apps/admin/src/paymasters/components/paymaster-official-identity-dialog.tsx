"use client";

import * as React from "react";
import { toast } from "sonner";
import { paymasterMasterIdentityFields } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PaymasterOfficialIdentityFields,
  validatePaymasterOfficialIdentity,
  type PaymasterOfficialIdentityFormErrors,
  type PaymasterOfficialIdentityFormValue,
} from "@/paymasters/components/paymaster-official-identity-fields";
import {
  useUpdatePaymasterIdentity,
  useVerifyPaymaster,
} from "@/paymasters/hooks/use-paymasters";

type OfficialIdentityPaymaster = Parameters<typeof paymasterMasterIdentityFields>[0] & {
  id?: string | null;
};

function formValueFromPaymaster(
  paymaster: OfficialIdentityPaymaster | null | undefined
): PaymasterOfficialIdentityFormValue {
  const fields = paymaster ? paymasterMasterIdentityFields(paymaster) : null;
  return {
    legalName: fields?.name ?? "",
    registrationNumber: fields?.ssm_number ?? "",
    country: (fields?.country ?? "MY").toUpperCase(),
    entityType: fields?.entity_type ?? "",
  };
}

export function PaymasterOfficialIdentityDialog({
  mode,
  open,
  onOpenChange,
  paymaster,
  applicationId,
}: {
  mode: "edit" | "verify";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymaster?: OfficialIdentityPaymaster | null;
  applicationId?: string;
}) {
  const updateIdentity = useUpdatePaymasterIdentity();
  const verifyPaymaster = useVerifyPaymaster();
  const [value, setValue] = React.useState<PaymasterOfficialIdentityFormValue>(() =>
    formValueFromPaymaster(paymaster)
  );
  const [errors, setErrors] = React.useState<PaymasterOfficialIdentityFormErrors>({});
  const pending = updateIdentity.isPending || verifyPaymaster.isPending;

  React.useEffect(() => {
    if (!open) return;
    setValue(formValueFromPaymaster(paymaster));
    setErrors({});
  }, [open, paymaster]);

  const resolvedId = String(paymaster?.id ?? "").trim();

  const onSubmit = async () => {
    if (!resolvedId) return;
    const nextErrors = validatePaymasterOfficialIdentity(value);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const identity = {
      legalName: value.legalName.trim(),
      country: value.country.trim().toUpperCase(),
      entityType: value.entityType.trim(),
    };
    try {
      if (mode === "verify") {
        await verifyPaymaster.mutateAsync({
          paymasterId: resolvedId,
          applicationId,
          ...identity,
        });
        toast.success("Paymaster identity reviewed");
      } else {
        await updateIdentity.mutateAsync({
          paymasterId: resolvedId,
          ...identity,
        });
        toast.success("Paymaster identity updated");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : mode === "verify"
            ? "Could not verify Paymaster"
            : "Could not update Paymaster"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "verify" ? "Verify Paymaster identity" : "Edit Paymaster Details"}
          </DialogTitle>
          <DialogDescription>
            {mode === "verify"
              ? "Confirm or correct the official Paymaster identity. SSM cannot be changed. This verifies identity only and does not approve the application, invoice, Notice, or MARC assessment."
              : "Update the official Paymaster identity. SSM cannot be changed. This does not notify customers or rewrite historical snapshots."}
          </DialogDescription>
        </DialogHeader>
        <PaymasterOfficialIdentityFields
          value={value}
          errors={errors}
          onChange={setValue}
          disabled={pending}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl text-ui"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl text-ui"
            disabled={pending || !resolvedId}
            onClick={() => void onSubmit()}
          >
            {mode === "verify"
              ? pending
                ? "Verifying…"
                : "Verify Paymaster"
              : pending
                ? "Saving…"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
