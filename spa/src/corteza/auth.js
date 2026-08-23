/**
 * Vue 3 port of Corteza's first-party default-client OAuth2 flow
 * (see corteza-vue src/plugins/auth.ts). corteza-vue itself is Vue 2.7-only,
 * so we keep the same endpoints and token rules rather than inventing a new protocol.
 *
 * Access token stays in memory. Refresh token stays in sessionStorage.
 */

const FLOW = "/oauth2/default-client";
const INFO = "/oauth2/info";
const SCOPE = "profile api";
const REFRESH_KEY = "auth.refresh-token";
const STATE_LOC_PREFIX = "auth.state.";
const FINAL_KEY = "auth.state.final";

function authBase() {
  if (window.CortezaAuth) return window.CortezaAuth.replace(/\/$/, "");
  const api = window.CortezaAPI || "/api";
  return api.endsWith("/api") ? api.slice(0, -4) + "/auth" : `${api}/auth`;
}

function callbackURL() {
  return `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`.replace(/([^:]\/)\/+/g, "$1");
}

function isCallbackPath(pathname) {
  return /\/auth\/callback$/.test(pathname.replace(/\/$/, "") + (pathname.endsWith("/") ? "" : "")) || pathname.endsWith("/auth/callback");
}

export function createAuth() {
  let accessToken = "";
  let user = null;
  let refreshTimer = 0;

  function headers() {
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  async function exchange(body) {
    const data = new URLSearchParams(body);
    const response = await fetch(`${authBase()}${FLOW}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: data,
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || "token exchange failed");
      error.code = payload.error;
      throw error;
    }
    return payload;
  }

  function applyToken(payload) {
    accessToken = payload.access_token;
    user = {
      userID: payload.sub,
      name: payload.name || payload.handle || payload.email,
      email: payload.email,
      handle: payload.handle,
    };
    sessionStorage.setItem(REFRESH_KEY, payload.refresh_token);
    window.clearTimeout(refreshTimer);
    const waitMs = Math.max(30, payload.expires_in * 0.75) * 1000;
    refreshTimer = window.setTimeout(() => {
      refresh().catch(() => startLogin());
    }, waitMs);
    return { accessToken, user };
  }

  async function refresh() {
    const token = sessionStorage.getItem(REFRESH_KEY);
    if (!token) throw new Error("Unauthenticated");
    try {
      return applyToken(await exchange({ refresh_token: token }));
    } catch (error) {
      if (error.code === "invalid_grant") {
        sessionStorage.removeItem(REFRESH_KEY);
      }
      throw error;
    }
  }

  function startLogin() {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem(`${STATE_LOC_PREFIX}${state}.location`, window.location.href);
    const url = new URL(`${authBase()}${FLOW}`, window.location.origin);
    url.searchParams.set("redirect_uri", callbackURL());
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    window.location.assign(url.toString());
  }

  async function handleCallback(params) {
    const state = params.get("state");
    const stored = sessionStorage.getItem(`${STATE_LOC_PREFIX}${state}.location`);
    if (!stored) throw new Error("oauth state mismatch");
    const result = applyToken(
      await exchange({
        code: params.get("code") || "",
        scope: SCOPE,
        redirect_uri: callbackURL(),
      }),
    );
    sessionStorage.removeItem(`${STATE_LOC_PREFIX}${state}.location`);
    const next = new URL(stored);
    if (isCallbackPath(next.pathname)) {
      next.pathname = import.meta.env.BASE_URL;
      next.search = "";
    }
    window.history.replaceState({}, "", next.toString());
    return result;
  }

  async function handle() {
    const current = new URL(window.location.href);
    const params = current.searchParams;
    if (isCallbackPath(current.pathname) && (params.has("code") || params.has("error"))) {
      if (params.has("error")) throw new Error(params.get("error"));
      return handleCallback(params);
    }
    if (sessionStorage.getItem(FINAL_KEY) && !sessionStorage.getItem(REFRESH_KEY)) {
      throw new Error("Unauthenticated");
    }
    sessionStorage.setItem(FINAL_KEY, String(Date.now()));
    if (sessionStorage.getItem(REFRESH_KEY)) {
      return refresh();
    }
    throw new Error("Unauthenticated");
  }

  async function ensure() {
    try {
      await handle();
      try {
        const info = await profile();
        if (user) {
          user = {
            ...user,
            name: info.name || info.handle || user.name,
            email: info.email || user.email,
            handle: info.handle || user.handle,
          };
        }
      } catch {
        // token already applied; header can still show name
      }
      return user;
    } catch {
      startLogin();
      return new Promise(() => {});
    }
  }

  async function profile() {
    const response = await fetch(`${authBase()}${INFO}`, { headers: headers() });
    if (!response.ok) throw new Error("Unauthenticated");
    return response.json();
  }

  function logout() {
    accessToken = "";
    user = null;
    sessionStorage.clear();
    const back = encodeURIComponent(window.location.origin + import.meta.env.BASE_URL);
    window.location.assign(`${authBase()}/logout?back=${back}`);
  }

  return {
    ensure,
    logout,
    profile,
    headers,
    token: () => accessToken,
    user: () => user,
  };
}
