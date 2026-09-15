# End-to-End Browser Testing Checklist: Shoraka Application Lifecycle

## 1. User Application Flow (Issuer)

### 1.1 New Application Creation

- [ ] **Product selection** (`/applications/new`)
  - Products load from API and display correctly
  - Selecting a product creates a DRAFT application and redirects to `/applications/[id]/edit?step=2`
  - User without a valid issuer organization sees appropriate error/empty state
- [ ] **Navigation guard**
  - Direct URL to `/applications/[id]/edit` when status ≠ DRAFT / AMENDMENT_REQUESTED redirects to `/applications`
  - Application owned by another organization returns 404 or access-denied

### 1.2 Application Wizard (Edit Flow)

- [ ] **Step progression**
  - Steps follow product workflow (e.g. `financing_type`, `financing_structure`, `contract_details`, `invoice_details`, `company_details`, `business_details`, `financial_statements`, `supporting_documents`, `declarations`, `review_and_submit`)
  - Progress indicator reflects current step and completed steps
  - Back/Next navigation works; `last_completed_step` updates correctly on save
- [ ] **Per-step save**
  - Saving a step calls `PATCH /v1/applications/:id/step` with valid `stepNumber`, `stepId`, `data`
  - Validation errors show inline
  - Partial/optional fields save without breaking the flow
- [ ] **Document uploads**
  - Presigned URL upload works for supporting documents and invoices
  - File list shows uploaded docs with correct names
  - Deleting a document removes it from the UI and backend
- [ ] **Financial statements**
  - Numeric inputs accept and persist correct values
  - Edge cases (e.g. zero, large numbers, decimals) handled
- [ ] **Invoice details**
  - Adding invoices (single/bulk) works
  - Invoice data and validation behave as expected
  - Invoice-only products show appropriate UI
- [ ] **Declarations**
  - Checkboxes and required fields validate before submit
- [ ] **Review & Submit**
  - Summary shows all entered data
  - Submit button submits application (DRAFT → SUBMITTED)
  - Success feedback and redirect to `/applications`

### 1.3 Application List & Management

- [ ] **Application list** (`/applications`)
  - Applications load with correct status labels
  - Filtering/sorting works when implemented
- [ ] **Draft actions**
  - Delete draft works
  - Archive draft works
  - Cancel (withdraw) works when applicable
- [ ] **Status-based visibility**
  - Status badges and actions match current status

---

## 2. Admin Review Flow

### 2.1 Application List

- [ ] **Product-scoped list** (`/applications/[productKey]`)
  - Applications for the product load correctly
  - Pagination works
- [ ] **Navigation**
  - Clicking an application opens `/applications/[productKey]/[id]`

### 2.2 Review Tabs & Prerequisites

- [ ] **Tab order**
  - Tabs: Financial → Company → Business → Documents → Contract → Invoice (per workflow)
- [ ] **Prerequisites**
  - Contract tab unlocks only when Financial, Company, Business, Documents are approved
  - Invoice tab unlocks only when Contract section (or prerequisites) are approved
  - Invoice-only products: contract tab may show as "Customer" and use different prerequisites
- [ ] **Locked tabs**
  - Locked tabs show tooltip: "Approve [X] section first"
  - Locked tabs cannot be reviewed until prerequisites are approved

### 2.3 Section-Level Review Actions

- [ ] **Approve**
  - Approve marks section as APPROVED
  - UI updates immediately; tab status reflects change
- [ ] **Reject**
  - Reject requires note; modal/dialog enforces it
  - Rejection applies and application status becomes REJECTED when appropriate
- [ ] **Request amendment**
  - Request amendment requires note
  - Amendment request submits and sets application status to AMENDMENT_REQUESTED
  - Pending remarks are saved and submitted
- [ ] **Reset to pending**
  - Reset reverts section to PENDING
  - Other sections remain unchanged

### 2.4 Item-Level Review (Invoices, Documents)

- [ ] **Invoice items**
  - Approve/Reject/Request amendment per invoice
  - Reset to pending per item
- [ ] **Document items**
  - Same actions per document
  - `scope_key` format matches backend expectations (e.g. `supporting_documents:doc:financial_docs:0:Latest_Management_Account`)

### 2.5 Contract & Invoice Offers

- [ ] **Send contract offer**
  - Contract section shows "Send offer" when prerequisites met
  - Offered facility input validates
  - Sending offer sets contract to OFFER_SENT and application to CONTRACT_SENT
- [ ] **Send invoice offer**
  - Invoice section shows per-invoice "Send offer"
  - Sending sets invoice to OFFER_SENT and application to INVOICES_SENT when applicable

### 2.6 Application Status (Admin)

