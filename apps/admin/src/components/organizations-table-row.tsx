import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { OrganizationResponse } from "@cashsouk/types";
import {
  UserIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface OrganizationsTableRowProps {
  organization: OrganizationResponse;
}

export function OrganizationsTableRow({ organization }: OrganizationsTableRowProps) {
  const displayName =
    organization.type === "COMPANY"
      ? organization.name || "Unnamed Company"
      : `${organization.owner.firstName} ${organization.owner.lastName}`;

  return (
    <TableRow className="odd:bg-muted/40 hover:bg-muted">
      {/* Organization */}
      <TableCell className="text-[15px] leading-7">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg mt-0.5",
              organization.type === "COMPANY" ? "bg-accent/10" : "bg-muted"
            )}
          >
            {organization.type === "COMPANY" ? (
              <BuildingOffice2Icon className="h-4 w-4 text-accent" />
            ) : (
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="font-medium">{displayName}</div>
            {organization.registrationNumber && (
              <div className="text-xs text-muted-foreground">
                SSM: {organization.registrationNumber}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Portal */}
      <TableCell>
        <Badge
          variant="outline"
          className={cn(
            "capitalize",
            organization.portal === "investor"
              ? "border-primary/30 text-primary"
              : "border-accent/30 text-accent"
          )}
        >
          {organization.portal}
        </Badge>
      </TableCell>

      {/* Type */}
      <TableCell>
        <Badge variant="secondary" className="capitalize">
          {organization.type.toLowerCase()}
        </Badge>
      </TableCell>

      {/* Owner */}
      <TableCell className="text-[15px] leading-7">
        <div>
          <div className="font-medium">
            {organization.owner.firstName} {organization.owner.lastName}
          </div>
          <div className="text-xs text-muted-foreground">{organization.owner.email}</div>
        </div>
      </TableCell>

      {/* Onboarding Status */}
      <TableCell>
        {organization.onboardingStatus === "COMPLETED" ? (
          <Badge
            variant="outline"
            className="border-green-500/30 text-green-600 bg-green-500/10"
          >
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-amber-500/30 text-amber-600 bg-amber-500/10"
          >
            <ClockIcon className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )}
      </TableCell>

      {/* Members */}
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <UsersIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{organization.memberCount}</span>
        </div>
      </TableCell>

      {/* Created */}
      <TableCell className="text-[15px] leading-7 text-muted-foreground">
        {format(new Date(organization.createdAt), "dd MMM yyyy")}
      </TableCell>
    </TableRow>
  );
}

