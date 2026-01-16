"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { BuildingOffice2Icon, MapPinIcon } from "@heroicons/react/24/outline";
import { useCorporateEntities } from "../hooks/use-corporate-entities";
import { Skeleton } from "@/components/ui/skeleton";

interface BusinessShareholdersListCardProps {
  organizationId: string;
}

export function BusinessShareholdersListCard({ organizationId }: BusinessShareholdersListCardProps) {
  const { data, isLoading } = useCorporateEntities(organizationId);

  const businessShareholders = data?.corporateShareholders || [];

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="p-6 border-b">
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="p-6 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (businessShareholders.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-3 p-6 border-b">
          <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Business Shareholders / Beneficiaries</h2>
            <p className="text-sm text-muted-foreground">Corporate shareholder details</p>
          </div>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <p>No business shareholders found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-6 border-b">
        <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Business Shareholders / Beneficiaries</h2>
          <p className="text-sm text-muted-foreground">Corporate shareholder details</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {businessShareholders.map((shareholder: any, index: number) => (
          <div key={index} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground">{shareholder.businessName || "—"}</h3>
              </div>
              {shareholder.shareholdingPercentage !== undefined && (
                <Badge className="ml-2">{shareholder.shareholdingPercentage}%</Badge>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {shareholder.registrationNumber && (
                <div>
                  <span className="text-muted-foreground font-medium">Registration Number:</span>
                  <p className="mt-1">{shareholder.registrationNumber}</p>
                </div>
              )}
              {shareholder.country && (
                <div>
                  <span className="text-muted-foreground font-medium">Country:</span>
                  <p className="mt-1">{shareholder.country}</p>
                </div>
              )}
              {shareholder.address && (
                <div className="sm:col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPinIcon className="h-4 w-4" />
                    <span className="font-medium">Address:</span>
                  </div>
                  <p className="mt-1 ml-6">{shareholder.address}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
