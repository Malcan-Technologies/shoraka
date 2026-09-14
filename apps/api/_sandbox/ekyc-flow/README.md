# eKYC flow sandbox (local only — `apps/api/_sandbox/` is gitignored)

Requires `SC_BASE_URL`, `SC_API_KEY`, `SC_API_SECRET` in `apps/api/.env`.

## Query users

1. Edit `QUERY_PARAMS` at the top of `query-users.ts` (set `email`, optional filters).
2. Run:

```bash
pnpm --filter api sandbox:ekyc-query-users
```

Prints request/response plain, encrypted, and decrypted.
