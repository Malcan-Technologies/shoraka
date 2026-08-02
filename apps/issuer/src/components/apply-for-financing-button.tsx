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

type ApplyForFinancingButtonProps = {
  className?: string;
  variant?: "default" | "link" | "outline" | "secondary" | "ghost" | "destructive";
  showIcon?: boolean;
  children?: ReactNode;
};

/**
 * Apply CTA that stays visible when legal re-acceptance is pending,
 * but redirects to /onboarding/terms instead of starting a new application.
 */
export function ApplyForFinancingButton({
  className,
  variant = "default",
  showIcon = true,
  children = "Apply for financing",
}: ApplyForFinancingButtonProps) {
  const router = useRouter();
  const { shouldIntercept } = useLegalReacceptanceGate("issuer");

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldIntercept("NEW_FINANCING_APPLICATION")) return;
    event.preventDefault();
    toast.message(legalReacceptanceInterceptMessage("issuer"));
    router.push(LEGAL_REACCEPTANCE_REDIRECT);
  };

  return (
    <Button asChild variant={variant} className={cn(className)}>
      <Link href="/applications/new" onClick={onClick}>
        {showIcon ? <PlusIcon className="h-4 w-4" /> : null}
        {children}
      </Link>
    </Button>
  );
}