- [ ] **Status transitions**
  - First review action moves SUBMITTED/RESUBMITTED → UNDER_REVIEW
  - Admin can set status to UNDER_REVIEW, APPROVED, REJECTED where allowed
- [ ] **Clear application status**
  - Clearing status resets for re-review when supported
- [ ] **Refresh**
  - Data refreshes (e.g. 15s interval) so multiple admins see updates

### 2.7 Comments

- [ ] **Section comments**
  - Add comment persists
  - Comments display for the section
  - Comments are attributed correctly

---

## 3. User Amendment Flow

### 3.1 Amendment Context Loading

- [ ] **When status is AMENDMENT_REQUESTED**
  - Edit page fetches `/v1/applications/:id/amendment-context`
  - Response includes `application`, `review_cycle`, `remarks`
  - Remarks with `action_type = "REQUEST_AMENDMENT"` and `submitted_at` non-null

### 3.2 Flagged Sections & Items

- [ ] **Section remarks**
  - `scope === "section"` → `scope_key` (e.g. `contract_details`) is flagged
  - Red indicators on stepper for flagged steps
- [ ] **Item remarks**
  - `scope === "item"` → `scope_key` (e.g. `invoice_details:0:Invoice`) flags specific items
  - Item-level flags map correctly to invoice/document rows

### 3.3 Tab Locking in Amendment Mode

- [ ] **Flagged steps**
  - Only flagged sections/items are editable
  - Non-flagged steps are read-only (can navigate, cannot save)
- [ ] **Invoice step**
  - Only flagged invoice rows editable
  - Non-flagged invoices read-only
- [ ] **Supporting documents step**
  - Only flagged documents editable
  - `scope_key` matching works for documents

### 3.4 Amendment Remark Display

- [ ] **Remark card**
  - Amendment remark card shows reviewer note
  - Card appears on the relevant step
- [ ] **Invoice error card**
  - Per-invoice amendment notes show correctly

### 3.5 Acknowledgement & Resubmit

- [ ] **Save and acknowledge**
  - Saving a flagged step calls `POST /v1/applications/:id/acknowledge-workflow` with `workflowId`
  - `amendment_acknowledged_workflow_ids` is updated
- [ ] **Resubmit button**
  - Disabled until all required amendments are acknowledged (excluding financial and review_and_submit)
  - Enabled when all required steps acknowledged
- [ ] **Resubmit**
  - Resubmit succeeds; status changes AMENDMENT_REQUESTED → RESUBMITTED
  - REQUEST_AMENDMENT remarks deleted; new review cycle created
  - ApplicationRevision snapshot created; `review_cycle` incremented

### 3.6 Edge Cases

- [ ] **Multiple amendment rounds**
  - Second amendment request after first resubmit works
  - New remarks load; previous acknowledgements cleared
- [ ] **Partial acknowledgement**
  - Resubmit blocked until all required steps acknowledged
  - Error message for missing acknowledgements is clear

---

## 4. Offer Acceptance & Rejection (Issuer)

### 4.1 Contract Offer

- [ ] **Offer notification**
  - When CONTRACT_SENT, issuer sees offer (dashboard/modals/notifications)
- [ ] **Review offer modal**
  - Modal shows contract offer details (amount, expiry, etc.)
- [ ] **Accept**
  - Accept calls `POST /v1/applications/:id/offers/contracts/accept`
  - Contract → APPROVED; application → CONTRACT_ACCEPTED
- [ ] **Reject**
  - Reject requires reason where applicable
  - Reject calls `POST /v1/applications/:id/offers/contracts/reject`
  - Application → WITHDRAWN or REJECTED as per backend

### 4.2 Invoice Offer

- [ ] **Per-invoice offers**
  - When INVOICES_SENT, each invoice offer appears
- [ ] **Accept invoice**
  - Accept updates invoice status and application where applicable
- [ ] **Reject invoice**
  - Reject updates invoice and application status

### 4.3 Offer Expiry

- [ ] **Expired contract**
  - After expiry, contract → WITHDRAWN
  - Application status recomputed (e.g. WITHDRAWN)
- [ ] **Expired invoice**
  - After expiry, invoice → WITHDRAWN
  - Application status recomputed
- [ ] **Offer expiry job**
  - Cron/background job applies expiry; UI reflects after refresh

### 4.4 Sign Flow (if applicable)

- [ ] **Contract sign** (`/applications/sign/contract/[contractId]`)
  - Sign page loads
  - Signing completes successfully
- [ ] **Invoice sign** (`/applications/sign/invoice/[invoiceId]`)
  - Invoice sign page loads and completes

---

## 5. Application Lifecycle Transitions

### 5.1 Happy Path (Contract-Based)

