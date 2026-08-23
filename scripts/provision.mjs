/**
 * Replayable Compose provisioner.
 * The homework asks for UI configuration; this script exists so a clean clone
 * can recreate the same namespace/modules without repeating the click path.
 *
 * Usage (after first-run signup):
 *   set CORTEZA_JWT=...   (from browser: Application / local storage is not used;
 *                          copy a Bearer token from an authenticated Compose request)
 *   node scripts/provision.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.CORTEZA_API || "http://127.0.0.1:18080/api";
const jwt = process.env.CORTEZA_JWT;

if (!jwt) {
  console.error("Set CORTEZA_JWT to an admin access token, then re-run.");
  process.exit(1);
}

async function api(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${JSON.stringify(payload)}`);
  }
  return payload.response ?? payload;
}

async function findOrCreateNamespace(spec) {
  const listed = await api("GET", `/compose/namespace/?query=${spec.handle}&limit=50`);
  const existing = (listed.set || []).find((item) => item.handle === spec.handle);
  if (existing) return existing;
  return api("POST", "/compose/namespace/", spec);
}

async function findOrCreateModule(namespaceID, spec) {
  const listed = await api("GET", `/compose/namespace/${namespaceID}/module/?query=${spec.handle}&limit=50`);
  const existing = (listed.set || []).find((item) => item.handle === spec.handle);
  if (existing) return existing;
  return api("POST", `/compose/namespace/${namespaceID}/module/`, spec);
}

const namespaceSpec = JSON.parse(await readFile(join(root, "compose/namespace.json"), "utf8"));
const customerSpec = JSON.parse(await readFile(join(root, "compose/customer.module.json"), "utf8"));
const ticketSpec = JSON.parse(await readFile(join(root, "compose/ticket.module.json"), "utf8"));

const ns = await findOrCreateNamespace(namespaceSpec);
const customer = await findOrCreateModule(ns.namespaceID, customerSpec);

ticketSpec.fields = ticketSpec.fields.map((field) => {
  if (field.kind !== "Record") return field;
  return {
    ...field,
    options: {
      moduleID: customer.moduleID,
      labelField: "Name",
      query: ["Name", "Company"],
    },
  };
});

const ticket = await findOrCreateModule(ns.namespaceID, ticketSpec);

if (!(await api("GET", `/compose/namespace/${ns.namespaceID}/module/${customer.moduleID}/record/?limit=1`)).set?.length) {
  await api("POST", `/compose/namespace/${ns.namespaceID}/module/${customer.moduleID}/record/`, {
    values: [
      { name: "Name", value: "Nordic Freight" },
      { name: "Company", value: "Nordic Freight AB" },
      { name: "Email", value: "ops@nordic-freight.example" },
    ],
  });
}

if (!(await api("GET", `/compose/namespace/${ns.namespaceID}/module/${ticket.moduleID}/record/?limit=1`)).set?.length) {
  const customers = await api("GET", `/compose/namespace/${ns.namespaceID}/module/${customer.moduleID}/record/?limit=1`);
  await api("POST", `/compose/namespace/${ns.namespaceID}/module/${ticket.moduleID}/record/`, {
    values: [
      { name: "Subject", value: "Dock scanner offline in Gothenburg" },
      { name: "Description", value: "Seed record created so the module can be verified." },
      { name: "Status", value: "New" },
      { name: "Priority", value: "High" },
      { name: "Customer", value: customers.set[0].recordID },
    ],
  });
}

console.log("Namespace", ns.namespaceID);
console.log("Customer module", customer.moduleID);
console.log("Support Ticket module", ticket.moduleID);
