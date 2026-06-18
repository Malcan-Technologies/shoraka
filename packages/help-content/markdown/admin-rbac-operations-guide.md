---
title: "Admin RBAC Operations Guide"
description: "What each RBAC permission allows in the admin portal, written for non-developer admin and operations users."
category: "Platform Operations"
tags:
  - admin
  - rbac
  - permissions
  - operations
order: 25
updated: 2026-06-18
---

# Admin RBAC Operations Guide

This guide helps non-developer admin and operations users understand how **Role-Based Access Control (RBAC)** works in the CashSouk Admin Portal, and how to use the **Roles & Permissions** settings.

---
## 1. What RBAC means (in plain terms)
RBAC controls what each admin user can **see** and **do**.

- Admin users are assigned a **role**.
- A role contains **permissions**.
- Permissions decide which pages and actions are available.

In general:
- **View permissions** let a user open a page and read information.
- **Manage permissions** let a user take actions or make changes.

---
## 2. What “Super Admin” means
**Super Admin** is the platform-owned level with full access.

- Super Admin can access **all admin pages and actions**.
- Super Admin does not need permissions to be selected manually.
- Super Admin is protected from deletion/restrictions like normal roles.

Safety rule (important):
- The platform must always keep **at least one active Super Admin**.
- Do not deactivate or change the last active Super Admin, or role/permission management can become unavailable from the admin portal.

---
## 3. What “system/default/editable” means
In the Roles UI, roles are shown with simple labels:

### System role
A **system role** is protected and owned by the platform. It is not edited like a normal role.

In this project, the only system role is **Super Admin**.

### Editable role
An **editable role** is a role you can create and configure in the UI.

### Default role
“Default” is a starter flag used for compatibility. For everyday operations, treat this as “not important for choosing permissions.”

Notes:
- Finance Officer / Operations Officer / Compliance Officer are not built-in system roles unless they already exist as roles in your tenant.
- You can create these roles (or adjust them) to match your team’s needs.

---
## 4. How to create a role
1. Go to **Settings → Roles**.
2. Open **Permission Configuration** (or the role permission setup area).
3. Click **Create role**.
4. Enter:
   - Role name
   - (Optional) Description
5. Select the permissions you need.
6. Use **Select all / Clear all** per section if you want to quickly enable a whole area.
7. Click **Save changes**.

Tip:
- If you are unsure, start with **view** permissions, then add **manage** permissions only for actions the user must perform.

---
## 5. How role permissions work (and how to reason about them)
Permissions are shown in **sections** (for example, Dashboard, Notes, Applications). These section names help you group permissions for selection.

Key point:
- The **section name** is only grouping. Access depends on which **specific permissions** you select.

General guidance:
- Use `*.view` permissions when the user should be able to open and read.
- Use `*.manage` permissions when the user should be able to take actions.

Some workflow steps (especially in Notes workflows) require dedicated manage permissions.

---
## 6. Dashboard behavior (what users will see)
Dashboard permissions control what summary information appears on the dashboard.

Common examples:
- A user can sometimes see **finance dashboard summary widgets** without being allowed to open the full **Bucket Balances** page.
- Quick action cards typically depend on access to the target page/module. If the user cannot access the target, the quick action card may not show.

---
## 7. How to invite admin users
1. Go to **Settings → Roles**.
2. Click **Invite Admin User**.
3. Enter the user’s email.
4. Choose a role.
5. Send the invite.

Important:
- Pending invitations do **not** count as active admins until the invite is accepted and the admin becomes active.
- A Super Admin invitation does not count as “an active Super Admin” until it is accepted and active.

---
## 8. How to change an admin user’s role
1. Go to **Settings → Roles**.
2. Find the admin user.
3. Change their role to the one you want.
4. Save/confirm.

After changing a role, the user may need to log out and log back in so the updated permissions fully refresh.

---
## 9. How to deactivate an admin user
1. Go to **Settings → Roles**.
2. Find the admin user.
3. Click **Deactivate**.
4. Confirm.

Safety rule:
- You cannot deactivate the **last active Super Admin**.

---
## 10. Permission reference (business-friendly)
Use this as a quick guide to what each permission area enables.

- **Dashboard**: view dashboard and summary sections.
- **Notes**: manage note lifecycle, repayments, settlements, defaults, and disbursement workflow (workflow actions typically require manage permissions).
- **Applications**: review submitted financing applications. Comments/read access vs approve/manage access may require different permissions.
- **Onboarding**: review onboarding approval queue and perform onboarding approval actions.
- **Users**: view/edit admin user accounts.
- **Organizations**: view/edit organizations and fetch/generate CTOS reports if allowed.
- **Roles**: view roles and permission settings; manage roles and admin access if allowed.
- **Notifications**: manage notification settings, groups, and send actions if allowed.
- **Audit Logs**: view audit log pages that are allowed for your role.
- **Finance**: view finance operational panels (for example, bucket balances, repayments, service fee panels, and issuer payout lists).
- **Platform Settings**: view/edit platform finance settings (if allowed).
- **Products**: view/edit product settings.
- **Documents**: manage platform/help/site documents.
- **Contracts**: view contract records and perform contract offer actions (such as re-sign) if allowed.

---
## 11. Suggested role examples (starting points)
These are examples only. You should adjust permissions based on your team’s responsibilities.

- **Super Admin**: full access (protected).
- **Compliance Officer**: focuses on compliance reviews and regulatory-related checks.
- **Operations Officer**: handles day-to-day operations and common workflow approvals.
- **Finance Officer**: focuses on finance monitoring and payout/settlement/disbursement-related actions.
- **Read-only Auditor**: can view audit and operational records without making changes.

---
## 12. Quick tips for setting permissions safely
- Prefer **view** first. Add **manage** only when the user must take actions.
- Use **Select all / Clear all** per section for faster setup, then carefully review the final selection.
- Before changing or deactivating a Super Admin, confirm there is another active Super Admin.
