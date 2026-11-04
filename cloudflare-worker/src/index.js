const APP_ORIGIN = "https://tangus47.github.io";
const REDIRECT_URI = "https://berur-trades-backend.tangusvincent47.workers.dev/oauth/callback";
const AUTH_URL = "https://auth.deriv.com/oauth2/auth";
const TOKEN_URL = "https://auth.deriv.com/oauth2/token";
const ALLOWED_ORIGIN = APP_ORIGIN;

function hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(size = 32) {
  return hex(crypto.getRandomValues(new Uint8Array(size)));
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function corsHeaders(origin) {
  if (origin !== ALLOWED_ORIGIN) return {};
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function redirect(url) {
  return new Response(null, {
    status: 302,
    headers: { "Location": url, "Cache-Control": "no-store" }
  });
}

function appError(code) {
  const target = new URL("/", APP_ORIGIN);
  target.searchParams.set("oauth_error", code);
  return redirect(target.toString());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "BERUR TRADES OAuth backend" });
    }

    if (url.pathname === "/oauth/start" && request.method === "GET") {
      if (!env.DERIV_CLIENT_ID || !env.BERUR_SESSIONS) {
        return json({ error: "Worker setup incomplete. Configure DERIV_CLIENT_ID and BERUR_SESSIONS." }, 503);
      }

      const state = randomHex(32);
      const verifier = randomHex(32);
      const challenge = await challengeFor(verifier);

      await env.BERUR_SESSIONS.put(
        `oauth:${state}`,
        JSON.stringify({ verifier, createdAt: Date.now() }),
        { expirationTtl: 600 }
      );

      const auth = new URL(AUTH_URL);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("client_id", env.DERIV_CLIENT_ID);
      auth.searchParams.set("redirect_uri", REDIRECT_URI);
      auth.searchParams.set("scope", "trade");
      auth.searchParams.set("state", state);
      auth.searchParams.set("code_challenge", challenge);
      auth.searchParams.set("code_challenge_method", "S256");

      return redirect(auth.toString());
    }

    if (url.pathname === "/oauth/callback" && request.method === "GET") {
      const oauthError = url.searchParams.get("error");
      if (oauthError) return appError("authorization_denied");

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state || !/^[a-f0-9]{64}$/.test(state)) {
        return appError("invalid_callback");
      }

      const sessionKey = `oauth:${state}`;
      const saved = await env.BERUR_SESSIONS.get(sessionKey, "json");
      await env.BERUR_SESSIONS.delete(sessionKey);

      if (!saved || !saved.verifier) return appError("state_expired_or_invalid");

      const form = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.DERIV_CLIENT_ID,
        code,
        code_verifier: saved.verifier,
        redirect_uri: REDIRECT_URI
      });

      let tokenResponse;
      try {
        tokenResponse = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form
        });
      } catch {
        return appError("token_service_unavailable");
      }

      const tokenData = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || !tokenData?.access_token) {
        return appError("token_exchange_failed");
      }

      const ticket = randomHex(32);
      await env.BERUR_SESSIONS.put(
        `ticket:${ticket}`,
        JSON.stringify({
          access_token: tokenData.access_token,
          expires_in: Number(tokenData.expires_in) || 0,
          token_type: tokenData.token_type || "Bearer"
        }),
        { expirationTtl: 90 }
      );

      const destination = new URL("/", APP_ORIGIN);
      destination.hash = new URLSearchParams({ oauth_ticket: ticket }).toString();
      return redirect(destination.toString());
    }

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (origin !== ALLOWED_ORIGIN) {
        return json({ error: "Origin not allowed" }, 403);
      }
      const sessionId = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!/^[a-f0-9]{64}$/.test(sessionId)) {
        return json({ error: "Session expired. Connect Deriv again." }, 401, corsHeaders(origin));
      }
      const session = await env.BERUR_SESSIONS.get(`session:${sessionId}`, "json");
      if (!session?.access_token) {
        return json({ error: "Session expired. Connect Deriv again." }, 401, corsHeaders(origin));
      }
      let upstreamUrl;
      let method = request.method;
      if (url.pathname === "/api/accounts" && method === "GET") {
        upstreamUrl = "https://api.derivws.com/trading/v1/options/accounts";
      } else {
        const match = url.pathname.match(/^\/api\/accounts\/([A-Za-z0-9_-]+)\/otp$/);
        if (!match || method !== "POST") return json({ error: "Not found" }, 404, corsHeaders(origin));
        upstreamUrl = "https://api.derivws.com/trading/v1/options/accounts/" + encodeURIComponent(match[1]) + "/otp";
      }
      let upstream;
      try {
        upstream = await fetch(upstreamUrl, {
          method,
          headers: { "Authorization": "Bearer " + session.access_token }
        });
      } catch {
        return json({ error: "Deriv API temporarily unavailable" }, 502, corsHeaders(origin));
      }
      const payload = await upstream.json().catch(() => ({ error: "Invalid Deriv response" }));
      return json(payload, upstream.status, corsHeaders(origin));
    }

    if (url.pathname === "/oauth/redeem") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
      }
      if (origin !== ALLOWED_ORIGIN) {
        return json({ error: "Origin not allowed" }, 403);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid request body" }, 400, corsHeaders(origin));
      }

      const ticket = typeof body.ticket === "string" ? body.ticket : "";
      if (!/^[a-f0-9]{64}$/.test(ticket)) {
        return json({ error: "Invalid or expired login ticket" }, 400, corsHeaders(origin));
      }

      const key = `ticket:${ticket}`;
      const session = await env.BERUR_SESSIONS.get(key, "json");
      await env.BERUR_SESSIONS.delete(key);

      if (!session?.access_token) {
        return json({ error: "Login ticket has expired or was already used" }, 401, corsHeaders(origin));
      }

      const sessionId = randomHex(32);
      const ttl = Math.max(60, Math.min(86400, Number(session.expires_in) || 3600));
      await env.BERUR_SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify({ access_token: session.access_token }),
        { expirationTtl: ttl }
      );
      return json({ session_id: sessionId, expires_in: ttl }, 200, corsHeaders(origin));
    }

    return json({ error: "Not found" }, 404);
  }
};
