# Admin RBAC Guide

## Overview

The system has four parts:

1. A shared permission vocabulary in `packages/types/src/rbac.ts`
2. A database role catalog in `apps/api/prisma/schema.prisma` (`admin_roles`)
3. Runtime resolution in `apps/api/src/lib/auth/rbac.ts`
4. API and UI enforcement through `requirePermission(...)` and `usePermissions()`

```mermaid
flowchart TD
  Bearer["Bearer JWT (Cognito)"] --> RequireAuth[requireAuth]
  RequireAuth --> UserRow[(users)]
  UserRow --> AdminRow[(admins)]
  AdminRow --> Catalog[(admin_roles)]
  Catalog --> Resolve["resolveAdminAccess()"]
  Resolve --> ReqState["req.adminPermissions"]
  ReqState --> Middleware["requirePermission(...)"]
  Middleware --> Route[Route handler]
  Resolve --> Me["GET /v1/auth/me"]
  Me --> Hook["usePermissions()"]
  Hook --> UiGate["UI gating"]
```

## Permission catalog

Permissions are defined as dotted `resource.action` strings in `packages/types/src/rbac.ts`.

Current live permissions:

- `roles.manage`

The backend and frontend both import from the same source so route guards and UI guards stay aligned.

## Role catalog

`SUPER_ADMIN` is the only built-in admin role. `ensureAdminRoleCatalog()` guarantees that this single
system role exists in `admin_roles`.

Every other admin role is created in the admin portal and persisted directly in `admin_roles`.
There is no longer a seeded default-role catalog in code.

`SUPER_ADMIN` is the only full-access bypass role. All other roles rely on their explicit permission list.

## Runtime flow

1. `requireAuth` verifies the Cognito access token.
2. The API loads the `User` record, then the related `Admin` row and `AdminRoleConfig`.
3. `resolveAdminAccess()` returns the effective `roleKey`, `roleName`, and `permissions`.
4. The request gets `req.admin`, `req.adminPermissions`, `req.adminRoleKey`, and `req.adminRoleName`.
5. Route middleware such as `requirePermission("roles.manage")` enforces access.
6. `GET /v1/auth/me` returns the same resolved permission set for the frontend.

## Current enforcement

The live permission catalog is intentionally small until more routes are migrated.

- `GET /v1/admin/roles` requires `roles.manage`
- `POST /v1/admin/roles` requires `roles.manage`
- `DELETE /v1/admin/roles/:key` requires `roles.manage`
- `PATCH /v1/admin/roles/:key/permissions` requires `roles.manage`
- `PUT /v1/admin/admin-users/:id/role` requires `roles.manage`

`/settings/roles` and `/settings/roles/configuration` are also gated in the admin UI on `roles.manage`.

`SUPER_ADMIN` is the only built-in role with the full-access bypass. All other roles must be created
and configured in the catalog before they can be assigned or used in invitations.

## Add a new permission

1. Add the permission string to `ADMIN_PERMISSIONS` in `packages/types/src/rbac.ts`.
2. Add it to `ADMIN_PERMISSION_GROUPS` so the configuration UI can render it.
3. Enforce it on the API route with `requirePermission(...)`.
4. Gate the related UI using `usePermissions().can(...)` or `usePermissions().canAny(...)`.

## Create a role

Roles other than `SUPER_ADMIN` are created at runtime through the admin role catalog.

1. Open `/settings/roles/configuration` in the admin portal.
2. Use `Create role` to add a new catalog entry. The role key is generated automatically from the role name.
3. Save the permission matrix for the new role.
4. Pick a badge color using the custom color input.
5. Assign the role through the admin user table or invitation dialog.

Created roles are stored in `admin_roles`, and admin assignments/invitations persist the role key string
while `role_id` remains the authoritative relation to the catalog row. The selected badge color is
stored alongside the role record.

## Delete a role

Roles can be deleted from `/settings/roles/configuration` when they are no longer in use.

- `SUPER_ADMIN` cannot be deleted.
- A role cannot be deleted while any admins are still assigned to it.
- A role cannot be deleted while any pending invitations still reference it.

Reassign admins and revoke or replace pending invitations before deleting the role.

## Enforce on a route

Use the middleware in `apps/api/src/lib/auth/middleware.ts`:

```ts
router.put(
  "/admin-users/:id/role",
  requirePermission("roles.manage"),
  handler
);
```

Use `requireAnyPermission(...)` when one of several permissions should unlock a route.

## Gate the UI

The API is the real security boundary. UI gating is for navigation, layout, and affordances only.

### Hook

Use `apps/admin/src/hooks/use-permissions.ts`:

```tsx
const { can, canAny, isLoading } = usePermissions();

if (isLoading) {
  return <Skeleton className="h-10 w-40" />;
}

const canManageRoles = can("roles.manage");
const canReviewOrManage = canAny("applications.review", "applications.manage");
```

`SUPER_ADMIN` bypasses permission checks in `can()` and `canAny()`. Everyone else is checked against
the permission list from `GET /v1/auth/me`.

### Block a whole page

Wrap the page body in `RequirePermission` from `apps/admin/src/components/require-permission.tsx`:

```tsx
<RequirePermission permission="roles.manage">
  <RolesPageContent />
</RequirePermission>
```

While permissions are loading, the component shows skeleton placeholders. When access is denied, it renders `AccessDeniedCard` instead of the page content.

### Hide navigation or sections

Conditionally render links, buttons, or menu items:

```tsx
const { can } = usePermissions();
const canManageRoles = can("roles.manage");

{canManageRoles ? (
  <Link href="/settings/roles">Roles & Users</Link>
) : null}
```

For grouped nav, filter children before mapping. See `apps/admin/src/components/app-sidebar.tsx`, which hides `/settings/roles` unless `can("roles.manage")` is true.

### Disable an action with feedback

Keep the control visible but block the mutation when access is missing:

```tsx
<Button
  disabled={!canManageRoles}
  onClick={handleStartEditRole}
>
  Edit role
</Button>
```

Pair disabled controls with a guard in the handler so keyboard or programmatic triggers still fail safely:

```tsx
const handleStartEditRole = () => {
  if (!canManageRoles) {
    toast.error("Cannot edit role", {
      description: "Your role does not have permission to manage admin roles.",
    });
    return;
  }

  setIsEditingRole(true);
};
```

See `apps/admin/src/components/admin-user-table-row.tsx` for this pattern.

### Inline feature gates

For smaller UI fragments, prefer a direct `can()` check over `RequirePermission`:

```tsx
{can("roles.manage") ? <InviteAdminDialog /> : null}
```

Use `RequirePermission` when the entire route segment should be inaccessible, and `can()` when only part of a page should change.
