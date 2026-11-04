# BERUR TRADES — Cloudflare OAuth backend

This folder contains the secure Deriv OAuth 2.0 + PKCE Worker for the existing BERUR TRADES site.

## Important
- This backend uses Cloudflare KV for short-lived PKCE sessions and one-time login tickets.
- It does not permanently store Deriv access tokens.
- The Deriv access token remains in Cloudflare KV behind a short-lived opaque browser session. The browser receives only the random session ID; account-list and OTP requests are proxied through the Worker. The short-lived OTP WebSocket URL is passed to the browser because the browser must open the authenticated trading socket.
- The Worker requests only the `trade` OAuth scope, which Deriv documents as sufficient for the Options accounts endpoint and trading operations. Keep the app permissions limited to what the app actually needs.
- Do not enable real-money order execution until the demo connection, balance display, proposal flow, buy flow, and risk checks have been separately tested.

## Deploy from a laptop

1. Install Node.js LTS.
2. Open a terminal in this folder.
3. Run `npm install -g wrangler` (or use `npx wrangler`).
4. Log in: `npx wrangler login`.
5. Create the KV namespace:
   `npx wrangler kv namespace create BERUR_SESSIONS`
6. Copy the returned namespace ID into `wrangler.jsonc`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`.
7. Deploy:
   `npx wrangler deploy`

The Worker name and OAuth callback URL are configured for the existing Worker:
`https://berur-trades-backend.tangusvincent47.workers.dev/oauth/callback`

The callback URL must remain registered exactly in the Deriv Developer Dashboard.

## Routes
- `GET /health` — health check.
- `GET /oauth/start` — starts Deriv OAuth with fresh PKCE and state.
- `GET /oauth/callback` — validates state and exchanges the authorization code server-side.
- `POST /oauth/redeem` — redeems a short-lived, one-use ticket into an opaque server-side session.
- `GET /api/accounts` — securely proxies the user's Options account list.
- `POST /api/accounts/{accountId}/otp` — securely proxies OTP creation for the selected account.

## Frontend integration still required
The existing `index.html` loads `deriv-trader.js`. The script redeems the OAuth ticket, removes it from the URL, uses the opaque session ID for Worker-proxied account and OTP requests, and opens a separate authenticated WebSocket. The public market-data socket on the analysis dashboard is not an authenticated account connection. The new execution desk is demo-only pending end-to-end testing; XML must be imported and validated in Deriv Bot before use.
