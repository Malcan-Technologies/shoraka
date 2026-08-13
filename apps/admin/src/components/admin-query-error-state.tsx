"use client";

import { AccessDeniedCard } from "@/components/require-permission";
import { isAdminApiForbiddenError } from "@/lib/handle-api-auth-error";

interface AdminQueryErrorStateProps {
  error: unknown;
  resourceLabel?: string;
}

export function AdminQueryErrorState({
  error,
  resourceLabel = "this data",
}: AdminQueryErrorStateProps) {
  if (isAdminApiForbiddenError(error)) {
    return <AccessDeniedCard />;
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="font-semibold text-destructive">Unable to load {resourceLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

interface AdminQueryGateProps {
  error: unknown;
  children: React.ReactNode;
  resourceLabel?: string;
}

/** Renders Access Denied for 403, a system error for other failures, or children when the query succeeded. */
export function AdminQueryGate({ error, children, resourceLabel }: AdminQueryGateProps) {
  if (!error) {
    return <>{children}</>;
  }

  return <AdminQueryErrorState error={error} resourceLabel={resourceLabel} />;
}
