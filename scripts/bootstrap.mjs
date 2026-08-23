/**
 * First-boot demo: create homework@plexys.local, the Compose model, and seed tickets.
 * Safe to run more than once — existing users/records are left in place.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const internal = (process.env.CORTEZA_BASE || "http://127.0.0.1:18080").replace(/\/$/, "");
const publicBase = (process.env.CORTEZA_PUBLIC || "http://localhost:18080").replace(/\/$/, "");
const email = "homework@plexys.local";
const password = "Homework!2026";
const name = "Plexys Reviewer";
const callback = `${publicBase}/tickets/auth/callback`;

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  const raw = response.headers.getSetCookie?.() || [];
  for (const line of raw) {
    const part = line.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (jar.size) headers.Cookie = cookieHeader();
  const response = await fetch(url, { ...options, headers, redirect: "manual" });
  storeCookies(response);
  return response;
}

async function follow(url) {
  let current = url;
  for (let i = 0; i < 6; i++) {
    const response = await request(current);
    const location = response.headers.get("location");
    if (!location || (response.status !== 301 && response.status !== 302 && response.status !== 303)) {
      return response;
    }
    current = new URL(location, current).toString();
  }
  throw new Error(`too many redirects from ${url}`);
}

function csrf(html) {
  const match = html.match(/name="same-site-authenticity-token" value="([^"]+)"/);
  if (!match) throw new Error("CSRF field missing");
  return match[1];
}

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      const response = await fetch(`${internal}/version`);
      if (response.ok) return;
    } catch {
      // still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Corteza did not become ready");
}

async function formPage(path) {
  const response = await follow(`${internal}${path}`);
  const html = await response.text();
  if (!/same-site-authenticity-token/.test(html)) {
    throw new Error(`${path} has no CSRF field (${response.status}): ${html.slice(0, 200)}`);
  }
  return html;
}

async function ensureUser() {
  let signupHtml;
  try {
    signupHtml = await formPage("/auth/signup");
  } catch {
    const loginHtml = await formPage("/auth/login");
    const login = await request(`${internal}/auth/login`, {
      method: "POST",
      headers: {
        Origin: publicBase,
        Referer: `${publicBase}/auth/login`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "same-site-authenticity-token": csrf(loginHtml),
        email,
        password,
      }),
    });
    if (login.status >= 400 && login.status !== 302) {
      throw new Error(`Could not sign in demo user (${login.status})`);
    }
    return;
  }
  const token = csrf(signupHtml);
  const created = await request(`${internal}/auth/signup`, {
    method: "POST",
    headers: {
      Origin: publicBase,
      Referer: `${publicBase}/auth/signup`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "same-site-authenticity-token": token,
      email,
      password,
      name,
    }),
  });
  if (created.status >= 400 && created.status !== 302) {
    const loginPage = await request(`${internal}/auth/login`);
    const loginHtml = await loginPage.text();
    const login = await request(`${internal}/auth/login`, {
      method: "POST",
      headers: {
        Origin: publicBase,
        Referer: `${publicBase}/auth/login`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "same-site-authenticity-token": csrf(loginHtml),
        email,
        password,
      }),
    });
    if (login.status >= 400 && login.status !== 302) {
      throw new Error(`Could not sign in demo user (${login.status})`);
    }
  }
}

function codeFrom(url) {
  try {
    return new URL(url, publicBase).searchParams.get("code");
  } catch {
    return null;
  }
}

async function accessToken() {
  let url = `${internal}/auth/oauth2/default-client?${new URLSearchParams({
    redirect_uri: callback,
    scope: "profile api",
    state: "bootstrap",
  })}`;
  let code = null;
  for (let i = 0; i < 8; i++) {
    const response = await request(url);
    const location = response.headers.get("location") || "";
    code = codeFrom(location) || codeFrom(response.url);
    if (code) break;
    if (!location) {
      const html = await response.text();
      throw new Error(`no auth code (${response.status}): ${html.slice(0, 240)}`);
    }
    url = new URL(location, url).toString();
  }
  if (!code) throw new Error("no auth code after OAuth redirects");
  const token = await request(`${internal}/auth/oauth2/default-client`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, scope: "profile api", redirect_uri: callback }),
  });
  const payload = await token.json();
  if (!payload.access_token) throw new Error(`token exchange failed: ${JSON.stringify(payload)}`);
  return payload.access_token;
}

async function api(jwt, method, path, body) {
  const response = await fetch(`${internal}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${JSON.stringify(payload)}`);
  return payload.response ?? payload;
}

function asSet(listed) {
  return listed?.set || listed?.response?.set || [];
}

async function findOrCreateNamespace(jwt, spec) {
  const listed = await api(jwt, "GET", `/compose/namespace/?limit=50`);
  const existing = asSet(listed).find(
    (item) => item.handle === spec.handle || item.slug === spec.slug || item.name === spec.name,
  );
  if (existing) return existing;
  return api(jwt, "POST", "/compose/namespace/", spec);
}

async function findOrCreateModule(jwt, namespaceID, spec) {
  const listed = await api(jwt, "GET", `/compose/namespace/${namespaceID}/module/?limit=50`);
  const existing = asSet(listed).find((item) => item.handle === spec.handle || item.name === spec.name);
  if (existing) return existing;
  return api(jwt, "POST", `/compose/namespace/${namespaceID}/module/`, spec);
}

function valuesToMap(record) {
  const map = {};
  for (const item of record.values || []) {
    if (item.name) map[item.name] = item.value ?? "";
  }
  return map;
}

await waitForServer();
await new Promise((resolve) => setTimeout(resolve, 8000));
await ensureUser();
const jwt = await accessToken();

const namespaceSpec = JSON.parse(await readFile(join(root, "compose/namespace.json"), "utf8"));
const customerSpec = JSON.parse(await readFile(join(root, "compose/customer.module.json"), "utf8"));
const ticketSpec = JSON.parse(await readFile(join(root, "compose/ticket.module.json"), "utf8"));
const seed = JSON.parse(await readFile(join(root, "compose/seed.json"), "utf8"));

const ns = await findOrCreateNamespace(jwt, namespaceSpec);
const customer = await findOrCreateModule(jwt, ns.namespaceID, customerSpec);
ticketSpec.fields = ticketSpec.fields.map((field) => {
  if (field.kind !== "Record") return field;
  return { ...field, options: { moduleID: customer.moduleID, labelField: "Name", query: ["Name", "Company"] } };
});
const ticket = await findOrCreateModule(jwt, ns.namespaceID, ticketSpec);

const customerByName = new Map();
const existingCustomers = asSet(
  await api(jwt, "GET", `/compose/namespace/${ns.namespaceID}/module/${customer.moduleID}/record/?limit=200`),
);
for (const record of existingCustomers) {
  customerByName.set(valuesToMap(record).Name, record.recordID);
}
for (const row of seed.customers) {
  if (customerByName.has(row.Name)) continue;
  const created = await api(jwt, "POST", `/compose/namespace/${ns.namespaceID}/module/${customer.moduleID}/record/`, {
    values: Object.entries(row).map(([name, value]) => ({ name, value })),
  });
  customerByName.set(row.Name, created.recordID);
}

const existingTickets = asSet(
  await api(jwt, "GET", `/compose/namespace/${ns.namespaceID}/module/${ticket.moduleID}/record/?limit=200`),
);
const ticketSubjects = new Set(existingTickets.map((record) => valuesToMap(record).Subject));
for (const row of seed.tickets) {
  if (ticketSubjects.has(row.Subject)) continue;
  const values = [
    { name: "Subject", value: row.Subject },
    { name: "Description", value: row.Description },
    { name: "Status", value: row.Status },
    { name: "Priority", value: row.Priority },
  ];
  if (row.DueDate) values.push({ name: "DueDate", value: row.DueDate });
  if (row.Customer && customerByName.get(row.Customer)) {
    values.push({ name: "Customer", value: customerByName.get(row.Customer) });
  }
  await api(jwt, "POST", `/compose/namespace/${ns.namespaceID}/module/${ticket.moduleID}/record/`, { values });
}

console.log("Demo user", email);
console.log("Namespace", ns.namespaceID);
console.log("Seeded tickets from compose/seed.json");
