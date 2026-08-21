"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { BuildingOffice2Icon, EyeIcon } from "@heroicons/react/24/outline";
import type { UserDetailResponse, UserOrganizationSummary } from "@cashsouk/types";
import { PortalBadge, StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { OrganizationTypeBadge } from "@/components/organization-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { orgHref } from "@/lib/admin-directory-hrefs";
import { adminActionRowClass } from "@/lib/admin-status-token";
import { getOrganizationOnboardingPresentation } from "@/lib/organization-status";

type OrganizationFilter = "all" | "investor" | "issuer";

function OrganizationRow({ organization }: { organization: UserOrganizationSummary }) {
  const { can } = usePermissions();
  const canViewOrgs = can("organizations.view");
  const title =
    organization.name ??
    (organization.type === "COMPANY" ? "Unnamed company" : "Personal organization");
  const onboarding = getOrganizationOnboardingPresentation(organization.onboardingStatus);

  return (
    <TableRow
      className={
        onboarding.status === "action"
          ? adminActionRowClass(true)
          : "odd:bg-muted/40 hover:bg-muted"
      }
    >
      <TableCell>
        <PortalBadge portal={organization.portal} />
      </TableCell>
      <TableCell className="min-w-[260px]">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
          <OrganizationTypeBadge type={organization.type} />
          {organization.registrationNumber ? <span>{organization.registrationNumber}</span> : null}
          {organization.isSophisticatedInvestor ? <span>Sophisticated investor</span> : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {organization.relationship}
          {organization.memberRole ? ` · ${organization.memberRole.toLowerCase()}` : ""}
        </Badge>
      </TableCell>
      <TableCell>
        <StatusBadge label={onboarding.label} status={onboarding.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-ui">{organization.memberCount}</TableCell>
      <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
        {format(new Date(organization.updatedAt), "dd MMM yyyy")}
      </TableCell>
      <TableCell>
        {canViewOrgs ? (
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href={orgHref(organization.portal, organization.id)}>
              <EyeIcon className="mr-1 h-4 w-4" />
              View
            </Link>
          </Button>
        ) : (
          <span className="text-ui text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function UserAccountOrganizationsPanel({ user }: { user: UserDetailResponse }) {
  const [activeFilter, setActiveFilter] = React.useState<OrganizationFilter>("all");
  const organizations = [...user.organizations.investor, ...user.organizations.issuer].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const filtered =
    activeFilter === "all"
      ? organizations
      : organizations.filter((org) => org.portal === activeFilter);
  const filters: { value: OrganizationFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: organizations.length },
    { value: "investor", label: "Investor", count: user.organizations.investor.length },
    { value: "issuer", label: "Issuer", count: user.organizations.issuer.length },
  ];

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BuildingOffice2Icon}
        title="Organizations"
        description="Investor and issuer organizations where this user is an owner or member."
      />
      <CardContent className="space-y-4 p-0 pb-4">
        <div className="flex flex-wrap gap-2 px-6">
          {filters.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={activeFilter === filter.value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
              <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-meta">
                {filter.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto px-6">
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Portal</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No organizations found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((org) => (
                    <OrganizationRow key={`${org.portal}-${org.id}`} organization={org} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
