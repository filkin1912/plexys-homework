# Plexys homework — Support desk

```bash
cd spa
npm install
npm run build

cd ../corteza
docker compose up -d
```

Wait until http://localhost:18080/version returns `"version":"2024.9.9"`.

Open http://localhost:18080/tickets and sign in:

- email: `homework@plexys.local`
- password: `Homework!2026`

The first `docker compose up` creates that user and about 20 tickets. If login fails or the list is empty, the machine already has an old empty Docker volume:

```bash
cd corteza
docker compose down -v
docker compose up -d
```

Documentation: [docs/Plexys-homework-documentation.pdf](docs/Plexys-homework-documentation.pdf).
