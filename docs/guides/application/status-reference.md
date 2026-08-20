================================================================================
APPLICATION STATUS REFERENCE
================================================================================

What each status means. Plain text. No styling.

Related: lifecycle-possibilities.md (how statuses combine), logging-guide.md
(logging), logging-scenarios.md (UI to event), admin-stage-simple.md (kid form).

================================================================================
APPLICATION STATUS
================================================================================

  DRAFT
    You are still filling it out. Not sent yet.
    Issuer: yes. Admin: no (draft apps not in admin list).

  SUBMITTED
    You sent it. Waiting for someone to look.
    Issuer: yes. Admin: yes.

  UNDER_REVIEW
    Someone is looking at it right now.
    Issuer: yes (shows as Under Review). Admin: yes.

  CONTRACT_PENDING
    Admin is reviewing. Contract tab unlocked. Next step: send contract offer.
    Issuer: yes (shows as Under Review). Admin: yes.

  CONTRACT_SENT
    Admin sent contract offer. Issuer must accept or reject.
    Issuer: yes — Offer Received while PENDING_ISSUER / CHANGES_REQUESTED /
    APPROVED_FOR_SIGNING / SIGNING_IN_PROGRESS; Under Review while
    PENDING_ADMIN_REVIEW. Admin: yes.

  OFFER_EXPIRED
    Contract or invoice offer deadline passed and the expiry job ran.
    Issuer: yes (shows as Offer Expired). Admin: yes (filterable).
    Admin can Send Offer again → CONTRACT_SENT / INVOICES_SENT.

  CONTRACT_ACCEPTED
    Issuer submitted Step 1 acceptance documents (phased offer flow).
    Admin is reviewing acceptance docs. Not signing complete.
    Issuer: yes (shows as Under Review). Admin: yes.

  INVOICE_ACCEPTED
    Same as CONTRACT_ACCEPTED but invoice-only financing structure.
    Issuer: yes (shows as Under Review). Admin: yes.

  SIGNING_PENDING
    Admin approved acceptance docs. Signing package can be created/sent.
    Issuer: yes (shows as Offer Received — issuer must configure/send signing).
    Admin: yes.

  Existing contract financing (structure_type = existing_contract):
    Linked contract is already APPROVED from a prior application. This app skips
    contract-offer stages (CONTRACT_SENT, CONTRACT_ACCEPTED, SIGNING_PENDING).
    The Acceptance tab shows a read-only mirror of uploads,
    signing package, and completed status from the originating new_contract
    application (contracts.originating_application_id). Status stays UNDER_REVIEW
    until invoice tab unlocks, then INVOICE_PENDING / INVOICES_SENT as for invoice stages only.

  INVOICE_PENDING
    Admin is reviewing. Invoice tab unlocked. Next step: send invoice offers.
    Issuer: yes (shows as Under Review). Admin: yes.

  INVOICES_SENT
    Admin sent invoice offer(s). Issuer must accept or reject.
    Issuer: yes (shows as Offer Received). Admin: yes.

  AMENDMENT_REQUESTED
    They want you to fix something. Update and send again.
    Issuer: yes (shows as Action Required). Admin: yes.

  RESUBMITTED
    You fixed it and sent it again.
    Issuer: yes. Admin: yes.

  COMPLETED
    All done. At least one thing was approved.
    Issuer: yes. Admin: yes.

  WITHDRAWN
    You cancelled. Nothing will happen.
    Issuer: yes. Admin: yes.

  REJECTED
    They said no. Nothing will happen.
    Issuer: yes. Admin: yes.

  ARCHIVED
    Old. Put away. Not active anymore.
    Issuer: no (filtered out). Admin: yes.


================================================================================
CONTRACT STATUS
================================================================================

  APPROVED
    The deal is approved. You get the money.
    Issuer: yes. Admin: yes.

  REJECTED
    The deal was turned down. No money.
    Issuer: yes. Admin: yes.

  WITHDRAWN
    The deal was cancelled.
    Issuer: yes. Admin: yes.

  DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED
    Not final yet. Still in progress.
    OFFER_SENT: Admin sent offer. Issuer sees it and can accept/reject.

================================================================================
INVOICE STATUS
================================================================================

  APPROVED
    This invoice got the green light.
    Issuer: yes. Admin: yes.

  REJECTED
    This invoice was turned down.
    Issuer: yes. Admin: yes.

  WITHDRAWN
    This invoice was cancelled.
    Issuer: yes. Admin: yes.

  DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED
    Not final yet. Still in progress.
    OFFER_SENT: Admin sent offer. Issuer sees it and can accept/reject.

================================================================================
FINAL VS NON-FINAL
================================================================================

Hard-final (origination mutations stop): COMPLETED, REJECTED, WITHDRAWN, ARCHIVED
Soft-final: OFFER_EXPIRED — the deadline passed, but admin can resend the offer
            on the same file (or reject / the issuer can withdraw).

Non-final (still in progress): DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED
(Contract/invoice entity statuses above; application also has stage overlays.)

SUBMITTED stays until the first admin review action (unopened queue). It does
not auto-flip to UNDER_REVIEW on issuer submit.

Issuer list cards collapse many admin stages into urgency aliases (Under Review,
Offer Received, Action Required). The API status is unchanged.

COMPLETED with an approved facility and zero approved invoices still means the
facility is in force; copy should say no invoices were financed.

