"use client";

import Link from "next/link";
import { LinkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { resolveIssuerFacilityLink } from "./facility-tied";

export function FacilityTiedAnchor({
  contractId,
  displayReference,
}: {
  contractId?: string | null;
  displayReference?: string | null;
}) {
  const link = resolveIssuerFacilityLink({ contractId, displayReference });
  if (!link) return null;
  return (
    <Link
      href={link.href}
      className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
    >
      <span className="min-w-0 truncate">{link.label}</span>
      <LinkIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
    </Link>
  );
}

export function FacilityTiedLink({
  contractId,
  displayReference,
  className,
}: {
  contractId?: string | null;
  displayReference?: string | null;
  className?: string;
}) {
  const link = resolveIssuerFacilityLink({ contractId, displayReference });
  if (!link) return null;
  return (
    <p className={cn("text-ui leading-7 text-foreground", className)}>
      <span className="font-normal text-muted-foreground">Facility: </span>
      <FacilityTiedAnchor contractId={contractId} displayReference={displayReference} />
    </p>
  );
}
