"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DepositReturnDialog } from "@/components/deposit-return-dialog";
import {
  hrefWithoutDepositReturn,
  isDepositReturnDismissed,
  markDepositReturnDismissed,
} from "@/components/deposit-return-params";

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
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(Boolean(depositId) && !isDepositReturnDismissed(depositId ?? ""));
  }, [depositId]);

  function clearDepositReturnParam() {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : pathname;
    const currentSearch =
      typeof window !== "undefined" ? window.location.search : searchParams.toString();
    const nextUrl = hrefWithoutDepositReturn(currentPath, currentSearch);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
    router.replace(nextUrl, { scroll: false });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && depositId) {
      markDepositReturnDismissed(depositId);
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
