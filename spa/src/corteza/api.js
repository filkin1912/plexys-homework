import { apiClients } from "@cortezaproject/corteza-js";

let tokenFn = () => "";

function apiRoot() {
  return (window.CortezaAPI || "/api").replace(/\/$/, "");
}

export function createCompose(accessTokenFn) {
  tokenFn = accessTokenFn;
  return new apiClients.Compose({
    baseURL: `${apiRoot()}/compose`,
    accessTokenFn,
  });
}

async function composeGet(path) {
  const response = await fetch(`${apiRoot()}/compose${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${tokenFn()}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || payload.message || `Compose request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.response ?? payload;
}

function asSet(listed) {
  if (Array.isArray(listed)) return listed;
  if (Array.isArray(listed?.set)) return listed.set;
  if (Array.isArray(listed?.response?.set)) return listed.response.set;
  return [];
}

export function valuesToMap(record) {
  const map = {};
  for (const item of record.values || []) {
    if (item.name) map[item.name] = item.value ?? "";
  }
  return map;
}

export function mapToValues(map) {
  return Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([name, value]) => ({ name, value: String(value) }));
}

export async function resolveNamespace(_compose, handle) {
  const knownID = window.PlexysHomework?.namespaceID || "510042505795338241";
  try {
    const ns = await composeGet(`/namespace/${knownID}`);
    if (ns?.namespaceID) return ns;
  } catch {
    // fall through to list
  }

  const listed = await composeGet("/namespace/?limit=100");
  const set = asSet(listed);
  const names = new Set(
    [handle, "plexys_homework", "plexys-homework", "Plexys Homework"].map((value) => String(value).toLowerCase()),
  );
  const match = set.find((item) => {
    const handleOrSlug = String(item.handle || item.slug || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    return names.has(handleOrSlug) || names.has(name) || String(item.namespaceID) === String(knownID);
  });
  if (match) return match;
  if (set[0]) return set[0];
  throw new Error("No Compose namespace is visible to this user. Open /compose and check you can see Plexys Homework.");
}

export async function resolveModule(_compose, namespaceID, handle) {
  const listed = await composeGet(`/namespace/${namespaceID}/module/?limit=100`);
  const set = asSet(listed);
  const aliases = {
    SupportTicket: ["SupportTicket", "Support Ticket"],
    Customer: ["Customer"],
  };
  const names = aliases[handle] || [handle];
  const match = set.find((item) => names.includes(item.handle) || names.includes(item.name));
  if (!match) throw new Error(`Module '${handle}' was not found in this namespace.`);
  return match;
}
