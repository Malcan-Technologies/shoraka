import * as React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";

export type PortalBadgePortal = "investor" | "issuer";

const PORTAL_LABEL: Record<PortalBadgePortal, string> = {
  investor: "Investor",
  issuer: "Issuer",
};

const PORTAL_CLASS: Record<PortalBadgePortal, string> = {
  investor: "bg-portal-investor-bg text-portal-investor-text",
  issuer: "bg-portal-issuer-bg text-portal-issuer-text",
};

function normalizePortal(portal: string): PortalBadgePortal {
  return portal.trim().toLowerCase() === "investor" ? "investor" : "issuer";
}

export function PortalBadge({
  portal,
  access,
  className,
  ...props
}: {
  portal: PortalBadgePortal | string;
  /** When set, shows a circled check (granted) or X (no access). Omit on identity chips. */
  access?: boolean;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const key = normalizePortal(portal);
  const inactive = access === false;

  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full shrink-0 items-center rounded-full border border-transparent px-2.5 py-0.5 text-ui font-normal",
        inactive ? "bg-muted text-muted-foreground/60" : PORTAL_CLASS[key],
        className
      )}
      {...props}
    >
      {access === true ? (
        <CheckCircleIcon className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : access === false ? (
        <XCircleIcon className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : null}
      {PORTAL_LABEL[key]}
    </span>
  );
}
