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
          <div key={index} className="p-4 rounded-xl border bg-muted/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{shareholder.businessName || "—"}</h3>
                {shareholder.shareholdingPercentage !== undefined && (
                  <Badge variant="outline" className="mt-1">
                    {shareholder.shareholdingPercentage}% ownership
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {shareholder.registrationNumber && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Registration: {shareholder.registrationNumber}</span>
                </div>
              )}
              {shareholder.country && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Country: {shareholder.country}</span>
                </div>
              )}
              {shareholder.address && (
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{shareholder.address}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
