# PokéBonk v36 — private D1 catalog API (staging)

This code can be public; the **catalog snapshot and generated SQL must remain private**.
The v35 GitHub Pages site remains live until deployment and API parity checks pass.

## Setup

1. Sign into the owner's **Cloudflare** account with Wrangler locally. This chat has no Cloudflare authorization.
2. Run \`npm install\` in this folder, then \`npx wrangler d1 create pokebonk-catalog-v36-staging\`.
3. Replace \`REPLACE_WITH_REAL_DATABASE_ID\` in \`wrangler.jsonc\` with the D1 ID (not a secret).
4. Apply schema: \`npx wrangler d1 execute pokebonk-catalog-v36-staging --remote --file=./schema.sql\`.
5. Put a **trusted v35 backup** in a private, gitignored path. Generate the private seed:
   \`node scripts/seed.mjs --input /absolute/path/to/v35-index.html\`.
   Its .private/seed.sql is not part of the repository.
6. Load it: \`npx wrangler d1 execute pokebonk-catalog-v36-staging --remote --file=./.private/seed.sql\`.
7. Optional challenge support: register Turnstile for \`jonh999999.github.io\`, set \`TURNSTILE_SITEKEY\` via Wrangler vars, and run \`npx wrangler secret put TURNSTILE_SECRET\`. Without it, excessive access returns 429 without a captcha bypass.
8. \`npm test\`, \`npx wrangler deploy\`, test \`/api/v1/health\` and individual API endpoints via the staging URL.
9. Set the real Worker URL in the v36 frontend config **only on staging** and perform visual, functional, ownership and source-mode checks before publication.

## Security boundaries

- Worker uses a D1 binding, never a client-visible database key.
- Both rate limit bindings are required; absent protection returns 503.
- CORS is **not** authentication. Direct clients may call public endpoints.
- A client can still reconstruct *public query results* through repeated requests.
- No endpoint returns the complete \`current\`, \`species\`, \`configs\` or \`specialZones\` database.
- Source repository v35 history was public. No migration can make those already-published historical bytes secret again.
- Protect future original source, snapshots and update scripts in a **new private repository**.
- Remote deployments and database writes require owner-side Cloudflare credentials; never paste secrets into public GitHub commits or chat.