- [ ] DRAFT → SUBMITTED (submit)
- [ ] SUBMITTED → UNDER_REVIEW (first admin action)
- [ ] UNDER_REVIEW → CONTRACT_PENDING (contract tab unlocked)
- [ ] CONTRACT_PENDING → CONTRACT_SENT (admin sends contract offer)
- [ ] CONTRACT_SENT → CONTRACT_ACCEPTED (issuer accepts)
- [ ] CONTRACT_ACCEPTED → INVOICE_PENDING / INVOICES_SENT (invoice flow)
- [ ] INVOICES_SENT → COMPLETED (all invoices accepted)

### 5.2 Amendment Path

- [ ] UNDER_REVIEW → AMENDMENT_REQUESTED (admin requests amendments)
- [ ] AMENDMENT_REQUESTED → RESUBMITTED (issuer resubmits)
- [ ] RESUBMITTED → UNDER_REVIEW (admin continues review)

### 5.3 Rejection & Withdrawal

- [ ] UNDER_REVIEW → REJECTED (admin rejects)
- [ ] CONTRACT_SENT → WITHDRAWN (issuer rejects or offer expires)
- [ ] INVOICES_SENT → WITHDRAWN (all invoices withdrawn)
- [ ] User cancel → WITHDRAWN (USER_CANCELLED)

### 5.4 Invoice-Only Path

- [ ] No contract offer flow; invoice tab drives lifecycle
- [ ] All invoices WITHDRAWN → Application WITHDRAWN
- [ ] All invoices REJECTED → Application REJECTED
- [ ] All invoices in terminal status → Application COMPLETED
- [ ] Contract tab shows "Customer" details only (no offer actions)

### 5.5 Contract-Only Path (No Invoices)

Applications can have a new contract and zero invoices. In this case, the contract outcome alone determines the application status; no invoice flow runs.

- [ ] **Contract approved**
  - Contract APPROVED + 0 invoices → Application COMPLETED
  - No invoice tab or invoice offers involved
- [ ] **Contract withdrawn**
  - Contract WITHDRAWN (issuer rejects or offer expires) → Application WITHDRAWN
- [ ] **Contract rejected**
  - Contract REJECTED → Application REJECTED
- [ ] **Admin flow**
  - Invoice tab hidden or N/A when product has no invoice step
  - After contract offer sent and accepted, application reaches COMPLETED directly
  - No invoice offer step in the flow

### 5.6 Archived

- [ ] ARCHIVED applications behave correctly (read-only, no actions)

---

## 6. Error States & Edge Cases

### 6.1 API Errors

- [ ] 401/403: redirect to login or show access denied
- [ ] 404: application not found message
- [ ] 422: validation errors shown inline
- [ ] 5xx: generic error message, no stack trace in production

### 6.2 Concurrent Edit

- [ ] Two admins reviewing: refresh shows latest state
- [ ] Issuer and admin: amendment requests visible after refresh

### 6.3 Network / Loading

- [ ] Loading skeletons for lists and detail views
- [ ] Failed requests retry or show retry action
- [ ] No console errors or unhandled promise rejections

### 6.4 Accessibility

- [ ] Focus management in modals/dialogs
- [ ] Labels and ARIA for form fields
- [ ] Keyboard navigation for stepper and tabs

---

## 7. RBAC & Security

### 7.1 Issuer

- [ ] Issuer sees only own organization's applications
- [ ] Issuer cannot access admin routes
- [ ] Issuer cannot call admin APIs

### 7.2 Admin

- [ ] Admin can access admin portal
- [ ] Admin can review any product's applications (per permissions)
- [ ] Non-admin users cannot access admin routes

### 7.3 Session

- [ ] Expired session redirects to login
- [ ] Logout clears session correctly

---

## 8. Data Integrity

- [ ] **Monetary values**
  - `numeric(18,6)` used; no floating-point rounding issues
  - Display formatting consistent
- [ ] **Dates**
  - Date fields display in correct locale
  - Expiry calculations correct for offers
- [ ] **Ids**
  - Application IDs, contract IDs, invoice IDs used consistently in API calls and navigation

---

## 9. Performance & Observability

- [ ] Large application list paginates
- [ ] Document-heavy steps load without major lag
- [ ] No unnecessary re-fetches (e.g. React Query settings)
- [ ] `correlationId` present in API responses for debugging

---

## 10. Cross-Portal Smoke

- [ ] **Landing** – marketing/home loads
- [ ] **Issuer** – login, application list, new application, edit flow
- [ ] **Admin** – login, application list, review, section actions
- [ ] **Investor** – login, portfolio (if applicable)

---

*Reference: `docs/guides/application-flow/amendment-flow.md`, `apps/api/src/modules/applications/lifecycle.ts`, `apps/admin/src/components/application-review/review-registry.ts`*
