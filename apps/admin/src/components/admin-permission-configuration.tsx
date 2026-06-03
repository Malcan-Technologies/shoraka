"use client";

import * as React from "react";
import Link from "next/link";
import {
  ADMIN_PERMISSION_GROUPS,
  DEFAULT_ADMIN_ROLE_TEMPLATES,
  type AdminRole,
  type AdminPermission,
} from "@cashsouk/types";
import { Checkbox, Skeleton } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { ADMIN_ROLE_DISPLAY } from "./admin-role-metadata";
import {
  useAdminRoleConfigs,
  useUpdateAdminRolePermissions,
} from "@/hooks/use-admin-role-config";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

const DEFAULT_ROLE_TEMPLATE_BY_KEY = new Map(
  DEFAULT_ADMIN_ROLE_TEMPLATES.map((role) => [role.key, role])
);

function permissionLabel(permission: AdminPermission): string {
  return permission
    .split(".")
    .map((part) =>
      part
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(" - ");
}

export function AdminPermissionConfiguration() {
  const { can } = usePermissions();
  const canManageRoles = can("roles.manage");
  const { data: roles = [], isLoading, refetch } = useAdminRoleConfigs();
  const updateRolePermissions = useUpdateAdminRolePermissions();
  const [selectedRoleKey, setSelectedRoleKey] = React.useState<string>("");
  const [draftPermissions, setDraftPermissions] = React.useState<AdminPermission[]>([]);

  React.useEffect(() => {
    if (!selectedRoleKey && roles[0]?.key) {
      setSelectedRoleKey(roles[0].key);
    }
  }, [roles, selectedRoleKey]);

  const selectedRole =
    roles.find((role) => role.key === selectedRoleKey) ?? roles[0] ?? null;
  const selectedPermissionSet = React.useMemo(
    () => new Set(draftPermissions),
    [draftPermissions]
  );

  React.useEffect(() => {
    setDraftPermissions(selectedRole?.permissions ?? []);
  }, [selectedRole?.key, selectedRole?.permissions]);

  const selectedDisplay = selectedRole
    ? ADMIN_ROLE_DISPLAY[selectedRole.key as AdminRole]
    : null;
  const seededDefaults = selectedRole
    ? DEFAULT_ROLE_TEMPLATE_BY_KEY.get(selectedRole.key)?.permissions ?? []
    : [];
  const hasUnsavedChanges =
    selectedRole !== null &&
    JSON.stringify([...draftPermissions].sort()) !==
      JSON.stringify([...(selectedRole.permissions ?? [])].sort());

  const togglePermission = (permission: AdminPermission, checked: boolean) => {
    setDraftPermissions((current) =>
      checked
        ? Array.from(new Set([...current, permission]))
        : current.filter((item) => item !== permission)
    );
  };

  const handleSave = async () => {
    if (!selectedRole || !canManageRoles || !selectedRole.isEditable) {
      return;
    }

    try {
      await updateRolePermissions.mutateAsync({
        roleKey: selectedRole.key,
        data: {
          permissions: draftPermissions,
        },
      });
      toast.success("Permissions updated", {
        description: `${selectedDisplay?.name ?? "Role"} permissions were saved.`,
      });
    } catch (error) {
      toast.error("Failed to update permissions", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const handleRestoreDefaults = () => {
    setDraftPermissions([...seededDefaults]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Button variant="ghost" asChild className="-ml-3 w-fit px-3">
            <Link href="/settings/roles">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Roles & Users
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Permission Configuration
            </h1>
            <p className="text-[15px] leading-7 text-muted-foreground mt-1 max-w-3xl">
              Review and update the seeded admin role catalog for the existing
              Shoraka admin roles.
            </p>
          </div>
        </div>
        <Card className="min-w-[240px] border-border bg-muted/20 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldCheckIcon className="h-5 w-5 text-primary shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {selectedRole ? draftPermissions.length : 0} permissions enabled
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedDisplay ? `Assigned to ${selectedDisplay.name}` : "Loading role catalog"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle>Role Catalog</CardTitle>
            <CardDescription>
              Existing seeded roles can be updated here. Creating new roles is
              still deferred.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))
            ) : (
              roles.map((role) => {
                const isSelected = role.key === selectedRole?.key;
                const display = ADMIN_ROLE_DISPLAY[role.key as AdminRole];
                const Icon = display.icon;

                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => setSelectedRoleKey(role.key)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${display.borderColor} ${display.bgColor}`}
                          >
                            <Icon className={`h-4 w-4 ${display.color}`} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{display.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {role.key}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {display.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {role.memberCount}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {role.isSystem && <Badge variant="default">System</Badge>}
                      {role.isDefault && <Badge variant="secondary">Default</Badge>}
                      {!role.isEditable && <Badge variant="outline">Locked</Badge>}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="space-y-4">
            {isLoading || !selectedRole || !selectedDisplay ? (
              <div className="space-y-4">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-4 w-full max-w-2xl" />
                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>{selectedDisplay.name}</CardTitle>
                      {selectedRole.isSystem && <Badge variant="default">System</Badge>}
                      {selectedRole.isDefault && <Badge variant="secondary">Default</Badge>}
                      {!selectedRole.isEditable && <Badge variant="outline">Locked</Badge>}
                    </div>
                    <CardDescription className="max-w-2xl">
                      {selectedDisplay.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="rounded-xl border bg-muted/20 px-4 py-3 text-right">
                      <p className="text-sm font-medium">
                        {draftPermissions.length} permissions enabled
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedRole.memberCount} assigned admin
                        {selectedRole.memberCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => void refetch()}
                      disabled={isLoading || updateRolePermissions.isPending}
                      className="h-11 rounded-xl"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Refresh
                    </Button>
                    {selectedRole.isEditable && (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleRestoreDefaults}
                          disabled={!canManageRoles || updateRolePermissions.isPending}
                          className="h-11 rounded-xl"
                        >
                          Restore seeded defaults
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={!canManageRoles || !hasUnsavedChanges || updateRolePermissions.isPending}
                          className="h-11 rounded-xl"
                        >
                          {updateRolePermissions.isPending ? "Saving..." : "Save changes"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Role Key
                    </p>
                    <p className="mt-2 text-sm font-medium">{selectedRole.key}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Catalog Source
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      `DEFAULT_ADMIN_ROLE_TEMPLATES`
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Configuration Mode
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {canManageRoles ? "Editable for role managers" : "Read-only for your access level"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {!isLoading && !selectedRole && (
              <Card className="border-border bg-muted/20 shadow-none">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No admin roles are available yet. Refresh the page after the RBAC catalog is seeded.
                </CardContent>
              </Card>
            )}

            <Separator />

            <div className="space-y-6">
              {selectedRole && ADMIN_PERMISSION_GROUPS.map((group) => {
                const grantedCount = group.permissions.filter((permission) =>
                  selectedPermissionSet.has(permission)
                ).length;

                return (
                  <section key={group.key} className="space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h2 className="text-base font-semibold">{group.label}</h2>
                        <p className="text-sm text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {grantedCount}/{group.permissions.length} enabled
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const checked = selectedPermissionSet.has(permission);

                        return (
                          <div
                            key={permission}
                            className={`rounded-xl border p-4 transition-colors ${
                              checked
                                ? "border-primary/30 bg-primary/5"
                                : "border-border bg-background"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={checked}
                                disabled={!canManageRoles || !selectedRole.isEditable}
                                aria-label={permission}
                                onCheckedChange={(nextChecked) =>
                                  togglePermission(permission, nextChecked === true)
                                }
                              />
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium">
                                  {permissionLabel(permission)}
                                </p>
                                <p className="text-xs text-muted-foreground break-all">
                                  {permission}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
