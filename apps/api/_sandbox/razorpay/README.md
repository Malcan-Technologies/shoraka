# Curlec / Razorpay M0 spike (local only — `apps/api/_sandbox/` is gitignored)

Minimal integration spike template. One script = one API experiment. Save JSON under `output/` for H1 evidence.

Spike notes and M0 findings live here until production integration — see [M0-FINDINGS.md](./M0-FINDINGS.md). The implementation plan stays in `docs/integrations/payment-gateway-curlec-plan.md`.

## Setup

Add to `apps/api/.env`:

```bash
CURLEC_KEY_ID=rzp_test_...
CURLEC_KEY_SECRET=...
```

## Run (H1 flow)

```bash
cd apps/api

# Step 1 — create order (copy order_id from output)
npx tsx _sandbox/razorpay/01-create-order.ts

# Step 2 — FPX checkout (from repo root or apps/api)
npx serve _sandbox/razorpay -p 8765
# Open http://localhost:8765/02-checkout.html — edit CONFIG, pay via FPX mock Success

# Step 3 — inspect payment for payer name (copy pay_... from callback URL)
npx tsx _sandbox/razorpay/03-fetch-payment.ts pay_xxxxxxxx
```

## Template for new scripts

Copy this shape for each spike step:

```ts
#!/usr/bin/env tsx
/**
 * M0 spike — Step N: what this proves
 *
 * Run: npx tsx _sandbox/razorpay/NN-script-name.ts [args]
 * Docs: https://curlec.com/docs/...
 */

import "dotenv/config";
import { curlecRequest, printNameLikeFields } from "./lib/curlec-request";

const CONFIG = { /* edit per run */ };

async function main(): Promise<void> {
  const data = await curlecRequest("GET", "/v1/payments/pay_xxx", {
    label: "fetch-payment",
    saveAs: "03-payment.json",
  });

  console.log("\n=== name-like fields ===");
  printNameLikeFields(data);

  console.log("\n--- Next step ---");
  console.log("...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Rules

- **CONFIG at top** — values you change every run; secrets only in `.env`
- **One concern per file** — create order, fetch payment, list settlements
- **Always save JSON** — pass `saveAs` for M0 findings evidence
- **Print next step** — what to run or paste next
- **No imports from `src/modules/payment`** — spikes stay throwaway until M2
