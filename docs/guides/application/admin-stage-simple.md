================================================================================
ADMIN STAGE STATUS — SIMPLE GUIDE
================================================================================

What this guide is about: When an admin reviews an application, the app
shows a status. That status tells the admin what to do next.

================================================================================
THE FIVE STATUSES (WHEN APP HAS A CONTRACT)
================================================================================

  1. CONTRACT PENDING
     Admin can see the contract. Admin has not sent an offer.
     Do: Send the contract offer.

  2. CONTRACT SENT
     Admin sent the offer. Issuer has not accepted or rejected.
     Do: Wait.

  3. CONTRACT ACCEPTED
     Issuer accepted the contract. Admin must now send invoice offers.
     Do: Send invoice offers.

  4. INVOICE PENDING
     Admin can see invoices. Not all have offers yet.
     Do: Send offers for the rest.

  5. INVOICES SENT
     Admin sent all invoice offers. Issuer must respond.
     Do: Wait.

================================================================================
THE FLOW (ONE LINE EACH)
================================================================================

  CONTRACT PENDING   -> Send contract offer
  CONTRACT SENT     -> Wait for issuer
  CONTRACT ACCEPTED -> Send invoice offers
  INVOICE PENDING   -> Send more invoice offers
  INVOICES SENT     -> Wait for issuer
  COMPLETED         -> Done

================================================================================
NO CONTRACT?
================================================================================

  Skip 1, 2, 3. Only INVOICE PENDING and INVOICES SENT.

================================================================================
FILTER ON THE LIST PAGE
================================================================================

  On the admin side has these filters:
    DRAFT, SUBMITTED, UNDER_REVIEW, CONTRACT_PENDING, CONTRACT_SENT,
    CONTRACT_ACCEPTED, INVOICE_ACCEPTED, SIGNING_PENDING, INVOICE_PENDING,
    INVOICES_SENT, OFFER_EXPIRED, AMENDMENT_REQUESTED, RESUBMITTED,
    COMPLETED, REJECTED, WITHDRAWN, ARCHIVED
    Default: SUBMITTED, UNDER_REVIEW, RESUBMITTED, CONTRACT_PENDING,
    CONTRACT_ACCEPTED, INVOICE_ACCEPTED, SIGNING_PENDING, INVOICE_PENDING
    (CONTRACT_SENT, INVOICES_SENT, OFFER_EXPIRED not in default).

  On the admin side each filter is one status. One to one.
    UNDER_REVIEW covers: UNDER_REVIEW
    CONTRACT_PENDING covers: CONTRACT_PENDING
    CONTRACT_SENT covers: CONTRACT_SENT
    CONTRACT_ACCEPTED covers: CONTRACT_ACCEPTED
    INVOICE_ACCEPTED covers: INVOICE_ACCEPTED
    SIGNING_PENDING covers: SIGNING_PENDING
    INVOICE_PENDING covers: INVOICE_PENDING
    INVOICES_SENT covers: INVOICES_SENT

  On the issuer side has these filters:
    Draft, Submitted, Under Review, Action Required, Offer Received,
    Completed, Withdrawn, Declined, Offer Expired, Rejected

  On the issuer side Under Review covers:
    UNDER_REVIEW, CONTRACT_PENDING, CONTRACT_SENT / INVOICES_SENT while
    awaiting admin or signing, CONTRACT_ACCEPTED, INVOICE_ACCEPTED,
    SIGNING_PENDING, INVOICE_PENDING, INVOICES_SENT (when no issuer action)

  On the issuer side Offer Received covers:
    CONTRACT_SENT / INVOICES_SENT while PENDING_ISSUER or CHANGES_REQUESTED

================================================================================
END
================================================================================
