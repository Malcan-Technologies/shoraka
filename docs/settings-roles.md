# Settings/Roles Feature Documentation

## Overview

The Settings/Roles feature is an administrative interface located at `/settings/roles` in the admin portal. It allows Super Admins to manage admin users, assign roles, send invitations, and control access to the platform.

## Feature Overview

The Settings/Roles page provides comprehensive admin user management capabilities:

- View all admin users with their roles and status
- Invite new admin users via email or invitation link
- Manage admin roles (Super Admin, Compliance Officer, Operations Officer, Finance Officer)
- Activate/deactivate admin accounts
- View and manage pending invitations
- Search and filter admin users

## Admin Roles

The system supports four distinct admin roles, each with specific permissions and responsibilities:

### Super Admin

**Description:** Full administrative access to all platform features and settings. Can manage all users, configure system settings, and oversee all operations.

**Permissions:**
- Complete access to all modules
- User and role management
- Security and RBAC configuration
- Platform settings and limits
- All compliance and operational tools

### Compliance Officer

**Description:** Manages regulatory compliance, KYC verification, and fraud prevention. Ensures platform adheres to Malaysian financial regulations and Shariah principles.

**Permissions:**
- KYC and AML verification
- Sanctions screening and blacklist management
- Regulatory reporting
- Access logs and audit trails
- Data export for compliance

### Operations Officer

**Description:** Handles day-to-day platform operations including loan management, user support, and communication. Oversees investment processing and customer service.

**Permissions:**
- Loan and investment management
- User account operations
- Repayment and transaction records
- Customer support tools
- Marketing and communications

### Finance Officer

**Description:** Manages financial operations including fund disbursements and payment processing. Monitors transaction flows and financial compliance.

**Permissions:**
- Disbursement triggering
- Financial compliance viewing
- Data export for finance
- Limited loan operations access

## User Interface Components

### 1. Admin Users Table

Displays all admin users with the following information:

- User ID (5-character unique identifier)
- Name (First and Last)
- Email address
- Admin Role (Super Admin, Compliance Officer, Operations Officer, Finance Officer)
- Status (ACTIVE or INACTIVE)
- Created date
- Actions (Edit role, Activate/Deactivate)

### 2. Pending Invitations Table

Shows all pending admin invitations with:

- Email address
- Role
- Invited by (admin user who sent the invitation)
- Invited date
- Expiry date
- Actions (Resend invitation, Revoke invitation)

### 3. Invite Admin Dialog

Allows Super Admins to invite new admin users through two methods:

- **Email Invitation:** Send invitation directly to email address
- **Invitation Link:** Generate a shareable invitation link

### 4. Search and Filter Toolbar

Provides filtering capabilities:

- **Search:** Search by name, email, or user ID
- **Role Filter:** Filter by admin role
- **Status Filter:** Filter by ACTIVE or INACTIVE status
- **Clear Filters:** Reset all filters
- **Reload:** Refresh the data

## Admin Invitation Flow

### Method 1: Email Invitation

1. Super Admin navigates to `/settings/roles`
2. Clicks "Invite Admin User" button
3. Fills in email address and selects role
4. Clicks "Send Invitation Email"
5. Backend creates invitation record and sends email via AWS SES
6. Email contains invitation link with token
7. User clicks link and completes OAuth signup/login
8. Backend accepts invitation during OAuth callback
9. User is granted ADMIN role and admin status set to ACTIVE

### Method 2: Invitation Link

1. Super Admin navigates to `/settings/roles`
2. Clicks "Invite Admin User" button
3. Selects role (email is optional)
4. Clicks "Generate Invitation Link"
5. Backend creates invitation record and returns invitation URL
6. Super Admin copies and shares the link
7. User clicks link and completes OAuth signup/login
8. Backend accepts invitation during OAuth callback
9. User is granted ADMIN role and admin status set to ACTIVE

> **Note:** Invitation links can be used by any user. If an email is specified, the system will pre-fill it during signup. If no email is specified, the user can sign up with any email address.

## Database Schema

### Admin Model

The `Admin` model stores admin-specific information:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Unique identifier |
| `user_id` | String (FK) | Reference to User table |
| `role_description` | AdminRole (enum) | SUPER_ADMIN, COMPLIANCE_OFFICER, OPERATIONS_OFFICER, FINANCE_OFFICER |
| `status` | String | ACTIVE or INACTIVE |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

### AdminInvitation Model

The `AdminInvitation` model tracks pending invitations:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Unique identifier |
| `email` | String (optional) | Email address (optional for link-based invitations) |
| `role_description` | AdminRole (enum) | Role to assign when invitation is accepted |
| `token` | String (unique) | Unique invitation token |
| `invited_by` | String (FK) | Reference to User who sent invitation |
| `expires_at` | DateTime | Invitation expiry date (default: 7 days) |
| `accepted_at` | DateTime (nullable) | When invitation was accepted (null if pending) |
| `created_at` | DateTime | Creation timestamp |

