"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OnboardingFeeReturnDialog } from "@/components/onboarding-fee-return-dialog";

function resolveReturnTo(value: string | null, pathname: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return pathname;
  }
  return value;
}

export function OnboardingFeeReturnListener() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feeId = searchParams.get("onboardingFeeReturn");
  const returnTo = resolveReturnTo(searchParams.get("returnTo"), pathname);
  const [open, setOpen] = React.useState(Boolean(feeId));

  React.useEffect(() => {
    setOpen(Boolean(feeId));
  }, [feeId]);

  function clearReturnParam() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("onboardingFeeReturn");
    params.delete("returnTo");
    const query = params.toString();
    router.replace(query ? `${returnTo}?${query}` : returnTo);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearReturnParam();
    }
  }

  if (!feeId) {
    return null;
  }

  return (
    <OnboardingFeeReturnDialog feeId={feeId} open={open} onOpenChange={handleOpenChange} />
  );
}
