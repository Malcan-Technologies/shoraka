# Plain Support

CashSouk uses [Plain](https://www.plain.com) for customer support: a hosted Help Center and an in-app chat widget.

## Help Center

Public site: [https://help.cashsouk.com](https://help.cashsouk.com). This is the source of truth for issuer and investor articles. Portals read the URL from `NEXT_PUBLIC_HELP_CENTER_URL` (`HELP_CENTER_URL` in `@cashsouk/config`; default `https://help.cashsouk.com`).

Admin help stays in-repo (`packages/help-content`) and is rendered by the admin portal. Do not publish admin articles to the hosted Help Center.

## Managing customer articles

Issuer and investor Help Center content is authored directly in Plain, not in `packages/help-content`. Keep articles in these groups:

- **Getting Started** — guidance shared by issuers and investors
- **For Issuers** — issuer onboarding, applications, financing, and repayment
- **For Investors** — investor onboarding, cash, investments, and settlement

Use the Plain dashboard or Help Center API to create and update articles. Published articles are available to Plain AI; drafts are not.

`apps/api/scripts/plain-publish-help-articles.ts` remains available for Markdown sources that still exist. It reads files from `packages/help-content/markdown` by default and only publishes matching `issuer-` or `investor-` files. The current customer articles are maintained directly in Plain, so do not use this script as their source of truth.

## Chat widget

`PlainChatWidget` lives in `@cashsouk/ui` (`appId`, `helpCenterUrl`, optional `customer`). It is mounted on landing, issuer, and investor. Admin has no widget. Theme is forced to light. The panel auto-opens once per browser tab session (`sessionStorage`), then stays collapsed until the user opens it.

- **Landing:** anonymous — omit `customer`.
- **Issuer / investor:** identified users. The launcher initializes as soon as the widget script is ready, then `GET /v1/support/chat-identity` (auth required) attaches the HMAC `emailHash` computed with `PLAIN_CHAT_SECRET`. Returns 503 if chat is not configured.

Public env (issuer / investor / landing only): `NEXT_PUBLIC_PLAIN_CHAT_APP_ID`, `NEXT_PUBLIC_HELP_CENTER_URL`. Server-only on the API: `PLAIN_API_KEY`, `PLAIN_CHAT_APP_ID`, `PLAIN_CHAT_SECRET`. Never put the API key or chat secret in a `NEXT_PUBLIC_*` variable.

## CSP

Widget origins live in `packages/config/plain-csp-origins.cjs` (`PLAIN_CSP.scripts`, `.connect`, `.styles`). Landing, issuer, and investor Next configs append those to `script-src`, `connect-src`, and `style-src`. `img-src` and `font-src` already allow `https:`.

## Plain-side setup (manual)

Do these in the Plain workspace; they are not encoded in this repo:

1. **Custom domain** — attach `help.cashsouk.com` to the Help Center and keep DNS/TLS current.
2. **Ask AI** — enable Help Center Ask AI against the published issuer/investor articles.
3. **Chat app branding** — set the live chat app (`liveChatApp_…`) colours, launcher, and copy to match CashSouk.
4. **Ari workflow** — configure Ari (or equivalent) so incoming chat routes and suggested replies use the Help Center.

See [Environment Variables](./environment-variables.md#plain-support) for the full variable table.
