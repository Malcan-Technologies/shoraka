"use client";

import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import type { AdminPermission } from "@cashsouk/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@cashsouk/ui";
import { usePermissions } from "@/hooks/use-permissions";

interface RequirePermissionProps {
  permission: AdminPermission;
  children: React.ReactNode;
}

export function AccessDeniedCard() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-md w-full shadow-sm">
        <CardContent className="flex flex-col items-center text-center py-12 px-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldExclamationIcon className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to access this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!can(permission)) {
    return <AccessDeniedCard />;
  }

  return <>{children}</>;
}
