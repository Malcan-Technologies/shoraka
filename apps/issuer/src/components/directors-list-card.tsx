"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { UserGroupIcon, IdentificationIcon, GlobeAltIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useCorporateEntities } from "../hooks/use-corporate-entities";
import { Skeleton } from "@/components/ui/skeleton";

interface DirectorsListCardProps {
  organizationId: string;
}

export function DirectorsListCard({ organizationId }: DirectorsListCardProps) {
  const { data, isLoading } = useCorporateEntities(organizationId);

  const directors = data?.directors || [];

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

  if (directors.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-3 p-6 border-b">
          <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Directors / Controllers / Authorised Personnel</h2>
            <p className="text-sm text-muted-foreground">Directors and authorized personnel details</p>
          </div>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <p>No directors found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-6 border-b">
        <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Directors / Controllers / Authorised Personnel</h2>
          <p className="text-sm text-muted-foreground">Directors and authorized personnel details</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {directors.map((director: any, index: number) => (
          <div key={index} className="p-4 rounded-xl border bg-muted/30">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{director.name || "—"}</h3>
                {director.position && (
                  <Badge variant="outline" className="mt-1">
                    {director.position}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {director.idNumber && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IdentificationIcon className="h-4 w-4" />
                  <span>ID: {director.idNumber}</span>
                </div>
              )}
              {director.nationality && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GlobeAltIcon className="h-4 w-4" />
                  <span>{director.nationality}</span>
                </div>
              )}
              {director.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Email: {director.email}</span>
                </div>
              )}
              {director.address && (
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{director.address}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
