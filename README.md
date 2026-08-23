# Plexys homework — Support desk

Vue 3 SPA on a local Corteza 2024.9.9 instance (Docker + Postgres 15). Custom app is served by Corteza at `/tickets`.

Repository: https://github.com/filkin1912/plexys-homework

## Quick start

```bash
cd spa
npm install
npm run build

cd ../corteza
docker compose up -d
```

Wait until http://localhost:18080/version returns `"version":"2024.9.9"`. The `bootstrap` container creates the demo user, namespace, modules, and seed tickets on first boot (it is safe to run again).

Then open http://localhost:18080/tickets and sign in:

- email: `homework@plexys.local`
- password: `Homework!2026`

You should see the same Support Ticket list as in the documentation (about 20 tickets, 3 customers).

If you already started Corteza once **without** this seed, reset the volumes and start again:

```bash
cd corteza
docker compose down -v
docker compose up -d
```

Other URLs:

- Compose (module builder): http://localhost:18080/compose
- Admin: http://localhost:18080/admin

## Part 1 — Compose UI

In Low Code (Compose), create namespace **Plexys Homework** (handle `plexys_homework`).

1. Module **Customer** — Name (String, required), Company (String), Email (Email).
2. Module **Support Ticket** — Subject (String, required), Description (String, multi-line), Status (Select: New / In Progress / Resolved / Closed, required), Priority (Select: Low / Medium / High / Urgent, required), Due Date (DateTime), Customer (Record → Customer, label field Name).
3. Do not add created / updated / owner fields.
4. Create one Customer and one Support Ticket in Compose so the modules write.

`compose/*.json` plus `scripts/bootstrap.mjs` replay the same model and seed data on `docker compose up`.

## Why these choices

- **2024.9.9** — latest stable tag matching the current docs series; pin the patch.
- **Served as a Corteza webapp** — same origin as `/auth` and `/api`, default OAuth2 client, records owned by the signed-in user. Not a standalone Vite origin (that would need a separate Auth Client and CORS).
- **Vue 3 Composition API** as specified. `@cortezaproject/corteza-vue` is Vue 2.7, so auth is a small port of its default-client flow; record I/O uses `@cortezaproject/corteza-js` `apiClients.Compose`.
- **PrimeVue** dialogs for focus-trap modals; semantic table for the list.

Full write-up: [docs/Plexys-homework-documentation.pdf](docs/Plexys-homework-documentation.pdf).

## Layout

```
Real_task/
  corteza/          Docker Compose (official server + Postgres 15)
  spa/              Vue 3 desk
  compose/          Namespace, module field specs, seed tickets
  scripts/          First-boot bootstrap
  docs/             PDF + HTML source
```
