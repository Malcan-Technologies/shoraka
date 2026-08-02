"use client";

import type { ReactNode, MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  LEGAL_REACCEPTANCE_REDIRECT,
  legalReacceptanceInterceptMessage,
  useLegalReacceptanceGate,
} from "@cashsouk/ui";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InvestNowButtonProps = {
  className?: string;
  href?: string;
  showIcon?: boolean;
  children?: ReactNode;
};

/**
 * Invest CTA that redirects to /onboarding/terms when re-acceptance is pending.
 * Backend createInvestment still enforces LEGAL_REACCEPTANCE_REQUIRED.
 */
export function InvestNowButton({
  className,
  href = "/marketplace",
  showIcon = true,
  children = "Invest now",
}: InvestNowButtonProps) {
  const router = useRouter();
  const { shouldIntercept } = useLegalReacceptanceGate("investor");

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldIntercept("NEW_INVESTMENT")) return;
    event.preventDefault();
    toast.message(legalReacceptanceInterceptMessage("investor"));
    router.push(LEGAL_REACCEPTANCE_REDIRECT);
  };

  return (
    <Button asChild className={cn("gap-2", className)}>
      <Link href={href} onClick={onClick}>
        {showIcon ? <PlusIcon className="h-4 w-4" /> : null}
        {children}
      </Link>
    </Button>
  );
}
