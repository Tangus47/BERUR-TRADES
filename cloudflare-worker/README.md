# BERUR TRADES — Cloudflare OAuth backend

This folder contains the secure Deriv OAuth 2.0 + PKCE Worker for the existing BERUR TRADES site.

## Important
- This backend uses Cloudflare KV for short-lived PKCE sessions and one-time login tickets.
- It does not permanently store Deriv access tokens.
- The access token is returned once to the BERUR TRADES browser after a one-time ticket redemption, so the browser can authenticate its Deriv trading WebSocket. Keep the token in memory; do not commit it, log it, or put it in a URL.
- OAuth scopes requested are `trade account_manage`. Ensure those scopes are enabled for the Deriv OAuth app.
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
- `POST /oauth/redeem` — redeems a short-lived, one-use ticket from the allowed GitHub Pages origin.

## Frontend integration still required
The main `index.html` must add a separate Deriv account login action, redeem the `oauth_ticket` fragment through `POST /oauth/redeem`, remove the fragment immediately, keep the access token in memory only, and authenticate the trading WebSocket. Do not treat the existing public market-data connection as an authenticated account connection.
