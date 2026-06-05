"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import * as z from "zod";
import {
  ADMIN_PERMISSION_GROUPS,
  DEFAULT_ADMIN_ROLE_BADGE_COLOR,
  type AdminRoleBadgeColor,
  type AdminRoleKey,
  type AdminPermission,
} from "@cashsouk/types";
import { Checkbox, Skeleton } from "@cashsouk/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  getAdminRoleDisplayInfo,
} from "./admin-role-metadata";
import {
  useCreateAdminRole,
  useDeleteAdminRole,
  useAdminRoleConfigs,
  useUpdateAdminRolePermissions,
} from "@/hooks/use-admin-role-config";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";

const createAdminRoleSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters").max(80),
  key: z
    .string()
    .trim()
    .min(1, "Role key is required")
    .max(80)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Role key must start with a letter and contain only uppercase letters, numbers, and underscores"
    ),
  description: z.string().trim().max(240).optional(),
  badgeColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9A-Fa-f]{6})$/, "Badge color must be a valid 6-digit hex color"),
});

type CreateAdminRoleFormValues = z.infer<typeof createAdminRoleSchema>;
type CreateAdminRoleFormData = Omit<CreateAdminRoleFormValues, "badgeColor"> & {
  badgeColor: AdminRoleBadgeColor;
};

function slugifyRoleKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

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

