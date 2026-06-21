---
title: "Admin Roles and Permissions Guide"
description: "How roles and permissions work in the admin portal, written for non-technical operations users."
category: "Platform Operations"
tags:
  - admin
  - rbac
  - permissions
  - operations
order: 25
updated: 2026-06-18
---

# Admin Roles and Permissions Guide

---
## 1. What roles and permissions are

Roles decide what an admin user can see or do in the admin portal.

Each role contains permissions.

View permissions usually allow reading or viewing.

Manage permissions usually allow making changes or performing actions.

---
## 2. Super Admin

Super Admin has full access to everything.

Super Admin permissions do not need to be manually selected.

Super Admin cannot be restricted like a normal role.

The platform must always have at least one active Super Admin.

The last active Super Admin cannot be deactivated or changed to another role.

---
## 3. How to create a role

1. Go to `Settings → Roles`.
2. Open `Permission Configuration`.
3. Click `Create Role`.
4. Enter the role name and description.
5. Select the required permissions.
6. Use `Select all / Clear all` within each section if needed.
7. Save the role.

---
## 4. How to change a role’s permissions

1. Go to `Settings → Roles`.
2. Open `Permission Configuration`.
3. Select the role.
4. Tick or untick permissions.
5. Save changes.

Users assigned to the role may need to refresh or log in again to see the latest permissions.

---
## 5. How to invite an admin user

1. Go to `Settings → Roles`.
2. Click `Invite Admin User`.
3. Enter the user’s email.
4. Select a role.
5. Send the invitation.

Pending invitations are not active users yet.

A pending Super Admin invitation does not count as an active Super Admin until accepted.

---
## 6. How to change an admin user’s role

1. Go to `Settings → Roles`.
2. Find the admin user.
3. Change the role.
4. Save or confirm the change.

The user may need to log out and log back in.

---
## 7. How to deactivate an admin user

1. Go to `Settings → Roles`.
2. Find the admin user.
3. Click `Deactivate`.
4. Confirm.

The last active Super Admin cannot be deactivated.

