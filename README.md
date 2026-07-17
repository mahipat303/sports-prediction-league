# 🏆 Office Sports Day — Prediction League

An internal prediction league for the annual office Sports Day. Employees
predict match winners and earn **virtual points** — no real money, no
gambling, just bragging rights.

Built with **Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma ·
NextAuth v5 · Recharts · Framer Motion · PostgreSQL**.

## How it works

1. Before Sports Day, an IPL-style auction assigns employees
   (💎 Platinum / 🥇 Gold / 🥈 Silver) to four owner teams.
2. The admin imports the two office Excel files — the **Auction** workbook and
   the **Games Schedule** workbook. Format is auto-detected.
3. Everyone signs in, browses teams/players/fixtures, and predicts winners.
   Predictions lock automatically a few minutes before each match.
4. The admin enters results; points, streak bonuses and the leaderboard update
   instantly.

## Quick start (local)

```bash
npm install
cp .env.example .env          # set DATABASE_URL (Postgres) + AUTH_SECRET
npm run db:push               # creates the tables
npm run seed                  # admin + demo users
npm run dev
```

Sign in as `admin@opshub.com` / `password123` (change after first login;
demo users: priya@ / rahul@ / sneha@opshub.com, same password).
The **first user to register also becomes admin** automatically on a fresh DB.

> Tip: for a zero-setup local DB, point `DATABASE_URL` at a free
> [Neon](https://neon.tech) database — the same one you'll use in production —
> or switch the provider in `prisma/schema.prisma` to `"sqlite"` with
> `DATABASE_URL="file:./dev.db"`.

## Authentication & security

- **Office emails only**: registration is restricted to
  `@opshub.com` (configurable via `ALLOWED_EMAIL_DOMAIN`).
- **Email verification**: registering sends a 6-digit code (15-minute
  expiry); accounts can't sign in until verified. Configure `SMTP_*` or
  `RESEND_API_KEY` in the environment to deliver codes — without them, codes
  are printed to the server logs (useful for testing, and readable in
  Vercel → Deployments → Functions logs in a pinch).
- Google login (optional) is restricted to the same domain.

## Deploy to Vercel (recommended)

1. Create a free Postgres DB at [neon.tech](https://neon.tech) → copy the
   connection string.
2. Push this repo to GitHub and import it at
   [vercel.com/new](https://vercel.com/new). The `vercel-build` script runs
   `prisma db push` automatically, so tables are created on first deploy.
3. Set the environment variables: `DATABASE_URL`, `AUTH_SECRET`
   (`openssl rand -base64 32`), `ALLOWED_EMAIL_DOMAIN=opshub.com`, and your
   email settings (`SMTP_*` or `RESEND_API_KEY`).
4. Open the deployed URL, **register first** (first account = admin), then
   upload the two Excel files from **Admin → Excel Import**.
5. Share the URL in the office group. 🎉

### Import the real data

Via UI: **Admin → Excel Import** (import the Auction file first, then the
Schedule file). Or via CLI:

```bash
npm run import -- "/path/to/Sports Day - Auction.xlsx" "/path/to/Games Schedule_Sports.xlsx"
```

Sample files matching the expected formats: `npm run template` →
`excel-template/`.

#### Supported formats

**Auction workbook**
- *Players sheet*: `Name`, `Gender`, `Player Category` (Platinum/Gold/Silver,
  captains as "Gold (Captain)"), plus per-sport self-rating columns.
- *Purchases sheet*: four team blocks side by side
  (`Player Purchased | Price | Purse Left | Sports Covered`), rows grouped
  under category header rows. Team names are the owner pairs in row 1.

**Schedule workbook**
- Sheet `All` (or per-sport sheets):
  `Sport | Category | Stage | Player/Team 1 | Player/Team 2 | Scheduled Date | Time | Winner | Runner-up | Winner Points | Runner-up Points`.
- Doubles pairs (`Chintan/Purvang`) are split and matched to players; short
  names, initials ("PP") and small spelling variants are resolved
  automatically. Unmatched names stay as display labels (fix under Admin →
  Players/Fixtures).
- Placeholder rounds ("Winner Group A") import as locked fixtures; resolve
  them under **Admin → Fixtures** once earlier rounds finish and predictions
  open automatically.

Re-importing is safe: schedules and prices update, predictions and entered
results are never overwritten.

## Features

- **Dashboard**: countdown to Sports Day, today's matches, leaderboard
  preview, top predictors, latest results.
- **Teams**: owner pairs, purse spent/remaining, full squad by category with
  auction prices.
- **Players**: search + filter by team/sport/category, auction price, W/L.
- **Fixtures**: filter by sport/category/status, one-tap predictions with
  pick-percentage bars, auto-locking.
- **Confidence levels**: Low 1× · Medium 1.5× · High 2× (no penalty when wrong).
- **Scoring** (admin-configurable in Settings): correct +10, upset +15,
  daily streak +5, perfect day +20, lock window minutes.
- **Leaderboard**: podium for the top 3, accuracy %, current streaks.
- **Stats**: accuracy by sport & match category, team standings by Sports Day
  points, most predicted, best/worst predictor, top auction buys (Recharts).
- **Notifications**: results, bonuses, achievements.
- **Admin panel**: Excel import, fixtures (create/lock/start/resolve
  placeholders/delete), result entry with upset flag, team/player editing,
  bonus points, user roles, scoring settings.
- Dark/light mode, glassmorphism UI, Framer Motion animations, confetti on
  saved/correct predictions, fully responsive.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run seed` | Seed admin + demo users |
| `npm run import -- <files>` | CLI Excel import |
| `npm run template` | Generate sample Excel templates |
| `npm run db:push` / `db:studio` | Create/update tables / data browser |
| `npm run typecheck` / `lint` | TS / ESLint |

## Self-hosting alternative (Docker)

`docker compose up --build` runs the app + Postgres on any office machine
(set `AUTH_SECRET` in your env). For Google login, set `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` and use `/login?google=1`.

## Architecture notes

- `src/lib/excel-import.ts` — format detection, name matching, validation.
- `src/lib/scoring.ts` — points engine; results are evaluated once and the
  leaderboard is recomputed idempotently, so re-running is safe.
- Fixtures are modeled as two generic **sides** (player, doubles pair, team or
  placeholder), which supports singles/doubles/team events and future
  tournament types without schema changes.
- Multiple tournaments, live scores and fantasy teams can build on the
  existing `Tournament`, `Fixture.status=LIVE` and `PointsHistory` models.
