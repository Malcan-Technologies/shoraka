# Admin RBAC Operations Guide

This guide explains what each permission allows in the admin portal. It is written for non-developer admin and operations users.

---

## 1. What RBAC means

RBAC (Role-Based Access Control) controls what each admin user can see and do in the admin portal.

- **View permissions** let a user open a page and see information.
- **Manage permissions** let a user perform actions or make changes on that page.
- **Some sensitive workflow actions** have their own specific permissions (for example, approving a loan application section or triggering a disbursement).

Every admin user is assigned a role. The role determines which permissions that user has.

---

## 2. General behavior

| Situation | What happens |
|---|---|
| User lacks the view permission for a page | The menu item is hidden. If they type the URL directly, they see "Access Denied." |
| User has view but not manage | They can open the page and read all the information. Action buttons are greyed out. |
| User has the required manage permission | Action buttons are active and the user can perform the action. |
| Greyed-out button | Hovering or reading the tooltip will say "You do not have permission to perform this action." |
| Super Admin | Can access and do everything. |

---

## 3. Permission groups explained

| Area | View permission | Manage / action permission | What user can see | What user can do |
|---|---|---|---|---|
| **Dashboard** | `dashboard.view` | — | Dashboard page and summary stats | View quick action cards (cards link to other modules) |
| **Dashboard widgets** | `dashboard.finance.view` `dashboard.operations.view` `dashboard.platform.view` | — | Specific widget sections | View only |
| **Notes** | `notes.view` | `notes.manage` | Note list and details | Toggle featured, manage note lifecycle (publish, unpublish, etc.) |
| **Notes — create** | `notes.view` | `notes.create` | Eligible invoices in the notes list | Turn an invoice into a note |
| **Notes — repayments** | `notes.view` | `notes.repayment.manage` | Repayment info on note detail | Record repayments |
| **Notes — settlements** | `notes.view` | `notes.settlement.manage` | Settlement info on note detail | Approve/post settlement, generate service fee instructions |
| **Notes — disbursements** | `notes.view` | `notes.disbursement.manage` | Disbursement info on note detail | Mark disbursed, manage trustee letters |
| **Notes — defaults** | `notes.view` | `notes.default.manage` | Default status on note detail | Mark default, manage recovery steps |
| **Applications** | `applications.view` | — | Application list and full detail | View all sections, add comments on any section |
| **Applications — Financial** | `applications.view` | `applications.financial.manage` | Financial section | Approve, reject, request amendment |
| **Applications — Company** | `applications.view` | `applications.company.manage` | Company section | Approve, reject, request amendment |
| **Applications — Business & Guarantor** | `applications.view` | `applications.business_guarantor.manage` | Business & Guarantor section | Approve, reject, request amendment |
| **Applications — Supporting Documents** | `applications.view` | `applications.documents.manage` | Supporting Documents section | Approve, reject, request amendment |
| **Applications — Contract** | `applications.view` | `applications.contract.manage` | Contract section | Send contract offer, approve, reject |
| **Applications — Invoice** | `applications.view` | `applications.invoice.manage` | Invoice section | Send invoice offer, approve, reject |
| **Onboarding Approval** | `onboarding.view` | `onboarding.manage` | Onboarding queue and applicant details | Approve/reject onboarding steps |
| **Users** | `users.view` | `users.manage` | User list and user details | Edit user account details |
| **Organizations** | `organizations.view` | `organizations.manage` | Organization list and details | Toggle Sophisticated Investor status, generate CTOS reports |
| **Roles** | `roles.view` | `roles.manage` | Roles & Users page, Permission Configuration (read-only) | Create/edit/delete roles, change permissions, invite/deactivate admin users |
| **Notifications** | `notifications.view` | `notifications.manage` | Notification Management page, all tabs (Configuration, Custom & Groups, Logs) | Add missing types, toggle notification on/off, send notifications, manage groups |
| **Access Logs** | `audit.access.view` | — | Access Logs page | View, search, filter, export access logs |
| **Security Logs** | `audit.security.view` | — | Security Logs page | View, search, filter, export security logs |
| **Document Logs** | `audit.document.view` | — | Document Logs page | View, search, filter, export document logs |
| **Product Logs** | `audit.product.view` | — | Product Logs page | View, search, filter, export product logs |
| **Document Management** | `document_management.view` | `document_management.manage` | Standalone Document Management page | Upload, edit, replace, archive, restore site documents |
| **Investments** | `investments.view` | — | Investments list | View only |
| **Contracts** | `contracts.view` | `contracts.manage` | Contracts list and detail | Manage contracts |
| **Bucket Balances** | `bucket_balances.view` | — | Finance Bucket Balances page | View only |
| **Repayments** | `repayments.view` | — | Finance Repayments page | View only |
| **Issuer Payouts** | `disbursements.view` | `disbursements.manage` | Issuer Payouts page | Manage issuer payout actions |
| **Service Fee** | `service_fee.view` | — | Service Fee Trustee Letters page | View only |
| **Product Settings** | `products.view` | `products.manage` | Products list and settings | Create, edit, archive products |
| **Platform Finance Settings** | `platform_settings.view` | `platform_settings.manage` | Platform Finance Settings page | Edit and save platform finance settings |
| **Reports** | `reports.view` | `reports.export` | Reports page (future) | Export reports (future) |

---

## 4. Important examples

**Applications and comments**

A user with `applications.view` can open any application and add comments on any section. They do not need section-specific permissions to comment. However, to approve, reject, or request an amendment for a section, they need the relevant section manage permission (for example, `applications.financial.manage` to approve the Financial section).

