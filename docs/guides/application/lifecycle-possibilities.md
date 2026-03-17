================================================================================
APPLICATION LIFECYCLE — ALL POSSIBILITIES
================================================================================

Reference for every combination of contract and invoice statuses and the
resulting application status. Plain text. Top to bottom.

Related: status-reference.md (what each status means).

Rule: When contract exists, contract controls. Invoices do NOT override.
      When no contract, invoices control.

Final invoice statuses: APPROVED, REJECTED, WITHDRAWN
Non-final: DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED

================================================================================
1. INVOICE-ONLY (NO CONTRACT)
================================================================================

When the application has invoices but no contract.

  Invoices                    Result
  --------------------------- ------------------
  APPROVED                    COMPLETED
  REJECTED                    REJECTED
  WITHDRAWN                   WITHDRAWN
  APPROVED + APPROVED          COMPLETED
  REJECTED + REJECTED          REJECTED
  WITHDRAWN + WITHDRAWN        WITHDRAWN
  REJECTED + APPROVED          COMPLETED
  REJECTED + WITHDRAWN         COMPLETED
  APPROVED + WITHDRAWN         COMPLETED
  APPROVED + REJECTED          COMPLETED
  WITHDRAWN + REJECTED         COMPLETED
  WITHDRAWN + APPROVED         COMPLETED
  SUBMITTED + SUBMITTED        unchanged
  DRAFT + SUBMITTED            unchanged
  OFFER_SENT + APPROVED        unchanged (one non-final)
  AMENDMENT_REQUESTED + any    unchanged
  any non-final mix            unchanged

Rule: All same final -> use that.
      Mix of APPROVED / REJECTED / WITHDRAWN -> COMPLETED.
      Any non-final -> keep current status.

================================================================================
2. CONTRACT ONLY (NO INVOICES)
================================================================================

When the application has a contract but no invoices.

  Contract              Result
  --------------------- ------------------
  WITHDRAWN             WITHDRAWN
  REJECTED              REJECTED
  APPROVED              COMPLETED
  SUBMITTED             unchanged
  OFFER_SENT            unchanged
  DRAFT                 unchanged
  AMENDMENT_REQ         unchanged

Rule: Contract in final state -> use that.
      Contract active -> keep current status.

================================================================================
3. CONTRACT + INVOICES — CONTRACT WITHDRAWN OR REJECTED
================================================================================

Contract wins. Invoices do not matter.

  Contract              Invoices              Result
  --------------------- --------------------- ------------------
  WITHDRAWN             any                   WITHDRAWN
  REJECTED              any                   REJECTED

================================================================================
4. CONTRACT + INVOICES — CONTRACT APPROVED
================================================================================

Contract approved. Result depends on whether all invoices are final.

  Contract              Invoices              Result
  --------------------- --------------------- ------------------
  APPROVED              none                  COMPLETED
  APPROVED              APPROVED + APPROVED   COMPLETED
  APPROVED              REJECTED + REJECTED   COMPLETED
  APPROVED              WITHDRAWN + WITHDRAWN COMPLETED
  APPROVED              APPROVED + REJECTED   COMPLETED
  APPROVED              APPROVED + WITHDRAWN  COMPLETED
  APPROVED              REJECTED + WITHDRAWN  COMPLETED
  APPROVED              SUBMITTED + SUBMITTED  unchanged
  APPROVED              SUBMITTED + APPROVED  unchanged
  APPROVED              any non-final          unchanged

Rule: Contract APPROVED + all invoices final -> COMPLETED.
      If any invoice not final -> keep current status.

================================================================================
5. CONTRACT + INVOICES — CONTRACT ACTIVE
================================================================================

Contract not in final state. Invoices do NOT control.

  Contract              Invoices              Result
  --------------------- --------------------- ------------------
  SUBMITTED             any                   unchanged
  OFFER_SENT            any                   unchanged
  DRAFT                 any                   unchanged
  AMENDMENT_REQ         any                   unchanged

Rule: When contract exists and is active, invoices cannot change application
      status. Return current status.

================================================================================
6. CANCEL APPLICATION (WITHDRAW AT APPLICATION LEVEL)
================================================================================

What it does: Withdraws all active invoices and contract, then recalculates.

  Before Cancel                          Invoices After    Contract After    Result
  ------------------------------------- ---------------- ---------------- ------
  Contract SUBMITTED, Invoices SUBMITTED WITHDRAWN         WITHDRAWN         WITHDRAWN
  Contract APPROVED, Invoices SUBMITTED  WITHDRAWN         APPROVED          COMPLETED
  Contract DRAFT, Invoices DRAFT        WITHDRAWN         WITHDRAWN          WITHDRAWN
  Invoice-only, Invoices SUBMITTED      WITHDRAWN         —                 WITHDRAWN

Invoices withdrawn: DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED
Invoices not touched: APPROVED, REJECTED, WITHDRAWN

Contract withdrawn: DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED
Contract not touched: APPROVED, REJECTED, WITHDRAWN

================================================================================
7. EDGE CASES
================================================================================

  Scenario                                              Result
  ----------------------------------------------------- ------------------
  No contract, no invoices                               unchanged
  Contract exists, all invoices REJECTED, contract       COMPLETED
    APPROVED
  Contract exists, all invoices WITHDRAWN, contract      unchanged
    SUBMITTED (invoices do not override)
  Contract WITHDRAWN, invoices APPROVED                  WITHDRAWN
    (contract wins)

================================================================================
8. STATUS REFERENCE
================================================================================

Contract/Invoice non-final: DRAFT, SUBMITTED, OFFER_SENT, AMENDMENT_REQUESTED
Contract/Invoice final: APPROVED, REJECTED, WITHDRAWN

"Unchanged" = returns currentApplicationStatus (the value passed into
computeApplicationStatus).

For full status meanings, read status-reference.md.

================================================================================
9. QUICK DECISION FLOW
================================================================================

1. Contract exists?
   YES -> Check contract status only (invoices do NOT control)
     - WITHDRAWN -> WITHDRAWN
     - REJECTED -> REJECTED
     - APPROVED + all invoices final -> COMPLETED
     - Otherwise -> unchanged
   NO -> Check invoices
     - All WITHDRAWN -> WITHDRAWN
     - All REJECTED -> REJECTED
     - All final (mixed) -> COMPLETED
     - Otherwise -> unchanged

================================================================================
END
================================================================================
