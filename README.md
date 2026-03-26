# LM Trade Shop

Subscription shop for LM Trade AI Dashboard.

## Setup

Deploy to Vercel and set these environment variables:

| Variable | Description |
|----------|-------------|
| `COINBASE_COMMERCE_API_KEY` | From commerce.coinbase.com → Settings → API Keys |
| `COINBASE_WEBHOOK_SECRET` | From Coinbase Commerce → Webhooks |
| `RESEND_API_KEY` | From resend.com → API Keys |
| `ADMIN_SECRET` | Your chosen admin password |
| `DASHBOARD_URL` | https://trade-ai-dashboard.vercel.app |
| `SITE_URL` | Your Vercel shop URL |

## Pages

- `/` — Landing page with checkout
- `/admin` — Admin panel for manual user management
- `/success` — Post-payment success page

## API

- `POST /api/create-charge` — Creates Coinbase Commerce charge
- `POST /api/webhook` — Handles payment confirmation
- `POST /api/admin` — Admin user management

## Flow

1. Customer visits landing page → enters email → clicks buy
2. Coinbase Commerce checkout opens
3. Customer pays with USDT/BTC/ETH
4. Webhook triggers → credentials generated → email sent via Resend
5. Customer receives email with username/password