**Roles and Permission Configuration**

A user with `roles.view` can open the Roles & Users page and view the Permission Configuration page. They can see all roles and their permission matrices. They cannot create a new role, change any permissions, or invite or deactivate admin users without `roles.manage`.

**Notifications**

A user with `notifications.view` can see all notification management tabs — Configuration, Custom & Groups, and Notification Logs. They can read the settings but cannot toggle them, add missing types, send notifications, or create groups without `notifications.manage`.

**Audit logs**

Each audit log page has its own permission. A user with only `audit.access.view` can see the Access Logs page but will not see Security Logs, Document Logs, or Product Logs in the sidebar. They cannot open those pages directly.

**Notes and specific workflow permissions**

A user with `notes.view` can see all note details. However:

- To turn an invoice into a note, they also need `notes.create`
- To record a repayment, they also need `notes.repayment.manage`
- To approve or post a settlement, they also need `notes.settlement.manage`
- To mark a disbursement or manage trustee letters, they also need `notes.disbursement.manage`
- To mark a default, they also need `notes.default.manage`

---

## 5. Super Admin

The Super Admin role has access to every page and every action in the admin portal. There is no restriction.

**Important:** The system must always have at least one active Super Admin. If you deactivate or remove all Super Admin users, no one will be able to manage roles or permissions, and the system cannot be recovered through the admin portal. Always confirm another Super Admin account is active before deactivating or changing a Super Admin user.

---

## 6. Suggested role examples

These are example permission sets based on common operational responsibilities. Final permission assignments should be approved by the relevant business owner before being assigned to live users.

### Super Admin

Full access to everything. Suitable for platform owners and lead developers only.

Suggested permissions: All permissions.

### Compliance Officer

Responsible for KYC, AML screening, and regulatory checks. Needs to review applications and onboarding.

Suggested permissions:
- `applications.view`, `applications.financial.manage`, `applications.company.manage`, `applications.business_guarantor.manage`, `applications.documents.manage`
- `onboarding.view`, `onboarding.manage`
- `organizations.view`
- `users.view`
- `audit.access.view`, `audit.security.view`, `audit.document.view`

### Operations Officer

Handles day-to-day operations — loan lifecycle, user support, note management.

Suggested permissions:
- `dashboard.view`, `dashboard.operations.view`
- `notes.view`, `notes.manage`, `notes.create`, `notes.repayment.manage`, `notes.disbursement.manage`, `notes.default.manage`
- `applications.view`, `applications.financial.manage`, `applications.company.manage`, `applications.business_guarantor.manage`, `applications.documents.manage`, `applications.contract.manage`, `applications.invoice.manage`
- `onboarding.view`, `onboarding.manage`
- `users.view`, `users.manage`
- `organizations.view`
- `investments.view`
- `contracts.view`
- `notifications.view`, `notifications.manage`

### Finance Officer

Handles disbursements, repayments, settlements, and financial monitoring.

Suggested permissions:
- `dashboard.view`, `dashboard.finance.view`
- `notes.view`, `notes.repayment.manage`, `notes.settlement.manage`, `notes.disbursement.manage`
- `bucket_balances.view`
- `repayments.view`
- `disbursements.view`, `disbursements.manage`
- `service_fee.view`
- `investments.view`
- `contracts.view`
- `platform_settings.view`

### Read-only Auditor

Can view all information but cannot make any changes. Useful for external auditors or reviewers.

Suggested permissions:
- `dashboard.view`
- `notes.view`
- `applications.view`
- `onboarding.view`
- `users.view`
- `organizations.view`
- `roles.view`
- `audit.access.view`, `audit.security.view`, `audit.document.view`, `audit.product.view`
- `document_management.view`
- `investments.view`
- `contracts.view`
- `bucket_balances.view`
- `repayments.view`
- `disbursements.view`
- `service_fee.view`
- `products.view`
- `platform_settings.view`

---

## 7. Manual QA checklist for operations

Use this checklist when testing admin user access after assigning or changing a role.

**Login and session**
- [ ] Log in as the test user
- [ ] Confirm the correct role name appears in the account area

**Sidebar visibility**
- [ ] Check that only the expected menu items appear in the sidebar
- [ ] Menu items for pages the user should not access must not appear

**Direct URL access**
- [ ] Try opening a page URL the user should not access directly (type it in the browser address bar)
- [ ] Confirm an "Access Denied" message appears instead of the page content

**Read-only behavior**
- [ ] Open a page the user has view permission for
- [ ] Confirm all data loads correctly
- [ ] Confirm action buttons are greyed out if the user lacks manage permission
- [ ] Hover over a greyed-out button and confirm the tooltip says "You do not have permission to perform this action."

**Mutation actions**
- [ ] Log in as a user with the relevant manage permission
- [ ] Confirm action buttons are enabled
- [ ] Perform one test action (approve a section, toggle a setting, etc.)
- [ ] Confirm the action completes successfully

**Super Admin check**
- [ ] Log in as a Super Admin
- [ ] Confirm all menu items are visible
- [ ] Confirm all action buttons are enabled across all pages

**Application comments check**
- [ ] Log in as a user with `applications.view` only (no section manage permissions)
- [ ] Open an application
- [ ] Confirm that adding a comment works successfully
- [ ] Confirm that Approve/Reject/Request Amendment buttons are greyed out

**Roles page check**
- [ ] Log in as a user with `roles.view` only
- [ ] Confirm the Roles & Users page opens and shows the user list
- [ ] Open Permission Configuration
- [ ] Confirm it shows permissions in read-only mode
- [ ] Confirm Create Role and Save Changes are not available or are greyed out
