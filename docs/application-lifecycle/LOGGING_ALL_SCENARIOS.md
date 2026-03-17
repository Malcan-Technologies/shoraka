# Application Log — UI to Event

Which button/action logs which event. Who did it. (previous) = existed at 1060399c, (new) = added after. Issuer portal = shown on issuer /activity page (only event types in ApplicationLogAdapter.getEventTypes()).

---

## Issuer

| Action | Log | Source | Issuer portal |
|--------|-----|--------|---------------|
| Create application | APPLICATION_CREATED | (previous) | ✓ |
| Submit application | APPLICATION_SUBMITTED | (previous) | ✓ |
| Resubmit after amendments | APPLICATION_RESUBMITTED | (previous) | ✓ |
| Cancel application | APPLICATION_WITHDRAWN | (new) | ✓ |
| Withdraw invoice | INVOICE_WITHDRAWN | (new) | ✓ |
| Accept contract offer | CONTRACT_OFFER_ACCEPTED | (previous) | ✓ |
| Reject contract offer | CONTRACT_OFFER_REJECTED | (previous) | ✓ |
| Accept invoice offer | INVOICE_OFFER_ACCEPTED | (previous) | ✓ |
| Reject invoice offer | INVOICE_OFFER_REJECTED | (previous) | ✓ |

*APPLICATION_WITHDRAWN (new) also when admin withdraws contract or all invoices withdrawn.*  
*INVOICE_WITHDRAWN (new) also when admin withdraws invoice.*  
*APPLICATION_COMPLETED (new) logged when last offer accepted.*

---

## Admin

| Action | Log | Source | Issuer portal |
|--------|-----|--------|---------------|
| Reset to under review | APPLICATION_RESET_TO_UNDER_REVIEW | (previous) | |
| Approve application | APPLICATION_APPROVED | (previous) | |
| Reject application | APPLICATION_REJECTED | (previous) | |
| Send amendment request to issuer | AMENDMENTS_SUBMITTED | (previous) | |
| Approve section | SECTION_REVIEWED_APPROVED | (previous) | |
| Reject section | SECTION_REVIEWED_REJECTED | (previous) | |
| Request amendment (section) | SECTION_REVIEWED_AMENDMENT_REQUESTED | (previous) | |
| Reset section | SECTION_REVIEWED_PENDING | (previous) | |
| Approve item | ITEM_REVIEWED_APPROVED | (previous) | |
| Reject item | ITEM_REVIEWED_REJECTED | (previous) | |
| Request amendment (item) | ITEM_REVIEWED_AMENDMENT_REQUESTED | (previous) | |
| Reset item | ITEM_REVIEWED_PENDING | (previous) | |
| Send contract offer | CONTRACT_OFFER_SENT | (previous) | |
| Send invoice offer | INVOICE_OFFER_SENT | (previous) | |
| Retract contract offer | CONTRACT_OFFER_RETRACTED | (previous) | |
| Retract invoice offer | INVOICE_OFFER_RETRACTED | (previous) | |
| Reset offer scope | OFFER_SCOPE_RESET_TO_PENDING | (previous) | |
| Reset invoice offer | INVOICE_OFFER_RESET_TO_PENDING | (previous) | |
| Reject offer scope | OFFER_SCOPE_REJECTED | (previous) | |
| Amendment (scope) | OFFER_SCOPE_AMENDMENT_REQUESTED | (previous) | |
| Reject invoice offer | INVOICE_OFFER_REJECTED_BY_ADMIN | (previous) | |
| Amendment (invoice offer) | INVOICE_OFFER_AMENDMENT_REQUESTED_BY_ADMIN | (previous) | |

---

## System

| Action | Log | Source | Issuer portal |
|--------|-----|--------|---------------|
| Offer expired (cron) | OFFER_EXPIRED | (new) | ✓ |
| Last offer accepted | APPLICATION_COMPLETED | (new) | ✓ |

*Placeholder. Cron not yet implemented for OFFER_EXPIRED.*