function BadgeColorPicker({
  value,
  onChange,
  disabled = false,
  previewName,
  previewRoleKey,
}: {
  value: AdminRoleBadgeColor;
  onChange: (value: AdminRoleBadgeColor) => void;
  disabled?: boolean;
  previewName: string;
  previewRoleKey: AdminRoleKey;
}) {
  const previewDisplay = getAdminRoleDisplayInfo(previewRoleKey, previewName, undefined, value);
  const PreviewIcon = previewDisplay.icon;

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <input
            type="color"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value.toUpperCase() as AdminRoleBadgeColor)}
            className="h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed"
            aria-label="Choose custom badge color"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Custom color</p>
            <p className="text-xs text-muted-foreground">{value}</p>
          </div>
          <Badge
            variant="outline"
            className="ml-2 inline-flex items-center gap-1.5 border font-medium"
            style={previewDisplay.badgeStyle}
          >
            <PreviewIcon className="h-3 w-3" style={previewDisplay.iconStyle} />
            {previewDisplay.name}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function AdminPermissionConfiguration() {
  const { can } = usePermissions();
  const canManageRoles = can("roles.manage");
  const { data: roles = [], isLoading, refetch } = useAdminRoleConfigs();
  const createRole = useCreateAdminRole();
  const deleteRole = useDeleteAdminRole();
  const updateRolePermissions = useUpdateAdminRolePermissions();
  const [selectedRoleKey, setSelectedRoleKey] = React.useState<string>("");
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [draftPermissions, setDraftPermissions] = React.useState<AdminPermission[]>([]);
  const [draftBadgeColor, setDraftBadgeColor] = React.useState<AdminRoleBadgeColor>(
    DEFAULT_ADMIN_ROLE_BADGE_COLOR
  );
  const createRoleForm = useForm<CreateAdminRoleFormData>({
    resolver: zodResolver(createAdminRoleSchema),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      badgeColor: DEFAULT_ADMIN_ROLE_BADGE_COLOR,
    },
  });
  const createRoleValues = useWatch({
    control: createRoleForm.control,
  }) as CreateAdminRoleFormData;

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
    setDraftBadgeColor(selectedRole?.badgeColor ?? DEFAULT_ADMIN_ROLE_BADGE_COLOR);
  }, [selectedRole?.key, selectedRole?.permissions, selectedRole?.badgeColor]);

  const selectedDisplay = selectedRole
    ? getAdminRoleDisplayInfo(
        selectedRole.key,
        selectedRole.name,
        selectedRole.description,
        selectedRole.badgeColor
      )
    : null;
  const deleteBlockedReason = selectedRole?.isSystem
    ? "Super Admin cannot be deleted."
    : selectedRole && selectedRole.memberCount > 0
      ? `Reassign the ${selectedRole.memberCount} admin${
          selectedRole.memberCount === 1 ? "" : "s"
        } using this role before deleting it.`
      : null;
  const hasUnsavedChanges =
    selectedRole !== null &&
    (JSON.stringify([...draftPermissions].sort()) !==
      JSON.stringify([...(selectedRole.permissions ?? [])].sort()) ||
      draftBadgeColor !== selectedRole.badgeColor);

  const togglePermission = (permission: AdminPermission, checked: boolean) => {
    setDraftPermissions((current) =>
      checked
        ? Array.from(new Set([...current, permission]))
        : current.filter((item) => item !== permission)
    );
  };

  const handleSave = async () => {
    if (!selectedRole || !canManageRoles) {
      return;
    }

    try {
      await updateRolePermissions.mutateAsync({
        roleKey: selectedRole.key,
        data: {
          permissions: draftPermissions,
          badgeColor: draftBadgeColor,
        },
      });
      toast.success("Role updated", {
        description: `${selectedDisplay?.name ?? "Role"} changes were saved.`,
      });
    } catch (error) {
      toast.error("Failed to update role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  React.useEffect(() => {
    if (!createDialogOpen) {
      createRoleForm.reset({
        name: "",
        key: "",
        description: "",
        badgeColor: DEFAULT_ADMIN_ROLE_BADGE_COLOR,
      });
    }
  }, [createDialogOpen, createRoleForm]);

  React.useEffect(() => {
    createRoleForm.setValue("key", slugifyRoleKey(createRoleValues.name || ""), {
      shouldValidate: createRoleValues.name.length > 0,
    });
  }, [createRoleForm, createRoleValues.name]);

  const handleCreateRole = async (values: CreateAdminRoleFormData) => {
    const roleKey = slugifyRoleKey(values.name);

    try {
      const createdRole = await createRole.mutateAsync({
        key: roleKey,
        name: values.name,
        description: values.description?.trim() || undefined,
        badgeColor: values.badgeColor,
      });
      setSelectedRoleKey(createdRole.key);
      setCreateDialogOpen(false);
      toast.success("Role created", {
        description: `${createdRole.name} is ready for permission setup.`,
      });
    } catch (error) {
      toast.error("Failed to create role", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.isSystem) {
      return;
    }

    try {
      const remainingRole = roles.find((role) => role.key !== selectedRole.key) ?? null;
      await deleteRole.mutateAsync(selectedRole.key);
      setDeleteDialogOpen(false);
      setSelectedRoleKey(remainingRole?.key ?? "");
      toast.success("Role deleted", {
        description: `${selectedDisplay?.name ?? selectedRole.name} was removed from the catalog.`,
      });
    } catch (error) {
      toast.error("Failed to delete role", {
        description:
          error instanceof Error
            ? error.message
            : "Reassign admins and revoke pending invitations before deleting this role.",
      });
    }
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
              Review, create, and update the admin role catalog for Shoraka.
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
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Role Catalog</CardTitle>
              <CardDescription>
                Super Admin stays protected, and every other admin role is created and managed here.
              </CardDescription>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canManageRoles}
              className="h-10 rounded-xl gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Create role
            </Button>
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
                const display = getAdminRoleDisplayInfo(
                  role.key,
                  role.name,
                  role.description,
                  role.badgeColor
                );
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
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                            style={display.badgeStyle}
                          >
                            <Icon className="h-4 w-4" style={display.iconStyle} />
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
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle>{selectedDisplay.name}</CardTitle>
                      {selectedRole.isSystem && <Badge variant="default">System</Badge>}
                      {!selectedRole.isEditable && <Badge variant="outline">Locked</Badge>}
                    </div>
                    <CardDescription className="max-w-2xl">
                      {selectedDisplay.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
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
                      disabled={isLoading || updateRolePermissions.isPending || deleteRole.isPending}
                      className="h-11 rounded-xl"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Refresh
                    </Button>
                    {selectedRole.isEditable && (
                      <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={!canManageRoles || deleteRole.isPending}
                        className="h-11 rounded-xl border-destructive/30 bg-destructive/5 text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      >
                        Delete role
                      </Button>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={
                        !canManageRoles ||
                        !hasUnsavedChanges ||
                        updateRolePermissions.isPending ||
                        deleteRole.isPending
                      }
                      className="h-11 rounded-xl"
                    >
                      {updateRolePermissions.isPending ? "Saving..." : "Save changes"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Badge Color
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pick the badge color used across the role catalog, admin list, and invitations.
                    </p>
                  </div>
                  <BadgeColorPicker
                    value={draftBadgeColor}
                    onChange={setDraftBadgeColor}
                    disabled={!canManageRoles}
                    previewName={selectedDisplay?.name ?? "Role Preview"}
                    previewRoleKey={selectedRole.key}
                  />
                </div>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {!isLoading && !selectedRole && (
              <Card className="border-border bg-muted/20 shadow-none">
                <CardContent className="p-4 text-sm text-muted-foreground">
                  No admin roles are available yet. Create one to start assigning admin access.
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Admin Role</DialogTitle>
            <DialogDescription>
              Add a custom admin role, then assign the exact permissions it needs.
            </DialogDescription>
          </DialogHeader>

          <Form {...createRoleForm}>
            <form onSubmit={createRoleForm.handleSubmit(handleCreateRole)} className="space-y-4">
              <FormField
                control={createRoleForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Portfolio Operations"
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createRoleForm.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        tabIndex={-1}
                        placeholder="Generated from role name"
                        className="h-11 rounded-xl font-mono bg-muted text-muted-foreground cursor-not-allowed"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Generated automatically from the role name.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createRoleForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Handles portfolio operations without broader platform admin access."
                        className="min-h-24 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createRoleForm.control}
                name="badgeColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge color</FormLabel>
                    <FormControl>
                      <BadgeColorPicker
                        value={field.value as AdminRoleBadgeColor}
                        onChange={(nextColor) => field.onChange(nextColor)}
                        disabled={createRole.isPending}
                        previewName={createRoleValues.name?.trim() || "Role Preview"}
                        previewRoleKey={(createRoleValues.key?.trim() ||
                          "ROLE_PREVIEW") as AdminRoleKey}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  className="h-11 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRole.isPending}
                  className="h-11 rounded-xl"
                >
                  {createRole.isPending ? "Creating..." : "Create role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedDisplay
                ? `Delete ${selectedDisplay.name} from the admin role catalog.`
                : "Delete this role from the admin role catalog."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedRole?.memberCount ? (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p>{deleteBlockedReason}</p>
              <p className="mt-2 opacity-70">
                Pending invitations using this role must also be cleared before deletion can succeed.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Deleting this role removes it from the catalog. If any pending invitations still use it,
              the delete request will be rejected until those invitations are revoked or replaced.
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteRole();
              }}
              disabled={Boolean(deleteBlockedReason)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRole.isPending ? "Deleting..." : "Delete role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
