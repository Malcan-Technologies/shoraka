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
    Issuer: yes (shows as Offer Received). Admin: yes.

  CONTRACT_ACCEPTED
    Issuer accepted contract. Admin still needs to send invoice offers.
    Issuer: yes (shows as Under Review). Admin: yes.

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

  APPROVED
    They said yes.
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

Final statuses (no more changes): APPROVED, REJECTED, WITHDRAWN
Non-final (still in progress): DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED

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
  APPROVED                    Approved
  ARCHIVED                    Archived

  Admin-only display labels (application status):
  CONTRACT_PENDING             Contract Pending
  CONTRACT_SENT                Contract Sent
  CONTRACT_ACCEPTED            Contract Accepted
  INVOICE_PENDING              Invoice Pending
  INVOICES_SENT                Invoices Sent

================================================================================
ADMIN STAGE STATUS — WHEN AND LOGIC
================================================================================

  For a super simple kid-form guide, read admin-stage-simple.md.

  CONTRACT_PENDING
    When: Contract section is available but offer not sent yet.
    Logic: Contract exists. Contract status is not OFFER_SENT or APPROVED.
           Contract tab is unlocked (prerequisite sections approved).
    Set by: First admin review action on SUBMITTED/RESUBMITTED app.
            Or when admin resets contract_details section to PENDING.
    Default filter: yes (in admin application queue).

  CONTRACT_SENT
    When: Admin sent contract offer. Waiting for issuer to accept or reject.
    Logic: Admin calls sendContractOffer. Contract status -> OFFER_SENT.
           Application status -> CONTRACT_SENT.
    Set by: sendContractOffer (admin service).
    Default filter: no (not in admin application queue by default).

  CONTRACT_ACCEPTED
    When: Issuer accepted contract. Admin still needs to send invoice offers.
    Logic: Issuer accepts. Contract status -> APPROVED. Application status
           -> CONTRACT_ACCEPTED (or INVOICE_PENDING if invoice tab unlocked).
    Set by: respondToContractOffer (applications service).
    Default filter: yes.

  INVOICE_PENDING
    When: Invoice section is available. Not all invoices have offers yet.
    Logic: Contract is APPROVED. At least one invoice is not OFFER_SENT,
           APPROVED, REJECTED, or WITHDRAWN. Invoice tab is unlocked.
    Set by: First admin action after contract accepted. Or when admin sends
            some invoice offers but not all. Or when admin resets invoice
            section or invoice item to PENDING.
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
  status is CONTRACT_SENT. Issuer sees "Offer Received" on the card.
  Admin sees "Contract Sent" in the status badge.

  Same for invoices: when any invoice has OFFER_SENT, application status
  can be INVOICES_SENT. Issuer sees "Offer Received". Admin sees "Invoices Sent".

================================================================================
WITHDRAW REASONS
================================================================================

  USER_CANCELLED
    You clicked cancel.

  OFFER_EXPIRED
    The offer ran out of time.

================================================================================
END
================================================================================
