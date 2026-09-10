"use client";

import { format } from "date-fns";
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@cashsouk/ui";
import { toTitleCase } from "@cashsouk/types";
import {
  kycAmlScreeningRiskToken,
  kycAmlScreeningStatusToken,
} from "@/lib/kyc-aml-screening-badge-classes";

export type OrganizationKycResponseData = {
  tags?: string[];
  status?: string;
  assignee?: string;
  systemId?: string;
  requestId?: string;
  riskLevel?: string;
  riskScore?: string;
  timestamp?: string;
  referenceId?: string;
  onboardingId?: string;
  messageStatus?: string;
  possibleMatchCount?: number;
  blacklistedMatchCount?: number;
};

export function OrganizationKycResponseCard({
  data,
}: {
  data: OrganizationKycResponseData | null;
}) {
  if (!data) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-card-title">
          <ShieldExclamationIcon className="h-4 w-4" />
          KYC/AML Screening Result
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {data.status ? (
            <div className="flex items-center gap-2">
              <span className="text-meta text-muted-foreground">Status:</span>
              <StatusBadge
                label={toTitleCase(data.status)}
                status={kycAmlScreeningStatusToken(data.status)}
              />
            </div>
          ) : null}
          {data.riskLevel ? (
            <div className="flex items-center gap-2">
              <span className="text-meta text-muted-foreground">Risk Level:</span>
              <StatusBadge
                label={toTitleCase(data.riskLevel)}
                status={kycAmlScreeningRiskToken(data.riskLevel)}
              />
            </div>
          ) : null}
          {data.riskScore ? (
            <div className="flex items-center gap-2">
              <span className="text-meta text-muted-foreground">Risk Score:</span>
              <Badge variant="outline">{data.riskScore}</Badge>
            </div>
          ) : null}
        </div>

        {(data.possibleMatchCount !== undefined || data.blacklistedMatchCount !== undefined) && (
          <div className="flex flex-wrap gap-4 rounded-lg bg-muted/50 p-3">
            {data.possibleMatchCount !== undefined ? (
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon
                  className={`h-4 w-4 ${data.possibleMatchCount > 0 ? "text-status-action-text" : "text-muted-foreground"}`}
                />
                <span className="text-ui">
                  <span className="font-medium">{data.possibleMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    possible {data.possibleMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            ) : null}
            {data.blacklistedMatchCount !== undefined ? (
              <div className="flex items-center gap-2">
                <ShieldExclamationIcon
                  className={`h-4 w-4 ${data.blacklistedMatchCount > 0 ? "text-status-rejected-text" : "text-muted-foreground"}`}
                />
                <span className="text-ui">
                  <span className="font-medium">{data.blacklistedMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    blacklisted {data.blacklistedMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-ui">
          {data.systemId ? (
            <div>
              <div className="text-meta text-muted-foreground">System ID</div>
              <div className="font-mono">{data.systemId}</div>
            </div>
          ) : null}
          {data.requestId ? (
            <div>
              <div className="text-meta text-muted-foreground">Request ID</div>
              <div className="font-mono">{data.requestId}</div>
            </div>
          ) : null}
          {data.onboardingId ? (
            <div>
              <div className="text-meta text-muted-foreground">Onboarding ID</div>
              <div className="font-mono">{data.onboardingId}</div>
            </div>
          ) : null}
          {data.messageStatus ? (
            <div>
              <div className="text-meta text-muted-foreground">Message Status</div>
              <div>{data.messageStatus}</div>
            </div>
          ) : null}
          {data.timestamp ? (
            <div className="col-span-2">
              <div className="text-meta text-muted-foreground">Screening Date</div>
              <div>{format(new Date(data.timestamp), "PPpp")}</div>
            </div>
          ) : null}
        </div>

        {data.tags && data.tags.length > 0 ? (
          <div>
            <div className="mb-2 text-meta text-muted-foreground">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
