"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DepositReturnDialog } from "@/components/deposit-return-dialog";

function resolveReturnTo(value: string | null, pathname: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return pathname;
  }
  return value;
}

export function DepositReturnListener() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const depositId = searchParams.get("depositReturn");
  const returnTo = resolveReturnTo(searchParams.get("returnTo"), pathname);
  const [open, setOpen] = React.useState(Boolean(depositId));

  React.useEffect(() => {
    setOpen(Boolean(depositId));
  }, [depositId]);

  function clearDepositReturnParam() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("depositReturn");
    params.delete("returnTo");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearDepositReturnParam();
    }
  }

  if (!depositId) {
    return null;
  }

  return (
    <DepositReturnDialog
      depositId={depositId}
      returnTo={returnTo}
      open={open}
      onOpenChange={handleOpenChange}
    />
  );
}
