# Client-facing milestone matrix

> **Superseded for client/Notion copy (2026-08-26).** Use [`final-client-facing-log-notification-matrix.md`](./final-client-facing-log-notification-matrix.md).

Verified: **2026-08-26**. This table is for product/client confirmation of **what users should see**. It is not an audit-implementation spec.

Only **reachable** business milestones (UI, job, or webhook in the live product). Internal forensic events are omitted.

**How to use:** mark each row CONFIRM, CHANGE, or SILENT.

| Business Stage | Business Moment | Issuer Sees | Investor Sees | Notification | Who Gets It | Client Decision |
|---|---|---|---|---|---|---|
| Access | Password changed | Inbox: Password Changed | Inbox: Password Changed | Password Changed | The user | CONFIRM |
| Onboarding | Application started | Activity: Onboarding Started | Activity: Onboarding Started | — | — | CONFIRM |
| Onboarding | Restarted by CashSouk | Activity: Onboarding Restarted | Activity: Onboarding Restarted | — | — | CONFIRM |
| Onboarding | Rejected (KYC/COD) | Activity: Onboarding Rejected + inbox | Activity: Onboarding Rejected + inbox | Onboarding Rejected | Applicant | CONFIRM |
| Onboarding | Platform access granted | Activity: Onboarding Approved + inbox | Activity: Onboarding Approved + inbox | Onboarding Approved | Applicant | CONFIRM |
| Onboarding | SSM / AML sub-steps | Not in Activity (Admin org timeline) | Same | — | — | CONFIRM (Admin-only) |
| Application | Draft created | Activity: Application Started | N/A | — | — | CONFIRM |
| Application | Submitted | Activity: Application Submitted + inbox | N/A | Application Submitted | Issuer owner + org admins | CONFIRM |
| Application | Amendment requested | Activity: CashSouk Requested an Amendment + inbox | N/A | Amendment Requested | Issuer owner + org admins | CONFIRM |
| Application | Resubmitted | Activity: Application Resubmitted + inbox | N/A | Application Resubmitted | Issuer owner + org admins | CONFIRM |
| Application | Rejected | Activity: Application Rejected + inbox (no reason text) | N/A | Application Rejected | Issuer owner + org admins | CHANGE? collect reason? |
| Application | Withdrawn by issuer | Activity: Application Withdrawn + inbox | N/A | Application Withdrawn | Issuer owner + org admins | CONFIRM |
| Application | Completed | Activity: Application Completed + inbox | N/A | Application Completed | Issuer owner + org admins | CONFIRM |
| Facility | Offer received | Activity: You Received a Facility Offer + inbox | N/A | Facility Offer Received | Issuer owner + org admins | CONFIRM |
| Facility | Issuer declined | Activity: Facility Offer Declined + inbox | N/A | Facility Offer Declined | Issuer owner + org admins | CONFIRM |
| Facility | CashSouk retracted | Activity: CashSouk Retracted the Facility Offer + inbox | N/A | Facility Offer Retracted | Issuer owner + org admins | CONFIRM |
| Facility | Offer expired | Activity: Facility Offer Expired + inbox | N/A | Offer Expired | Issuer owner + org admins | CONFIRM |
| Facility | Expiry reminder | Inbox only | N/A | Offer Expiring Soon | Issuer owner + org admins | CONFIRM |
| Facility | Signed / accepted | Activity: Facility Offer Signed | N/A | Application Completed (same moment) | Issuer owner + org admins | CONFIRM |
| Invoice | Offer received / declined / retracted / expired / signed | Matching invoice Activity + inbox | N/A | Matching invoice notifications | Issuer owner + org admins | CONFIRM |
| Signing | Deadline extended | Activity: Signing Deadline Extended + inbox | N/A | Signing Deadline Extended | Issuer owner + org admins | CONFIRM |
| Signing | Package sent | Facility detail label; signers get provider email | N/A | Provider email, not platform inbox | Signers | CONFIRM |
| Facility | Disabled | Inbox: Facility Disabled (not Activity feed) | N/A | Facility Disabled | Issuer owner + org admins | CONFIRM |
| Facility | Re-enabled | Admin only | N/A | — | — | CONFIRM (silent) |
| Note | Published | Activity: Note Published + inbox | Marketplace listing | Note Published | Issuer org members | CONFIRM |
| Note | Campaign paused / resumed | Activity: Campaign Paused / Resumed | Listing visibility | — | — | CONFIRM |
| Note | Funding closed | Activity: Funding Closed + inbox | — | Funding Closed | Issuer org members | CONFIRM |
| Note | Funding unsuccessful | Activity: Funding Unsuccessful + inbox | Activity: Funding Unsuccessful + inbox (commitment released) | Issuer + investor copies | Issuer members + committed investors | CONFIRM |
| Investment | Commit | — | Activity: Investment Committed + wallet | — | — | CONFIRM |
| Disbursement | Payout completed / servicing starts | Activity: Your Disbursement Is Complete + inbox | Activity: Your Investment Is Active + inbox | Both notified (different copy) | Issuer members + confirmed investors | CONFIRM |
| Disbursement | Submitted to trustee | Not in Activity; Admin note + inbox | — | Withdrawal Submitted to Trustee | Issuer org members | CONFIRM |
| Investor cash | Withdrawal submitted | N/A | Inbox + /transactions (no Activity row) | Withdrawal Submitted | Requesting investor | CONFIRM |
| Investor cash | Withdrawal completed | N/A | Inbox + /transactions | Withdrawal Completed | Requesting investor | CONFIRM |
| Deposit | Successful credit | N/A | /transactions (no inbox) | — | — | CHANGE? notify success? |
| Deposit | Name check rejected | N/A | Inbox: Deposit Verification Failed | Deposit Verification Failed | Investor org members | CONFIRM |
| Deposit | Refund started / completed | N/A | Inbox | Refund Started / Refund Completed | Investor org members | CONFIRM |
| Repayment | Issuer submitted | Activity: You Submitted a Repayment | — | — | — | CONFIRM |
| Repayment | Recorded / approved | Admin settlement panel | Inbox: Repayment Received | Repayment Received | Confirmed investors | CONFIRM |
| Repayment | Rejected | Inbox: Repayment Rejected | — | Repayment Rejected | Issuer org members | CONFIRM |
| Settlement | Posted | Inbox: Note repaid (when note closed) | Activity: Settlement Posted + inbox | Settlement Posted; Note repaid | Investors / issuer | CONFIRM |
| Servicing | Arrears | Inbox: Note in Arrears | Inbox: Note in Arrears | Both | Issuer members + investors | CONFIRM |
| Servicing | Default | Activity: Your Note Is in Default + inbox | Activity: Your Investment Is in Default + inbox | Both | Issuer members + investors | CONFIRM |
| Fees | Upfront facility fee due / paid | Inbox | N/A | Upfront facility fee… | Issuer | CONFIRM |
| Fees | Excess late charges due / paid | Inbox | N/A | Late charges copy | Issuer members | CONFIRM |
| Directors | Action required | Inbox (org owner) | Inbox (investor org owner) | Action Required: Complete Director/Shareholder Onboarding | Org owner only | CONFIRM |
| Broadcast | Announcements / new product | Only if Admin sends bulk | Only if Admin sends bulk | Admin-typed copy | Chosen audience | CONFIRM |

---

## Intentionally not on this matrix

- Admin review ticks, occupancy snapshots, Shoraka certificate fetch, trustee letter PDFs, gateway recon runs, role catalogue edits, finance-settings history.
- `ACTIVATE` as a customer milestone: **not a current Admin button**. Live “investment is active” comes from **disbursement completed**.
