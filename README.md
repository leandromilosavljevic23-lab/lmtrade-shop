# AI Trade Board — Shop & Dashboard

Vollständiger Shop + Customer-Dashboard für AI Trade Board.

## Pages

- `/` — Landing-Page mit Crypto-Checkout
- `/dashboard` — Customer-Dashboard (Login + 6 Asset-Briefings + Deep Dive + Kalender + Trade-Journal)
- `/admin` — Admin-Panel zum manuellen Anlegen/Verlängern von Zugängen
- `/success` — Bestätigungsseite nach Zahlung

## API

- `POST /api/create-charge` — Coinbase Commerce Charge anlegen
- `POST /api/webhook` — Zahlungs-Webhook (legt User automatisch in Redis an + sendet Email)
- `POST /api/admin` — Admin-User-Management (`create`/`extend`/`list`/`delete`)
- `POST /api/auth` — Dashboard-Login (validiert gegen Redis)
- `GET  /api/prices` — Live-Preise von CoinGecko, Frankfurter, Yahoo Finance (60s gecached)

## Setup auf Vercel (komplett kostenlos)

### 1. Repo zu Vercel verbinden
GitHub-Repo importieren → Vercel deployt automatisch.

### 2. Upstash Redis (gratis, für Login & User-Management)
1. Auf [upstash.com](https://upstash.com) Konto anlegen (kein CC nötig — Free-Tier 10k Commands/Tag)
2. „Create Database" → Region wählen → fertig
3. In der DB-Übersicht oben „REST API" → URL und Token kopieren
4. In Vercel Project → Settings → Environment Variables hinzufügen:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Coinbase Commerce (für Krypto-Zahlungen)
1. [commerce.coinbase.com](https://commerce.coinbase.com) → Settings → API Keys → erstellen
2. Webhooks: `https://DEINE-DOMAIN/api/webhook` eintragen → Secret kopieren
3. Vercel Env Vars:
   - `COINBASE_COMMERCE_API_KEY`
   - `COINBASE_WEBHOOK_SECRET`

### 4. Resend (für Bestätigungs-Emails, gratis)
1. [resend.com](https://resend.com) Konto erstellen (Free-Tier 3k Emails/Monat)
2. API Key erstellen
3. Vercel Env Var: `RESEND_API_KEY`

### 5. Admin-Passwort & URLs
Vercel Env Vars:
- `ADMIN_SECRET` — beliebiges starkes Passwort für `/admin`
- `SITE_URL` — z.B. `https://lmtrade-shop.vercel.app`
- `DASHBOARD_URL` — optional, default = `${SITE_URL}/dashboard`

### 6. Redeploy
In Vercel auf „Redeploy" klicken nachdem alle Env Vars gesetzt sind.

## Alle Env Variablen auf einen Blick

| Variable | Pflicht | Zweck |
|----------|---------|-------|
| `UPSTASH_REDIS_REST_URL` | ja | User-Datenbank (sonst Demo-Modus) |
| `UPSTASH_REDIS_REST_TOKEN` | ja | wie oben |
| `COINBASE_COMMERCE_API_KEY` | ja | Crypto-Zahlungen |
| `COINBASE_WEBHOOK_SECRET` | ja | Webhook-Signatur-Verifizierung |
| `RESEND_API_KEY` | ja | Bestätigungs-Emails |
| `ADMIN_SECRET` | ja | Login für `/admin` |
| `SITE_URL` | ja | z.B. `https://lmtrade-shop.vercel.app` |
| `DASHBOARD_URL` | nein | Default: `${SITE_URL}/dashboard` |
| `USERS_JSON` | nein | Fallback wenn kein Upstash. Format: `[{"u":"username","p":"pass","exp":"2026-12-31"}]` |

## Auth-Modi (automatischer Fallback)

`/api/auth` versucht in dieser Reihenfolge:
1. **Upstash Redis** (wenn `UPSTASH_REDIS_REST_URL` gesetzt) — empfohlen
2. **USERS_JSON** env var (für kleine Listen, manuell)
3. **Demo-Modus** (jeder User ≥4 Zeichen, Passwort ≥6 Zeichen) — nur wenn nichts konfiguriert

## Customer-Flow

1. Kunde zahlt auf der Landing-Page mit USDT/BTC/ETH
2. Coinbase Webhook trifft `/api/webhook` ein
3. User wird **automatisch** in Upstash Redis angelegt
4. Resend sendet Email mit Username/Passwort
5. Kunde loggt sich auf `/dashboard` ein

## Live-Daten

Das Dashboard zieht alle 90 Sekunden Live-Preise von:
- **CoinGecko** (BTC, ETH) — gratis, kein Key
- **Frankfurter** (EUR/USD) — gratis, kein Key
- **Yahoo Finance** (Gold, NAS100, DXY) — gratis, inoffiziell

AI-Briefings, Wochen-Themen und Kalender sind aktuell **statisch im JS** und können wöchentlich manuell aktualisiert werden in `dashboard.html` (Arrays `ASSETS` und `CAL`).
