"use client";

import Link from "next/link";
import { format } from "date-fns";
import { LinkIcon } from "@heroicons/react/24/outline";
import type { OrganizationDetailResponse } from "@cashsouk/types";
import { formatOrganizationReference } from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountHref } from "@/lib/admin-directory-hrefs";
import { usePermissions } from "@/hooks/use-permissions";

function QuickLink({
  label,
  value,
  href,
  display,
}: {
  label: string;
  value: string | null;
  href?: string | null;
  display?: string | null;
}) {
  return (
    <div className="space-y-1">
      <div className="text-meta text-muted-foreground">{label}</div>
      {value ? (
        href ? (
          <Link
            href={href}
            className="block break-all font-mono text-ui font-medium text-primary underline-offset-4 hover:underline"
          >
            {display ?? value}
          </Link>
        ) : (
          <div className="break-all font-mono text-ui font-medium">{display ?? value}</div>
        )
      ) : (
        <div className="text-ui text-muted-foreground">—</div>
      )}
    </div>
  );
}

export function OrganizationQuickLinksCard({
  org,
}: {
  org: OrganizationDetailResponse;
}) {
  const { can } = usePermissions();
  const ownerHref = can("users.view") ? accountHref(org.owner.userId) : null;
  const ownerName = `${org.owner.firstName} ${org.owner.lastName}`.trim();
  const reference = formatOrganizationReference({
    displayReference: org.displayReference,
    id: org.id,
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <LinkIcon className="h-4 w-4 text-primary" />
        </div>
        <CardTitle>Quick Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-ui">
        <QuickLink
          label="Owner account"
          value={org.owner.userId}
          href={ownerHref}
          display={ownerName ? `${ownerName} (${org.owner.userId})` : org.owner.userId}
        />
        <QuickLink label="Organization reference" value={reference} />
        <QuickLink label="Organization ID" value={org.id} />
        {org.type === "COMPANY" && org.codRequestId ? (
          <QuickLink label="COD" value={org.codRequestId} />
        ) : null}
        {org.type === "COMPANY" ? (
          <div className="space-y-1">
            <div className="text-meta text-muted-foreground">Members</div>
            <div className="text-ui font-medium">{org.members.length}</div>
          </div>
        ) : null}
        <QuickLink label="Created" value={format(new Date(org.createdAt), "dd MMM yyyy, p")} />
        <QuickLink label="Updated" value={format(new Date(org.updatedAt), "dd MMM yyyy, p")} />
      </CardContent>
    </Card>
  );
}
