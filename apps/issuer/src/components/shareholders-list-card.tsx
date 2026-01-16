"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { UserIcon, IdentificationIcon, GlobeAltIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useCorporateEntities } from "../hooks/use-corporate-entities";
import { Skeleton } from "@/components/ui/skeleton";

interface ShareholdersListCardProps {
  organizationId: string;
}

export function ShareholdersListCard({ organizationId }: ShareholdersListCardProps) {
  const { data, isLoading } = useCorporateEntities(organizationId);

  const shareholders = data?.shareholders || [];

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

  if (shareholders.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-3 p-6 border-b">
          <UserIcon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Individual Shareholders / Ultimate Beneficiaries</h2>
            <p className="text-sm text-muted-foreground">Individual shareholder details</p>
          </div>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <p>No individual shareholders found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-6 border-b">
        <UserIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Individual Shareholders / Ultimate Beneficiaries</h2>
          <p className="text-sm text-muted-foreground">Individual shareholder details</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {shareholders.map((shareholder: any, index: number) => (
          <div key={index} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground">{shareholder.name || "—"}</h3>
              </div>
              {shareholder.shareholdingPercentage !== undefined && (
                <Badge className="ml-2">{shareholder.shareholdingPercentage}%</Badge>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {shareholder.idNumber && (
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IdentificationIcon className="h-4 w-4" />
                    <span className="font-medium">ID/Passport:</span>
                  </div>
                  <p className="mt-1 ml-6">{shareholder.idNumber}</p>
                </div>
              )}
              {shareholder.nationality && (
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GlobeAltIcon className="h-4 w-4" />
                    <span className="font-medium">Nationality:</span>
                  </div>
                  <p className="mt-1 ml-6">{shareholder.nationality}</p>
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