## API Endpoints

### Admin User Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/v1/admin/users` | Get paginated list of admin users with filters | ADMIN role |
| PATCH | `/v1/admin/users/:userId/role` | Update admin user role | SUPER_ADMIN only |
| PATCH | `/v1/admin/users/:userId/status` | Activate/deactivate admin user | SUPER_ADMIN only |

### Invitation Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/v1/admin/invitations` | Create new admin invitation (email or link) | SUPER_ADMIN only |
| GET | `/v1/admin/invitations` | Get paginated list of pending invitations | ADMIN role |
| POST | `/v1/admin/invitations/:id/resend` | Resend invitation email | SUPER_ADMIN only |
| DELETE | `/v1/admin/invitations/:id` | Revoke invitation | SUPER_ADMIN only |
| POST | `/v1/admin/invitations/accept` | Accept invitation (called during OAuth callback) | None (uses invitation token) |
| POST | `/v1/admin/invitations/generate-url` | Generate invitation link without sending email | SUPER_ADMIN only |

## Security and Access Control

### Role-Based Access

- Only users with `ADMIN` role can access the admin portal
- Only users with `ACTIVE` admin status can access admin features
- Only `SUPER_ADMIN` role can:
  - Invite new admin users
  - Change admin roles
  - Activate/deactivate admin accounts
  - Resend or revoke invitations

### Invitation Security

- Invitation tokens are cryptographically secure (CUID-based)
- Invitations expire after 7 days (configurable)
- Each invitation can only be used once
- Invitation acceptance is logged in security logs

### Audit Logging

All admin management actions are logged:

- Invitation creation
- Invitation acceptance
- Role changes
- Status changes (activate/deactivate)
- Invitation resend/revoke

## User Workflow

### For Super Admins

1. Navigate to `/settings/roles`
2. View all admin users and their status
3. Invite new admin users via email or link
4. Manage existing admin users:
   - Change roles
   - Activate/deactivate accounts
5. View and manage pending invitations

### For Invited Users

1. Receive invitation email or click invitation link
2. Click invitation link (contains token)
3. Redirected to Cognito Hosted UI for signup/login
4. Complete authentication
5. Backend automatically accepts invitation during OAuth callback
6. User is granted ADMIN role and admin status set to ACTIVE
7. Redirected to admin portal

## Common Operations

### Inviting a New Admin User

1. Click "Invite Admin User" button
2. Enter email address (optional for link-based invitations)
3. Select admin role
4. Choose method:
   - **Email:** Click "Send Invitation Email"
   - **Link:** Click "Generate Invitation Link", then copy and share
5. Invitation appears in "Pending Invitations" table

### Changing an Admin User's Role

1. Find user in "Admin Users" table
2. Click "Edit" button in Actions column
3. Select new role from dropdown
4. Click "Save"
5. Change is logged in security logs

### Activating/Deactivating an Admin User

1. Find user in "Admin Users" table
2. Click "Edit" button in Actions column
3. Toggle status between ACTIVE and INACTIVE
4. Click "Save"
5. Inactive users cannot access admin portal

### Resending an Invitation

1. Find invitation in "Pending Invitations" table
2. Click "Resend" button
3. New email sent to invitation email address
4. Original invitation token remains valid

### Revoking an Invitation

1. Find invitation in "Pending Invitations" table
2. Click "Revoke" button
3. Invitation is marked as revoked
4. Invitation link/token becomes invalid

## Troubleshooting

### Issue: "User cannot access admin portal after invitation"

**Possible Causes:**
- User hasn't completed OAuth signup/login
- Admin status is INACTIVE
- User doesn't have ADMIN role

**Solution:**
1. Check user's roles in database
2. Verify admin status is ACTIVE
3. Check if invitation was accepted (accepted_at is not null)
4. Have user logout and login again

### Issue: "Invitation link doesn't work"

**Possible Causes:**
- Invitation has expired (7 days default)
- Invitation was revoked
- Invitation was already accepted

**Solution:**
1. Check invitation expiry date
2. Verify invitation hasn't been accepted
3. Generate new invitation if needed

### Issue: "Cannot change admin role"

**Possible Causes:**
- User doesn't have SUPER_ADMIN role
- Backend API error

**Solution:**
1. Verify current user has SUPER_ADMIN role
2. Check browser console for errors
3. Check backend logs for API errors

## Best Practices

- **Role Assignment:** Assign the minimum role necessary for each admin user's responsibilities
- **Status Management:** Deactivate admin accounts immediately when users leave or roles change
- **Invitation Security:** Share invitation links securely (e.g., via encrypted email or secure messaging)
- **Audit Trail:** Regularly review security logs for admin management activities
- **Access Review:** Periodically review active admin users and their roles

