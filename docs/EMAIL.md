To: hiring@plexys.eu
Subject: Homework — Front-end / Full-stack Engineer (Vasil Filkin)

Hello,

Please find my Corteza homework:

- Repository: https://github.com/filkin1912/plexys-homework
- Documentation PDF: docs/Plexys-homework-documentation.pdf (also attached)

Local instance
- Corteza 2024.9.9 + Postgres 15 via Docker Compose
- Desk: http://localhost:18080/tickets
- Compose: http://localhost:18080/compose
- From a clean clone: `cd corteza && copy .env.example .env && docker compose up -d`, then
  `cd ../spa && npm install && npm run build`
- First-run signup at /auth/signup (first user is admin)
- Demo account used while building: homework@plexys.local / Homework!2026

What I shipped
- Namespace Plexys Homework with Support Ticket + related Customer
- Vue 3 Composition API SPA: list / create / edit / delete, signed-in identity
- Served as a Corteza webapp (HTTP_WEBAPP_LIST) using the default OAuth2 client
- Subject/customer search, priority filter, 7-per-page pager

Documentation PDF is attached.

Best regards,
Vasil Filkin
Sofia · filkinvasil@gmail.com · +359 883 950 900
