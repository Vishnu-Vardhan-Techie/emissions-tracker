# Emissions Tracker

Full-stack carbon accounting app: React + Express + MongoDB, deployed with Docker Compose.

- **Role-based access** – `admin` (everything, users, factors, targets), `analyst` (add/delete activities, CSV and invoice import), `viewer` (read-only dashboards and records). Enforced on the API; the UI only hides what the API would reject.
- **Emission engine** – `emissions = quantity × factor`, with unit conversion (MWh→kWh, gallon→litre, mile→km…) and Scope 1/2/3 tagging. Factors live in MongoDB and are editable by admins.
- **Ingestion** – activity CSV (`factor_key`, quantity, unit) and invoice CSV (spend-based, multi-currency, keyword classification). "Validate only" mode, per-line rejection reasons.
- **Dashboards** – totals and year-over-year change, Scope 1/2/3 split, category breakdown (chart + table view), monthly trend, and reduction targets with a linear pathway, on-track flag and projected full-year figure.

## Deploy (Docker)

```bash
cp .env.example .env
# edit .env: set JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
```

Open http://localhost:8080 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The first admin is created only when the database has no users. Set `SEED_DEMO=true` for the first start to load two years of sample data and a demo target.

Put a TLS-terminating reverse proxy (Caddy, Traefik, a cloud load balancer) in front of port 8080 for production. Back up the `mongo_data` volume.

## Client demo (no backend)

`cd web && npm run build:demo` builds a self-contained copy that replaces the API with an in-browser mock (same emission engine, seeded sample data, three logins: `admin@demo.io`, `analyst@demo.io`, `viewer@demo.io`, password `demo`). Serve `web/dist-demo` from any static host. Data resets on reload. The mock is a copy of the server engine under `web/src/demo/engine`; re-copy it if you change the server engine.

## Local development

```bash
# MongoDB on localhost:27017, then:
cd server && npm install && JWT_SECRET=$(openssl rand -hex 32) ADMIN_EMAIL=a@b.co ADMIN_PASSWORD=changeme123 SEED_DEMO=true npm run dev
cd web && npm install && npm run dev      # http://localhost:5173, proxies /api to :4000
```

## Tests

```bash
cd server && npm test                                   # unit + HTTP auth tests (no DB needed)
MONGO_TEST_URI=mongodb://localhost:27017/et_test npm test   # also runs DB-backed API tests (drops that DB)
```

## Emission factors – read this before reporting

The factors in `server/src/engine/factors.js` are **representative defaults** labelled EPA / DEFRA / IPCC / IEA, entered for development. They are not a verified copy of any published dataset. Before using the numbers for disclosure or audit, check each factor against the current release of its source and update it (Emission factors page → Edit, or `PATCH /api/factors/:key`). The spend-based factors are especially coarse. Currency rates for invoices are also illustrative: set `CURRENCY_RATES`.

## CSV formats

`activity`: `date,factor_key,quantity,unit,facility,description`
`invoice`: `invoice_no,vendor,date,description,amount,currency,factor_key` (factor_key optional)

Templates are downloadable from the Upload page.

## API summary

`POST /api/auth/login` · `GET /api/auth/me` · `GET /api/dashboard?year=` · `GET|POST|DELETE /api/activities` · `POST /api/ingest/{activity|invoice}[?dryRun=true]` · `GET|POST|PATCH|DELETE /api/targets` · `GET|PATCH /api/factors` · `GET|POST|PATCH /api/users`

## Known limits

- One organization per user; users cannot self-register (admins create accounts).
- JWTs last 8 hours and are kept in `sessionStorage`; there is no refresh or logout-everywhere.
- Charts use a light theme only.
