# PokéBonk Shiny Explorer v36 — Private Catalog Staging

**Release status: staging code only; NOT deployed. Do not merge into \`main\` before the API is live and verified.**

## What's implemented

- The v35 HTML shell, posters, support module and visual styles are preserved.
- New \`v36-client.js\` reads only scoped API responses. No \`<script id="db">\` or public \`DB.current\` remains in the v36 HTML.
- Complete cards in both modes: 123 regular families, four special-only families, five special legendaries, six without verified natural routes.
- Classic special-only families remain visible with an explanation, but do not contaminate classic natural candidates.
- Collection state uses the existing \`pb-exclude-owned-normal\` and \`pb-exclude-owned-classic\` localStorage keys; import and export remain.
- Home defaults to all maps / all floors / normal; its total is 127 including four special families.
- Map/floor selection, other floors, source index, search, details, pages, theme and posters are wired.
- Cloudflare Worker queries a private D1 snapshot; returns only scoped results, not the raw source pools.
- Weighted per-client rate limits, paged source results, and optional Turnstile verification on an exceeded limit.

## Deployment gate (must pass before publication)

1. **Cloudflare account connection required.** Create D1 and deploy Worker using \`worker/README.md\`. This is blocked in the present chat because no connected Cloudflare administration tool/credentials are available.
2. Import v35 data to D1 using the **local-only** seed generator. Never add \`.private/seed.sql\` to Git.
3. Obtain the Cloudflare Worker HTTPS endpoint and replace the placeholder in \`v36-config.js\` on the staging branch.
4. Verify API health, /view 127 normal and 123 classic, four specials excluded from classic candidates, all 138 families, and 2193 source records over paginated results.
5. Run \`npm test\` in \`v36/worker\` and perform a **real browser smoke test**: desktop/mobile, import/export, theme, map, floors, unusual families and all-source index. No UI end-to-end test has run yet.
6. Confirm CORS and rate limiting respond correctly on the actual Cloudflare endpoint; test human verification after 429.
7. Take snapshots and note the rollback route. Merge to main only after production Worker/D1 is ready.

## What the defense can and cannot protect

- A visitor cannot retrieve the whole **future private catalog snapshot** simply by opening HTML or one public endpoint.
- A patient actor can still reconstruct information intentionally shown through public queries; rate limits and challenge increase the cost, not provide cryptographic confidentiality.
- v35 source code and its catalog data are in **public repository history**. Making v36 private cannot revoke prior copies. Keep future raw data, backups and pipeline scripts in a private repository, separate from GitHub Pages.
- Worker source code contains no secrets. Secrets are set with Wrangler on the owner's Cloudflare account.
- The v35 production website stays unchanged until the explicit deployment gate is met.

Author: Jon.
