# Final client-facing log & notification matrix

Verified **2026-08-26** from source. For boss / client / Notion.

This is **what users see today**, not an engineering backlog. Mark **Client Confirmation**: `CONFIRM` / `CHANGE` / `SILENT`.

Internal forensic events (Admin ticks, occupancy, Shoraka certificates, trustee PDFs, recon, role catalogue, finance-settings history) are omitted here. See [master journal](./final-master-audit-notification-journal.md).

---

| Business Stage | What Happens | What Issuer Sees | What Investor Sees | Notification | Who Gets It | Evidence Available | Client Confirmation |
|---|---|---|---|---|---|---|---|
| Access | Password changed | Inbox: Password Changed | Inbox: Password Changed | Yes | The user who changed it | Admin Security log: success/fail, session revoked | CONFIRM |
| Onboarding | Application started | Activity: Onboarding Started | Activity: Onboarding Started | No | — | Admin org Activity | CONFIRM |
| Onboarding | Restarted by CashSouk | Activity: Onboarding Restarted | Activity: Onboarding Restarted | No | — | Admin org Activity | CONFIRM |
| Onboarding | Rejected (KYC / corporate) | Activity: Onboarding Rejected + inbox | Activity: Onboarding Rejected + inbox | Yes — Onboarding Rejected | Applicant | Admin org Activity; reason only if the provider sent one | CONFIRM |
| Onboarding | Platform access granted | Activity: Onboarding Approved + inbox | Activity: Onboarding Approved + inbox | Yes — Onboarding Approved | Applicant | Admin org Activity (Complete Onboarding) | CONFIRM |
| Onboarding | SSM / AML sub-steps | Not in user Activity (Admin org timeline) | Same | No | — | Admin org timeline / Refresh | CONFIRM (Admin-only) |
| Application | Draft created | Activity: Application Started | — | No | — | Admin application timeline | CONFIRM |
| Application | Submitted | Activity: Application Submitted + inbox | — | Yes — Application Submitted | Issuer owner + org admins | Admin timeline | CONFIRM |
| Application | Amendment requested | Activity: CashSouk Requested an Amendment + inbox | — | Yes — Amendment Requested | Issuer owner + org admins | Admin timeline; remarks required | CONFIRM |
| Application | Resubmitted | Activity: Application Resubmitted + inbox | — | Yes — Application Resubmitted | Issuer owner + org admins | Admin timeline | CONFIRM |
| Application | Rejected by CashSouk | Activity: Application Rejected + inbox (no reason text) | — | Yes — Application Rejected | Issuer owner + org admins | Admin timeline. **No reason** — dialog does not ask | CHANGE? collect reason? |
| Application | Withdrawn by issuer | Activity: Application Withdrawn + inbox | — | Yes — Application Withdrawn | Issuer owner + org admins | Admin timeline | CONFIRM |
| Application | Completed (offer accepted) | Activity: Application Completed + inbox | — | Yes — Application Completed | Issuer owner + org admins | Admin timeline | CONFIRM |
| Facility | Offer received | Activity: You Received a Facility Offer + inbox | — | Yes — Facility Offer Received | Issuer owner + org admins | Admin timeline: amounts, expiry | CONFIRM |
| Facility | Issuer declined | Activity: Facility Offer Declined + inbox | — | Yes — Facility Offer Declined | Issuer owner + org admins | Admin timeline | CONFIRM |
| Facility | CashSouk retracted | Activity: CashSouk Retracted the Facility Offer + inbox | — | Yes — Facility Offer Retracted | Issuer owner + org admins | Admin timeline | CONFIRM |
| Facility | Offer expired | Activity: Facility Offer Expired + inbox | — | Yes — Offer Expired | Issuer owner + org admins | Admin timeline; job is System not Admin | CONFIRM |
| Facility | Expiry reminder | Inbox only | — | Yes — Offer Expiring Soon | Issuer owner + org admins | Inbox | CONFIRM |
| Facility | Signed / accepted | Activity: Facility Offer Signed | — | Application Completed (same moment) | Issuer owner + org admins | Signed PDF + hash on envelope; Admin timeline | CONFIRM |
| Invoice | Offer received / declined / retracted / expired / signed | Matching invoice Activity + inbox | — | Matching invoice copy | Issuer owner + org admins | Same pattern as facility | CONFIRM |
| Signing | Deadline extended | Activity: Signing Deadline Extended + inbox | — | Yes | Issuer owner + org admins | Admin timeline | CONFIRM |
| Signing | Package sent to signers | Facility detail; signers get provider email | — | Provider email, not CashSouk inbox | Signers (may not be portal users) | Envelope + Admin timeline | CONFIRM |
| Facility | Disabled | Inbox: Facility Disabled (not Activity feed) | — | Yes | Issuer owner + org admins | Admin contract detail | CONFIRM |
| Facility | Re-enabled | Admin only | — | No | — | Admin contract detail | CONFIRM (silent) |
| Note | Published | Activity: Note Published + inbox | Marketplace listing | Yes — Note Published | Issuer org members | Admin note Activity | CONFIRM |
| Note | Campaign paused / resumed | Activity: Campaign Paused / Resumed | Listing visibility | No | — | Admin note Activity | CONFIRM |
| Note | Funding closed | Activity: Funding Closed + inbox | — | Yes — Funding Closed | Issuer org members | Admin note Activity; may be System auto-close | CONFIRM |
| Note | Funding unsuccessful | Activity: Funding Unsuccessful + inbox | Activity: Funding Unsuccessful + inbox (commitment released) | Yes — separate issuer and investor copy | Issuer members + committed investors | Admin note Activity + wallet release | CONFIRM |
| Investment | Commit | — | Activity: Investment Committed + inbox | Yes — Investment Committed | The investor who committed | Admin note Activity + wallet + notification log | CONFIRM |
| Disbursement | Submitted to trustee | Inbox: Withdrawal Submitted to Trustee (not Activity) | — | Yes | Issuer org members | Admin payout card + note Activity | CONFIRM |
| Disbursement | Payout completed and servicing starts | Activity + inbox: Your Disbursement Is Complete | Activity + inbox: Your Investment Is Active | Yes | Issuer members + confirmed investors | Admin can trace withdrawal, amount, status, actor, timestamps. **Not** an “Activate” button | CONFIRM |
| Investor cash | Withdrawal requested | — | Inbox + `/transactions` (no Activity row) | Yes — Withdrawal Submitted | Requesting investor | Admin finance withdrawal pages + wallet debit | CONFIRM |
| Investor cash | Withdrawal completed | — | Inbox + `/transactions` | Yes — Withdrawal Completed | Requesting investor | Same | CONFIRM |
| Deposit | Successful credit | — | `/transactions` + inbox | Yes — Deposit Successful | Investor org members | Admin gateway payment + wallet + notification log | CONFIRM |
| Deposit | Name check rejected | — | Inbox: Deposit Verification Failed | Yes | Investor org members | Admin gateway detail | CONFIRM |
| Deposit | Refund started / completed | — | Inbox: Refund Started / Refund Completed | Yes | Investor org members | Admin gateway detail | CONFIRM |
| Repayment | Issuer submitted | Activity: You Submitted a Repayment | — | No | — | Admin settlement panel | CONFIRM |
| Repayment | Recorded / approved | Admin settlement panel | Inbox: Repayment Received | Yes | Confirmed investors | Admin note Activity + payment id | CONFIRM |
| Repayment | Rejected | Inbox: Repayment Rejected | — | Yes | Issuer org members | Admin panel; optional reason | CONFIRM |
| Settlement | Posted | Inbox: Note repaid (when the note is fully repaid) | Activity: Settlement Posted + inbox | Yes | Investors; issuer on full repay | Admin settlement panel + ledger | CONFIRM |
| Servicing | Arrears | Inbox: Note in Arrears | Inbox: Note in Arrears | Yes | Issuer members + investors | Admin settlement panel | CONFIRM |
| Servicing | Default | Activity + inbox: Your Note Is in Default | Activity + inbox: Your Investment Is in Default | Yes | Issuer members + investors | Admin settlement panel | CONFIRM |
| Fees | Upfront facility fee due / paid | Inbox | — | Yes | Issuer | Contract facility panel | CONFIRM |
| Fees | Excess late charges due / paid | Inbox | — | Yes | Issuer members | Settlement panel | CONFIRM |
| Directors | Extra party must onboard | Inbox (org owner) | Inbox (investor org owner) | Yes — Action Required: Complete Director/Shareholder Onboarding | Org owner only | Admin org people | CONFIRM |
| Broadcast | Announcements / new product | Only if Admin sends a bulk message | Only if Admin sends a bulk message | Admin-typed title and body | Chosen audience | Admin notification logs | CONFIRM |

---

## How to read this

- **Not in Activity; visible on [page]** is still coverage. Do not ask engineering to duplicate every status into Activity.
- Live servicing start is **disbursement completed**, not a separate Activate action.
- System expiry/close is labelled System in Admin logs. It must not look like a staff click.

## Intentionally not on this matrix

Admin review ticks, occupancy snapshots, Shoraka certificate fetch, trustee letter PDFs, gateway recon, role catalogue edits, finance-settings history, unused Activate / Approve AML APIs.
