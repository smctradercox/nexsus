# NEXUS

NEXUS is a subscription-based chart analysis dashboard built with Next.js App Router, TypeScript, Tailwind CSS, Drizzle ORM, and Neon PostgreSQL. Users submit USDT TRC-20 payment receipts for manual review, then use Gemini Vision for chart analysis while their subscription is active.

## Requirements

- Node.js 20 or newer
- A Neon PostgreSQL database
- Cloudflare R2 credentials for private chart-image storage
- A Google Gemini API key
- A Telegram bot and administrator chat ID for payment receipt notifications
- A USDT TRC-20 receiving wallet

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the required values.
3. Apply database migrations using `npm run db:migrate`.
4. Start the app using `npm run dev` and open `http://localhost:3000`.
5. Register a user account, then promote it to administrator as described below.

The application requires `DATABASE_URL` and a `SESSION_SECRET` of at least 32 characters. Generate a secret with `openssl rand -base64 48`. Analysis requires `GEMINI_API_KEY` and configured R2 credentials; receipt submission also requires the Telegram settings. The wallet and QR code are hidden until `USDT_TRC20_WALLET` is set.

## Administrator setup

Register the account you intend to use as the administrator, then run this command from the project root:

```bash
npm run admin:promote -- your_username
```

The command only promotes an existing account and never creates an account or exposes an admin-registration endpoint. It uses `DATABASE_URL` from the current environment. For production, run it once with the production `DATABASE_URL` after deploying and registering the administrator account. Sign out and back in after promotion so the session reloads the updated role.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string, including `sslmode=require` |
| `SESSION_SECRET` | Secret used to sign HTTP-only session cookies; minimum 32 characters |
| `GEMINI_API_KEY` | Gemini API access for chart vision analysis |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token used to send receipt photos |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat or group ID that receives payment alerts |
| `USDT_TRC20_WALLET` | Deposit address displayed with a QR code |
| `R2_ACCOUNT_ID` | Cloudflare account ID for private object storage |
| `R2_ACCESS_KEY_ID` | R2 access key with access to the configured bucket |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | Private R2 bucket for chart images |
| `NEXT_PUBLIC_APP_URL` | Canonical deployment origin, used in Telegram admin links |

Never commit `.env.local` or production secrets. Set the same variables in Vercel project settings. Keep the R2 bucket private; image access is issued through short-lived signed URLs after checking the user's session and ownership.

## Commands

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run db:generate` generates a Drizzle migration from schema changes.
- `npm run db:migrate` applies pending migrations.
- `npm run db:studio` opens Drizzle Studio.
- `npm run admin:promote -- username` promotes an existing user account.

## Product behavior

- Registration requires a username and an exactly 6-digit password. Passwords are bcrypt-hashed and sessions use signed, HTTP-only cookies.
- Each user may have one pending payment request. Receipt images are sent to the configured Telegram chat with the username, timestamp, payment ID, and a link to the signed-in admin review queue.
- Admin approval activates or extends the subscription by 30 days. Rejected requests do not grant access.
- Chart uploads are limited to PNG/JPEG images up to 4 MB. Analysis checks the active subscription on the server and is limited to 20 requests per user per rolling 24 hours.
- Chart images are stored privately in R2. Analysis records and payment history are stored in PostgreSQL.

## Deployment notes

Deploy the app to Vercel with the environment variables configured, then run `npm run db:migrate` against the production Neon database. Register and promote the administrator account with the production database before reviewing payments. Configure `NEXT_PUBLIC_APP_URL` to the public app origin so Telegram review links resolve correctly.

The payment workflow is manual verification only; the application does not monitor the TRON blockchain or automatically confirm transactions. Review transfers in the configured Telegram chat before approving a request. The analysis output is educational and is not financial advice.