================================================================================
WHAT THE USER SEES (STATUS ALIAS)
================================================================================

  System Code                 User Sees
  --------------------------- ------------------
  REJECTED                    Rejected
  COMPLETED                   Completed
  WITHDRAWN                   Withdrawn
  AMENDMENT_REQUESTED         Action Required
  OFFER_SENT                  Offer Received
  UNDER_REVIEW                Under Review
  SUBMITTED                   Submitted
  RESUBMITTED                 Resubmitted
  DRAFT                       Draft
  ARCHIVED                    Archived
  OFFER_EXPIRED               Offer Expired

  Admin-only display labels (application status):
  CONTRACT_PENDING             Facility Pending
  CONTRACT_SENT                Facility Sent
  CONTRACT_ACCEPTED            Facility Accepted
  INVOICE_ACCEPTED             Invoice Accepted
  SIGNING_PENDING              Signing Pending
  INVOICE_PENDING              Invoice Pending
  INVOICES_SENT                Invoices Sent
  OFFER_EXPIRED                Offer Expired

================================================================================
ADMIN STAGE STATUS — WHEN AND LOGIC
================================================================================

  For a super simple kid-form guide, read admin-stage-simple.md.

  CONTRACT_PENDING
    When: Contract section is available but offer not sent yet.
    Logic: Contract exists. Contract status is not OFFER_SENT or APPROVED.
           Contract tab is unlocked (prerequisite sections approved).
    Set by: Admin stage sync after review approvals unlock the contract tab
            (SUBMITTED/UNDER_REVIEW → CONTRACT_PENDING). Also when admin resets
            contract_details section to PENDING.
    Default filter: yes (in admin application queue).

  CONTRACT_SENT
    When: Admin sent contract offer. Waiting for issuer to accept or reject.
    Logic: Admin calls sendContractOffer. Contract status -> OFFER_SENT.
           Application status -> CONTRACT_SENT.
    Set by: sendContractOffer (admin service).
    Default filter: no (not in admin application queue by default).

  OFFER_EXPIRED
    When: Acceptance or signing deadline passed; expiry job ran.
    Logic: Contract/invoice status -> OFFER_EXPIRED (offer_details kept).
           Application status -> OFFER_EXPIRED.
    Set by: acceptance-signing-expiry job.
    Default filter: no (available in status filter as Offer Expired).

  CONTRACT_ACCEPTED
    When: Issuer submitted Step 1 acceptance documents (phased offer).
    Logic: offer_acceptance → PENDING_ADMIN_REVIEW (or CHANGES_REQUESTED).
           Contract/invoice entity stays OFFER_SENT until signing completes.
           Application status → CONTRACT_ACCEPTED (INVOICE_ACCEPTED for invoice-only).
    Set by: submitOfferAcceptance (applications service) / phase sync.
    Default filter: yes.

  INVOICE_ACCEPTED / SIGNING_PENDING
    When: Invoice-only Step 1 submit, or acceptance approved / signing in progress.
    See offer-acceptance-and-signing-phases.md.
    Default filter: yes (in reviewable / action-required sets).

  INVOICE_PENDING
    When: Invoice section is available. Not all invoices have offers yet.
    Logic: Contract is APPROVED (or invoice-only). At least one invoice is not
           OFFER_SENT, APPROVED, REJECTED, or WITHDRAWN. Invoice tab is unlocked.
    Set by: Admin stage sync when the invoice tab unlocks (UNDER_REVIEW →
            INVOICE_PENDING for invoice-only; post-sign contract path →
            INVOICE_PENDING for contract financing). Also when issuer commercially accepts a
            contract offer while invoices exist and the invoice tab is unlocked.
            Or when admin sends some invoice offers but not all / resets invoice
            section to PENDING.
    Default filter: yes.

  INVOICES_SENT
    When: All invoices have an offer sent (each is OFFER_SENT, APPROVED,
          REJECTED, or WITHDRAWN).
    Logic: allInvoicesOfferableOrResolved(invoiceStatuses) is true.
    Set by: sendInvoiceOffer when the last invoice gets offer sent.
    Default filter: no (not in admin application queue by default).

  Admin filter details: See admin-stage-simple.md (Admin Application Listing).

================================================================================
UNDER_REVIEW_CONTRACT_OFFER?
================================================================================

  There is no status called UNDER_REVIEW_CONTRACT_OFFER.

  When the contract has OFFER_SENT (admin sent the offer), the application
  status is CONTRACT_SENT (or INVOICE_ACCEPTED / SIGNING_PENDING overlays as
  the phased flow advances). Issuer card shows "Offer Received" while
  offer_acceptance is PENDING_ISSUER, CHANGES_REQUESTED, APPROVED_FOR_SIGNING,
  or SIGNING_IN_PROGRESS; "Under Review" while PENDING_ADMIN_REVIEW (or
  completed). Admin sees the raw application status badge.

  Same for invoices: when any invoice has OFFER_SENT, application status
  can be INVOICES_SENT (or invoice-only phase overlays). Issuer card follows
  the same offer_acceptance collapse rules.

================================================================================
WITHDRAW REASONS
================================================================================

  USER_CANCELLED
    You clicked cancel.

  OFFER_REJECTED
    Issuer or admin declined the offer.

Offer clock expiry uses entity status OFFER_EXPIRED (not a withdraw reason).

================================================================================
END
================================================================================
