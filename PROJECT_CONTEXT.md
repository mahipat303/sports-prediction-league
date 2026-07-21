# PROJECT_CONTEXT.md — Office Sports Day Prediction League

> **Purpose of this document:** complete technical + functional handoff so a new
> chat can continue development without the prior conversation history.
> **Last updated:** 21 July 2026, after PR #9 (Sports Day team points) shipped.
> **Status:** 🟢 LIVE IN PRODUCTION AND ACTIVELY USED (57 users, 1332 predictions).

## Read this first
1. **§9 Development Guidelines** — the mandatory workflow (analyze → approval →
   branch → test → PR). Non-negotiable.
2. **§9.1 Test Environment** — ⚠️ the local `.env` points at the **production
   database**.
3. **§13 Current Project Status** — what's done and what's pending right now.
4. **§14 Code Navigation Map** — where everything lives.
5. `AGENTS.md` in the repo root — Next.js 16 differs from training data.

### Contents
| § | Section | § | Section |
|---|---|---|---|
| 1 | Project Overview | 10 | Coding Standards |
| 2 | Application Features | 11 | Future Roadmap |
| 3 | Database Structure | 12 | Conversation Learnings |
| 4 | Business Rules | 13 | Current Project Status |
| 5 | Features Implemented | 14 | **Code Navigation Map** |
| 6 | Pending Requests | 15 | **Operational Runbooks** |
| 7 | Excel Integration | 16 | **Troubleshooting** |
| 8 | Known Issues | 17 | **Glossary & Reference Data** |
| 9 | Development Guidelines (+ 9.1 Test Environment) | | |

---

# 1. Project Overview

## What this application is
An internal **prediction league** web app for OpsHub's annual office Sports Day.
Employees predict the winners of real office matches (Chess, Carrom, Table
Tennis, Badminton, Cricket, Volleyball, Pickleball) and earn **virtual points**.
It also tracks the **real tournament**: schedule, results, brackets, and the
actual Sports Day points each office team earns.

**It is explicitly NOT a gambling app.** No money, no wagering — virtual points
and bragging rights only. This framing appears in the UI footer and must be
preserved.

## Why it was built
Sports Day is run from two Excel workbooks. The app makes the tournament
visible and interactive: colleagues can browse teams/players/fixtures, predict
outcomes, and follow live standings without opening a spreadsheet. Top-3
predictors receive real prizes.

## Target users
- **Employees (USER role)** — ~57 registered. Predict, view standings.
- **Admins (ADMIN role)** — 4 currently: `admin@opshub.com`,
  `nisarg.koradia@opshub.com`, `prashant.patel@opshub.com`,
  `mahipatsinh.parmar@opshub.com`. Import data, publish results, configure scoring.

## Overall architecture
Next.js **App Router**, server-first:
- **Server Components** fetch data directly via Prisma (no REST/tRPC layer).
- **Server Actions** (`"use server"`) handle all mutations.
- **Client Components** only where interactivity is needed (`"use client"`).
- No separate API layer — the only route handler is NextAuth's.

```
src/
  app/            routes (server components) + actions.ts files
  components/     UI; components/ui/* are primitives
  lib/            business logic (scoring, brackets, imports, standings)
prisma/schema.prisma
scripts/          one-off CLI migrations/imports
public/           static assets incl. OpsHub logos
```

## Tech stack
| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.10** (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, Framer Motion, lucide-react |
| Popovers | `@radix-ui/react-popover` (only Radix package used) |
| Charts | Recharts |
| ORM / DB | Prisma 6.19.3 → **PostgreSQL (Neon, ap-southeast-1)** |
| Auth | NextAuth v5 (JWT sessions, credentials + optional Google) |
| Email | nodemailer (SMTP) with Resend fallback |
| Excel | `xlsx` (SheetJS) |
| Hosting | **Vercel** (functions pinned to `sin1` via `vercel.json`) |

⚠️ **`AGENTS.md` / `CLAUDE.md` in the repo warn:** this Next.js version has
breaking changes vs. training data. Read `node_modules/next/dist/docs/` before
writing framework-level code.

## Deployment status
- **Live:** https://sports-prediction-league.vercel.app
- **Repo:** https://github.com/mahipat303/sports-prediction-league (private)
- **DB:** Neon project `calm-band-52307994`, region `aws-ap-southeast-1`
- **Schema deploys** automatically: `vercel-build` = `prisma generate && prisma db push && next build`
- Deploy command used: `npx vercel --prod` from `main` after merging a PR.
- **Git auto-deploy is NOT connected** (Vercel GitHub app not installed) — deploys are manual.

### Environment variables (Vercel + local `.env`)
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `ALLOWED_EMAIL_DOMAIN=opshub.com`,
`SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, optional `AUTH_GOOGLE_ID/SECRET`.
Email currently sends via Gmail SMTP (`memahipat303@gmail.com` + app password).

## Development workflow (MANDATORY — see §9)
Analyze → propose plan → **wait for approval** → feature branch → implement →
test (incl. Neon branch copy for data changes) → **Pull Request** → user merges
→ pull `main` → `npx vercel --prod`.

---

# 2. Application Features

## Authentication (`/login`, `/register`)
- **Purpose:** restrict the app to OpsHub employees.
- **Implementation:** NextAuth v5 credentials provider, bcrypt hashes, JWT sessions.
  Registration is a **two-step flow**: submit details → 6-digit code emailed →
  enter code → auto sign-in.
- **Rules:**
  - Email **must** end in `@opshub.com` (`ALLOWED_EMAIL_DOMAIN`), enforced
    server-side *and* via input `pattern`.
  - **Unverified users cannot sign in** (`emailVerified` null → `authorize()` returns null).
  - Code expires in **15 minutes**; "Resend code" available.
  - Google sign-in (if enabled) is domain-restricted in the `signIn` callback and
    is auto-verified.
  - **First user on an empty DB automatically becomes ADMIN.**
  - If SMTP is unconfigured, codes print to server logs (fallback only).

## Home page (`/`)
Hero (gradient, prize messaging, OpsHub icon badge, countdown), 4 quick stats,
today's/upcoming matches as `MatchCard`s, latest results, **Tournament Winner
prediction card**, top predictors, team list, and a full **Rules section**
(`id="rules"`). Champion card hidden when `CHAMPION_VISIBLE = 0`.

## Fixtures (`/fixtures`) — the prediction surface
All matches with filters (sport / category / status) and a prominent animated
**"How it works"** rules card. Each `MatchCard` shows sport, category, stage,
Sports-Day points badge, start time, both sides with avatars + team colours +
**pick-percentage bars**, confidence buttons with live point preview, **Watch
Live** button when `liveUrl` set, and winner/loser emojis once completed.
Predicting is one tap; changes save instantly with confetti.

## Schedule (`/schedule`) — public read-only timetable
Grouped by **IST day**, desktop table / mobile cards, quick stats (total,
completed, upcoming, live), status badges, winner display with team colours,
Watch Live buttons, filters + search. **Visible to logged-out users** (decided
deliberately — contains nothing sensitive).

## Predictions (business flow)
`submitPrediction` upserts one prediction per user per fixture. Blocked when the
fixture is a placeholder, not `SCHEDULED`, or `lockTime` has passed.

## My Predictions (`/predictions`)
Stats cards (points, accuracy, correct, best streak) then **tabs**:
- **✏️ Open Predictions** — editable `MatchCard`s (reuses the same component and
  action as `/fixtures`) with a live "Locks in 2h 14m" countdown.
- **📜 Prediction History** — locked/completed picks with lock reason
  (*Match started / Predictions closed / Result declared*) + Points Log.

## Tournament Winner Prediction
Users pick one of the four office teams as overall champion for a
**+50 point** bonus (`CHAMPION_BONUS`). Locks at `Tournament.championLockTime`
(falls back to `eventDate`). Scored separately — **does not affect prediction
accuracy**. Admin declares the champion; bonuses award idempotently.
**Currently 6 picks placed.**

## Leaderboard (`/leaderboard`) — 3 tabs
1. **🏆 Prediction Leaderboard** — podium + table (rank, points, accuracy,
   correct, wrong, streak), "You" highlight.
2. **🏅 Sports Day Points** — real team points from finals (NEW, PR #9).
3. **🎮 Win Records** — team + player win/loss records.

## Statistics (`/stats`)
Highlight cards (best predictor, most predicted, most successful team, upsets,
**MVP**, toughest luck), Sports Day team standings, accuracy charts by sport and
category, team win % radial chart, top auction buys. **Every stat has an ℹ️
tooltip** explaining its formula.

## Notifications (`/notifications`)
Result declared, bonus awarded, achievements, champion outcome.

## Admin Panel (`/admin/*`) — 10 tabs
| Tab | Function |
|---|---|
| **Dashboard** | Counts, Sports Day date, **Tournament Winner controls** (lock/unlock/reschedule/show/hide), declare champion |
| **Excel Import** | Upload auction/schedule workbooks (format auto-detected) |
| **Fixtures** | Create, edit date/time, live links, lock/start/delete, **bulk edit**, **resolve placeholders** (searchable dropdowns), **run bracket progression** |
| **Results** | Publish results (winner, score, upset flag), **edit published results** with confirmation + audit history |
| **Insights** | Admin-only view of every user's predictions + distributions + CSV export |
| **Team Points** | Configure points per sport+category, standings, manual adjustments, award ledger, recompute |
| **Teams / Players** | Edit teams; edit players + **re-resolve all fixtures** |
| **Users** | Promote/demote roles |
| **Settings** | All scoring values |

## Match Results
`enterResult` → sets winner/score/upset + status COMPLETED → `evaluateFixture()`
scores predictions → `awardTeamPointsForFixture()` awards team points →
`propagateBracket()` advances the bracket. `updateResult` does the same
idempotently and writes a `ResultEdit` audit row.

## Tournament Progression (auto)
`src/lib/bracket.ts` parses placeholder labels into structured references and
substitutes real winners recursively (Group → Group Final → Semi → Grand Final).
Generic — no hardcoded tournament rules.

## Placeholder Resolution (manual fallback)
Searchable dropdowns in Admin → Fixtures with intelligent options
(completed-match winners first 🏆, then bracket participants, then all players).

## Team Management
Four owner-pair teams with ₹60 Cr purses. Editing a player's team
**re-resolves historical fixtures** so nothing shows conflicting team info.

## Settings
All scoring values editable (see §4).

---

# 3. Database Structure

**24 models/enums.** Key entities:

### User
`id, name, email (unique), emailVerified, verificationCode, verificationExpires, image, passwordHash, role (USER|ADMIN), isGuest, timestamps`
→ predictions, pointsHistory, notifications, achievements, leaderboard (1:1), championPredictions

### Team (office team — 4 rows)
`id, name (unique, e.g. "Aakash & Bhoomi"), shortName (unique, "A&B"), logoUrl, color, ownerName, totalBudget, remainingBudget`
→ players, side1Fixtures/side2Fixtures, auctionEvents, championPredictions, championOf, **pointsAwards**

### Sport (7 rows)
`id, name (unique), icon` → fixtures, assignments, **pointRules**

### Player (79 rows)
`id, name (unique), gender, avatarUrl, category (PLATINUM|GOLD|SILVER|BRONZE), isCaptain, specialBadge, auctionPrice, ratings (JSON), teamId`

### Fixture (114 rows) — **the central model**
```
sportId, matchCategory, stage
side1Label, side2Label            // "Parth" | "Chintan/Purvang" | "Winner Group A"
side1Source, side2Source          // retained placeholder ref → enables re-derivation
side1TeamId, side2TeamId          // resolved owning team (snapshot)
isPlaceholder, winnerSide (1|2), scoreSummary
winnerPoints, runnerUpPoints      // Sports Day points (finals only)
startTime, lockTime, status, venue, liveUrl, isUpset, underdogSide
```
**Design decision:** a fixture is two generic **sides**, not team-vs-team. A side
can be a player, doubles pair, office team, or placeholder. This supports
singles/doubles/team events without schema changes.

### Prediction
`userId, fixtureId, predictedSide (1|2), confidence (LOW|MEDIUM|HIGH), isCorrect, pointsAwarded` — `@@unique([userId, fixtureId])`

### PointsHistory / LeaderboardEntry
Append-only user points ledger (`fixtureId` nullable — only match predictions set it) and the derived per-user aggregate (totalPoints, correct, wrong, currentStreak, bestStreak).

### Tournament / ChampionPrediction
`Tournament: name, eventDate, isActive, championLockTime, championTeamId`
`ChampionPrediction: tournamentId, userId, teamId, isCorrect, pointsAwarded` — `@@unique([tournamentId, userId])`

### TeamPointRule (NEW, 26 rows)
`sportId, matchCategory, winnerPoints, runnerUpPoints` — `@@unique([sportId, matchCategory])`. **Admin-configured source of truth for Sports Day points.**

### TeamPointsAward (NEW)
`teamId, fixtureId (nullable), points, type (CHAMPION|RUNNER_UP|MANUAL), reason, createdAt`. Auditable ledger; rebuilt per fixture.

### ResultEdit (13 rows)
Audit of result corrections: who, when, prev/new winner + score.

### Setting
Generic key/value store for all scoring config (currently **empty** → code defaults apply).

### Others
`FixturePlayer` (fixture↔player + side), `PlayerSportAssignment`, `AuctionEvent`, `Notification`, `Achievement`, `UserAchievement`.

### Key relationships
```
Team 1─* Player *─* Fixture (via FixturePlayer)
Fixture *─1 Sport ; Fixture *─1 Team (side1/side2 snapshots)
User 1─* Prediction *─1 Fixture
User 1─1 LeaderboardEntry ; User 1─* PointsHistory
Team 1─* TeamPointsAward *─1 Fixture
Sport 1─* TeamPointRule
```

---

# 4. Business Rules

## Prediction locking
Predictions close **`LOCK_MINUTES_BEFORE_START` (default 5) minutes before start**.
`lockDueFixtures()` flips SCHEDULED→LOCKED on read. A fixture is open only when
`status === SCHEDULED && !isPlaceholder && lockTime > now`.

## Confidence scoring (reward **and** risk)
| Confidence | Correct | Wrong |
|---|---|---|
| Low | +10 (×1) | **0** |
| Medium | +15 (×1.5) | **−5** |
| High | +20 (×2) | **−10** |

Upsets use base `POINTS_UPSET` (15) instead of 10 → a correct High upset = **+30**.
All values admin-configurable.

## Bonuses
- **Daily streak +5** — awarded once per day if ≥1 correct that day (only when all that day's fixtures are COMPLETED).
- **Perfect day +20** — all of a day's predictions correct, minimum 2 matches.
- **Champion +50** — correct tournament-winner pick. No penalty if wrong.

## Leaderboard calculation
`totalPoints` = SUM of **all** `PointsHistory` (match points + penalties + bonuses).
`currentStreak` = consecutive correct counting back from the most recent evaluated
prediction. Ties break by `correctPredictions`. Fully recomputed (idempotent).

## Result publishing (idempotency is critical)
`evaluateFixture()` **deletes that fixture's PointsHistory rows before recreating
them** — so editing a published result never double-counts. In `"reevaluate"`
mode it also wipes and re-derives that day's bonuses and sends a single
"Result updated" notification instead of re-spamming.

## Sports Day team points (NEW)
1. Admin publishes a **final**.
2. Champion/runner-up **sides** resolve to office teams — player→team links
   first, then label matching for team sports.
3. Amount comes from the `TeamPointRule` for that sport+category.
4. That fixture's awards are **deleted then recreated** → idempotent.
5. **Only finals award.** Gate = the fixture's own `winnerPoints/runnerUpPoints > 0`.
   The *rule* decides how much; the *fixture* decides whether.
   ⚠️ Critical edge case: rules are keyed by sport+category, which **group
   matches also match** — without the fixture-level gate a group match would
   wrongly earn final points. This bug was caught in testing and fixed.
6. Manual adjustments (`type = MANUAL`) survive recomputation.

## Match status
`SCHEDULED → LOCKED → LIVE → COMPLETED` (+ `CANCELLED`). Only COMPLETED fixtures
count for statistics and points.

## Statistics rules
- Accuracy = `correct ÷ (correct + wrong) × 100`; pending predictions excluded.
- Best/worst predictor require **≥3 scored predictions**.
- Team win rate = wins ÷ played; a team "plays" a fixture when a side resolved to it.
- **MVP formula:** `winRate×0.6 + wins×5 + played×2 + (price ÷ maxPrice)×10`
  (performance dominates; price is a tie-breaker). Requires ≥1 completed match.

## Admin permissions
`/admin` layout redirects non-admins. **Every server action calls `requireAdmin()`
independently** — the layout guard alone is insufficient because in App Router
pages render *in parallel* with layouts, so page data can stream before a layout
redirect takes effect (verified: `/admin/users` leaks emails via `curl`).
`/admin/insights` has an extra in-page guard before any query.

---

# 5. Features Already Implemented

Chronological, with rationale.

| # | Feature | Notes |
|---|---|---|
| — | **Core app** | Auth, home, teams, players, fixtures, predictions, leaderboard, stats, notifications, admin |
| — | **Excel import** | Auto-detects auction vs schedule workbook; fuzzy name matching |
| — | **Confidence penalties** | Wrong Medium/High picks now lose points — makes confidence a real decision |
| — | **Tournament winner prediction** | Separate +50 bonus, own card + admin declare |
| — | **Live match links** | Optional per-fixture URL → red "Watch Live" button |
| — | **Special badge** | 👑 OG Player on Mahipatsinh Parmar |
| — | **Rules everywhere** | Home section, fixtures card, floating global button, welcome popup |
| — | **Welcome popup** | Shows on **every** login (session flag cleared on login *and* logout); gradient "Give OpsHub Employees Claude Access!" petition + rules card |
| — | **Result indicators** | Winner 🏆😎🎉🔥👑💪 / loser 😭🤡💀😵🙈, deterministic per fixture |
| PR#1 | Stats tooltip + Team Win % redesign | Chart + legend unified |
| PR#2 | **Radix Popover tooltips** | Replaced custom positioning; also fixed that `--popover` CSS var was never defined → tooltips were transparent |
| PR#3 | **Edit from My Predictions, Tournament Standings, searchable placeholder dropdowns** | Reused MatchCard; shared `standings.ts` |
| PR#4 | **Timezone fix + missing Grand Finals** | See §8 |
| PR#5 | **Automatic bracket progression** | Recursive, edit-safe via `side1Source/side2Source` |
| PR#6 | **Corrected times on prediction-carrying fixtures** | 42 fixtures, 0 locked immediately |
| PR#7 | **My Predictions tabs, champion admin controls, fixture date editing, bulk editing** | Also fixed `setTournament` orphaning champion picks |
| PR#8 | **OpsHub branding** | Footer, auth pages, hero badge; white chip because logo is dark navy on transparency |
| PR#9 | **Sports Day team points** | `TeamPointRule` + `TeamPointsAward`, admin screen, standings tab, manual adjustments |

### Data migrations already applied to production
- **39 match times corrected** (+5:30 offset) + **19 Grand Finals created** (PR#4)
- **42 more times corrected**, 12 year-2206 fixtures fixed (PR#6)
- **26 TeamPointRules seeded** from the schedule (PR#9)

---

# 6. Pending Feature Requests

Everything explicitly requested has been **implemented**. Remaining items are
operational actions and known gaps:

| Item | Status | Priority | Notes |
|---|---|---|---|
| **Run bracket progression once** | ⏳ **Admin action pending** | **HIGH** | Admin → Fixtures → "⚡ Run bracket progression". Catches the bracket up from 25 completed results. Automatic thereafter. 31 placeholders currently unresolved. |
| **5 fixtures with unresolved team** | ⏳ Open | MEDIUM | Non-placeholder upcoming fixtures where a side doesn't map to a team → excluded from team stats. Fix via Admin → Players → "Re-resolve all fixtures", or add the missing player. |
| **"Joy" not in players list** | ⏳ Open | MEDIUM | Appears in schedule but absent from the auction sheet → 2 fixtures can't resolve. Needs the player created or the auction workbook updated. |
| **Completed fixtures still show old times** | ⏳ Deliberate | LOW | The 25 completed fixtures keep original stored times because `startTime` feeds daily-bonus grouping. Changing them could retroactively alter awarded bonuses. User decision required. |
| **Vercel git auto-deploy** | ⏳ Not connected | LOW | Vercel GitHub app not installed; deploys are manual `npx vercel --prod`. |
| Excel re-synchronisation | ✅ Tooling exists | — | `npm run import` / Admin → Excel Import; re-import never overwrites results or predictions. |
| Multi-tournament / season history | 💡 Future | LOW | Schema already supports it. |

⚠️ **Note:** The Tournament Winner prediction **was unlocked** — `championLockTime`
is now 21 Jul 2026 20:30 IST and **6 picks** have been placed. No longer blocked.

---

# 7. Excel Integration

## Two workbooks

### 1. Auction workbook (`Sports Day - 2026 - Auction.xlsx`)
- **Players sheet:** `Slide No | Name | Gender | Player Category | … | per-sport rating columns`.
  Categories: Platinum / Gold / Silver, captains as `"Gold (Captain)"`.
- **Purchases sheet:** four team blocks **side by side**, each
  `Player Purchased | Price | Purse Left | Sports Covered`, rows grouped under
  category header rows. Team names (owner pairs) are in row 1.
- Import derives: 79 players, 4 teams, budgets (₹60 Cr each), 51/52 purchases matched.

### 2. Schedule workbook (`Games Schedule_Sports_2026 1.xlsx`)
- Sheet **`All`** (authoritative; per-sport `Chess`/`Carrom` sheets exist but are
  **stale** and disagree on winners — importer reads only `All`).
- Columns: `Sport | Category | Stage | Player/Team 1 | Player/Team 2 | Scheduled Date | Time | Winner | Runner-up | Winner Points | Runner-up Points`.
- **114 rows: 95 complete fixtures + 19 rows with blank participants** (the Grand
  Finals — these were created manually by `scripts/fix-schedule.ts`).

## Mapping to the database
| Excel | Model |
|---|---|
| Sport | `Sport.name` |
| Category | `Fixture.matchCategory` |
| Stage | `Fixture.stage` |
| Player/Team 1 & 2 | `Fixture.side1Label` / `side2Label` + `FixturePlayer` links |
| Office team | `Team` (via `Player.teamId` → `side1TeamId`/`side2TeamId`) |
| Winner/Runner-up Points | `Fixture.winnerPoints/runnerUpPoints` + `TeamPointRule` |

## Name matching (`matchPlayer` in `excel-import.ts`)
Tiered: exact → unique first name → prefix → initials ("PP") → first-token
("Punit A") → Levenshtein ≤1 ("Chinmai"→"Chinmayi"). Two-pass with a `taken` set
so exact matches claim players before fuzzy tiers.

## Champion / runner-up points (26 finals only)
| Sport | Categories | Winner | Runner-up |
|---|---|---|---|
| Chess | 2 | 20 | 10 |
| Carrom | 5 | 10 | 5 |
| TT | 7 | 10 | 5 |
| Badminton | 7 | 10 | 5 |
| Pickleball | 3 | 15 | **7.5** |
| Cricket | 1 | 40 | 20 |
| Volleyball | 1 | 40 | 20 |

Points appear **only on `Grand Final` rows**. Max 305 points. Note 7.5 → Float required.

## Synchronisation process (established)
1. Copy the file into the project dir (`~/Downloads` is blocked by macOS privacy).
2. Diff Excel vs DB using the importer's own key + date parsing.
3. Report new / updated / unchanged / missing.
4. **Never touch** COMPLETED fixtures or fixtures carrying predictions without approval.
5. Test on a **Neon branch copy**, then apply.
6. Re-import is safe: schedules/prices update; predictions and entered results never overwritten.

**Dates:** prefer the **DB** over the Excel — admins may have rescheduled in-app.

---

# 8. Current Known Issues

### 🟡 Completed fixtures display pre-fix times
- **Cause:** the original importer used `setHours()` (server-local). On Vercel (UTC) "10:00 am" became 10:00 UTC = 15:30 IST.
- **Fixed** for all non-completed fixtures (PR#4 + PR#6) and in the importer itself (now builds instants from an explicit IST offset).
- **Remaining:** the 25 COMPLETED fixtures keep old times deliberately — `startTime` drives daily-bonus grouping.
- **Workaround:** none needed; historical display only.

### 🟡 5 fixtures + 31 placeholders unresolved to teams
- **Cause:** unmatched names ("Joy" absent from the auction sheet), plus placeholders awaiting earlier results.
- **Impact:** excluded from team win-rate stats; finals can't award points until resolved.
- **Fix:** run bracket progression; add the missing player then Admin → Players → "Re-resolve all fixtures".

### 🟡 Layout-only auth guards are insufficient
- **Cause:** App Router renders pages **in parallel** with layouts, so page data can stream before a layout `redirect()`.
- **Verified:** `/admin/users` returns emails to an unauthenticated `curl`.
- **Fixed:** `/admin/insights` has an in-page guard; every action calls `requireAdmin()`.
- **Technical debt:** other admin pages still rely on the layout guard. Recommend adding the same one-line in-page guard to each (proposed previously, not yet approved).

### 🟡 Excel per-sport sheets are stale
`Chess`/`Carrom` sheets disagree with `All` on winners. Importer reads only `All` — harmless, but don't treat them as source of truth.

### 🟢 Preview-harness hydration false negative
The local browser preview reports page-level client components as unhydrated even when they work in production (proven on the live leaderboard tabs). **Don't chase this** — verify interactivity on production instead. Vercel preview URLs are behind SSO and cannot be driven.

### 🟢 Settings table empty
All scoring runs on code defaults until an admin saves Settings. Intentional.

### 🔴 Local `.env` points at the PRODUCTION database
`DATABASE_URL` targets the live Neon branch, so `npm run dev` / `npm run build` /
any `npx tsx` script reads and writes **production data**.
- **Workaround:** override `DATABASE_URL` with a Neon test-branch URL for
  anything that writes; never run `npm run seed` or reset commands unguarded.
- **Planned fix:** add a separate `.env.local` pointing at a dedicated dev Neon
  branch, keeping production credentials out of day-to-day development.

### 🔴 No automated test suite
No Jest/Vitest/Playwright, no test directory, no `test` npm script. All
verification is manual (typecheck + lint + build + scripted DB assertions +
browser checks). See §9.1 and the roadmap.

---

# 9. Development Guidelines

**These were explicitly requested and must be followed.**

1. **Never work directly on `main`.** Always `git checkout -b feature/…` or `fix/…`.
2. **Analyze first.** For any non-trivial request: read the code, explain the
   approach, list files, state DB/API changes, list risks.
3. **Wait for explicit approval before writing code.** The user says "go ahead" /
   "do it" / "approved".
4. **Test locally** — `npx tsc --noEmit`, `npm run lint`, `npm run build`, and for
   **any data-touching change test on a Neon branch copy first**:
   ```bash
   npx neonctl branches create --project-id calm-band-52307994 --name <test>
   npx neonctl connection-string <test> --project-id calm-band-52307994
   # …run against it…
   npx neonctl branches delete <test> --project-id calm-band-52307994
   ```
5. **Raise a Pull Request** (`gh pr create`) and **wait for the user to merge**.
6. **After merge:** `git checkout main && git pull --ff-only && npx vercel --prod`,
   then verify Ready + route health.
7. **Preserve existing functionality.** Never modify prediction data, prediction
   points, leaderboards, historical results, or COMPLETED fixtures without
   explicit approval.
8. **Protected data** — never change without approval: user accounts, predictions,
   confidence selections, leaderboards, points history, tournament results.
9. **Report honestly.** If something couldn't be verified, say so explicitly.

---

## 9.1 Test Environment & Verification

### ⚠️ CRITICAL: local `.env` points at PRODUCTION
`DATABASE_URL` in the local `.env` targets the **live Neon production branch**
(`ep-autumn-violet-azfehzto…`). Therefore:

- **`npm run dev`, `npm run build` and any `npx tsx` script hit PRODUCTION data.**
- **Never** run `npm run seed`, `prisma migrate reset`, or destructive scripts
  without an explicit `DATABASE_URL` override.
- Always prefix data-touching commands with a test branch URL:
  ```bash
  DATABASE_URL=$(cat /tmp/test_branch.txt) npx tsx scripts/whatever.ts
  ```
- Read-only queries against production are fine and are how state is verified.

### There is NO automated test suite
No Jest / Vitest / Playwright / Cypress, no `__tests__` directory, no `test`
script in `package.json`. **This is a known gap** (see §11 roadmap).
Verification to date has been: static checks + scripted DB assertions on a
database branch + real browser checks.

### The real test environment: Neon database branching
Neon branches are **copy-on-write clones of production** — instant, isolated,
and free to discard. This is the safety net for every data change.

```bash
# 1. create an isolated copy of production
npx --yes neonctl@latest branches create \
  --project-id calm-band-52307994 --name my-test --output json

# 2. get its connection string
npx --yes neonctl@latest connection-string my-test \
  --project-id calm-band-52307994 > /tmp/test_branch.txt

# 3. apply schema changes to the copy (if any)
DATABASE_URL=$(cat /tmp/test_branch.txt) npx prisma db push --skip-generate

# 4. run migrations / assertions against the copy
DATABASE_URL=$(cat /tmp/test_branch.txt) npx tsx scripts/<script>.ts

# 5. ALWAYS clean up
npx --yes neonctl@latest branches delete my-test --project-id calm-band-52307994
```
Neon auth: `npx neonctl auth` (browser OAuth, **60-second timeout** — sign in to
console.neon.tech first, then it's one click).

### Static verification pipeline (run before every PR)
```bash
npx tsc --noEmit     # types
npm run lint         # eslint (Next 16 rules are strict: react-hooks/purity,
                     # set-state-in-effect, static-components)
npm run build        # production build — catches RSC/client boundary errors
```

### Scripted assertion pattern (used throughout this project)
Ad-hoc verification is written as inline `tsx` against a branch copy, asserting
invariants before/after. Example shape:
```bash
DATABASE_URL=$(cat /tmp/test_branch.txt) npx tsx -e '
import { prisma } from "./src/lib/prisma";
async function run(){
  const before = { p: await prisma.prediction.count(),
                   h: await prisma.pointsHistory.count() };
  /* …perform the operation… */
  const after  = { p: await prisma.prediction.count(),
                   h: await prisma.pointsHistory.count() };
  console.log(`predictions ${before.p}->${after.p}`, before.p===after.p?"✓":"✗");
  await prisma.$disconnect();
}
run();'
```

### Data-safety invariants to assert on ANY data change
| Invariant | Why |
|---|---|
| `prediction.count()` unchanged | user data must never be touched |
| `pointsHistory.count()` unchanged (unless scoring is the change) | prediction points |
| `fixture.count({status:"COMPLETED"})` unchanged | historical results |
| Leaderboard top-3 identical | scoring integrity |
| Re-running the operation changes nothing | idempotency |

### Dry-run convention for migration scripts
`scripts/fix-schedule.ts` and `scripts/fix-protected-times.ts` are **dry-run by
default** and only write with `--apply`. Follow this pattern for any new
migration script: print every intended change, summarise, then require a flag.

### Browser verification
- **Local:** start the app via the preview tooling, then drive it (navigate,
  click, screenshot, `javascript_exec` for DOM assertions).
- ⚠️ **Known false negative:** the local preview harness reports page-level client
  components as *unhydrated* (`__reactFiber$` missing) even when they work
  correctly in production — reproduced on pre-existing components like
  `AdminNav`. **Do not chase it.** Verify interactivity on the live site instead.
- **Vercel preview deploys are behind SSO** and cannot be driven programmatically.
- Take a **screenshot** for any visual change; several real bugs (transparent
  tooltips, double-toggling checkboxes) were only visible that way.

### Test credentials
| Account | Purpose |
|---|---|
| `admin@opshub.com` | Admin. Password was rotated away from the seed default — **ask the user**. |
| `priya@ / rahul@ / sneha@opshub.com` | Seeded demo users, password `password123` — **only exist on a freshly seeded DB**; they were deleted from production. |

Registration requires an `@opshub.com` address **and** email verification. On a
test branch you can bypass by setting `emailVerified` directly:
```ts
await prisma.user.update({ where:{ email }, data:{ emailVerified: new Date() } });
```

### What to verify per change type
| Change | Verify |
|---|---|
| Scoring / points | Neon branch: award → re-run (idempotent) → edit → re-award; predictions & points counts unchanged |
| Schema | `prisma db push` on a branch first; confirm existing rows survive |
| Bracket / progression | Full cascade Group → Group Final → Grand Final, plus result-edit re-derivation |
| Data migration | Dry run → review every line → apply on branch → assert invariants → apply to prod |
| UI | Build + screenshot in **both dark and light** themes; check mobile width |
| Admin actions | Confirm `requireAdmin()` present; check unauthenticated access doesn't leak data |

---

# 10. Coding Standards

## Component structure
- **Server Components by default.** Add `"use client"` only for interactivity.
- Server components fetch with `Promise.all([...])` and pass plain serializable props.
- Pattern for tabs: render both panels on the server, pass as `ReactNode` props to a small client switcher (`components/tabs.tsx`) — no refetch on switch.

## Reusable components
`components/ui/` — `button, card, badge, input, select, avatar, modal, progress, skeleton, tooltip`.
Shared: `Tabs`, `MatchCard`, `RulesButton` (`floating|card|inline`), `SearchableSelect`, `InfoTip`, `OpsHubLogo`.
**Always check for an existing component before creating one** — e.g. `LeaderboardTabs` was generalised into `Tabs` rather than duplicated.

## API conventions
- **No REST layer.** Mutations = Server Actions in `app/**/actions.ts`.
- Actions bound to `<form action={…}>` **must return `void`** (Next 16 requirement).
  Actions called imperatively from client code may return `{ error }` / `{ success }`.
- Validate with **zod** where input is structured; `requireAdmin()` / `requireUser()` first.
- Call `revalidatePath(path, "layout")` after mutations (`revalidateAll()` helper).

## State management
No global store. Server state via RSC + `revalidatePath`; local UI state via
`useState`/`useTransition`; `router.refresh()` after client-invoked actions.

## UI patterns
Tailwind v4 with CSS variables (`--card`, `--border`, `--primary`…).
⚠️ **`--popover` is NOT defined** — use `bg-card`.
Dark mode via `.dark` class + localStorage. Glassmorphism, Framer Motion,
`animate-in-up` for staggered lists, skeletons in `loading.tsx`, emoji-rich copy.
**Times are always rendered in IST** (`timeZone: "Asia/Kolkata"`).

## Error handling & validation
Actions return `{ error }` or `console.warn` + early return. Import errors
surface as structured `{ errors, warnings, counts }`. Business rules are
re-validated server-side even when the UI prevents them.

## Idempotency (recurring pattern)
Anything recomputable is **delete-then-recreate**, never append:
`evaluateFixture`, `awardTeamPointsForFixture`, `evaluateChampionPredictions`,
`propagateBracket`, `recomputeLeaderboardEntry`.

---

# 11. Future Roadmap

- **Automated test suite (recommended first)** — there is currently none. Highest
  value: unit tests for the pure logic in `lib/scoring.ts` (confidence
  reward/penalty matrix), `lib/bracket.ts` (`parsePlaceholder`), `lib/standings.ts`,
  and `lib/team-points.ts` (`matchTeamByLabel`). These are dependency-free
  functions and would catch the exact class of bug found manually (group matches
  wrongly awarding final points, edit-time bracket re-derivation).
  Suggested: **Vitest** — no framework conflict with Next 16.
- Live score updates during matches (`Fixture.status = LIVE` exists)
- Multiple tournaments / season history (`Tournament` supports it)
- Fantasy team building
- Player & team statistics pages
- Achievements/badges UI (`Achievement`/`UserAchievement` tables exist but unused)
- Real-time leaderboard (websockets/polling)
- Export leaderboard, Hall of Fame, keyboard shortcuts
- Additional bulk actions (venue, court, referee) — `bulkUpdateFixtures` was
  built with a discriminated `action` value so these are a new case, not a refactor
- In-page auth guards on remaining admin pages

---

# 12. Conversation Learnings

## Architectural decisions
- **Fixtures as two generic "sides"** — the single most important decision.
  Discovered from the real Excel that matches are player-vs-player and doubles,
  not team-vs-team. Supports every event type without schema change.
- **Derived vs. persisted:** prediction points are **persisted** (`PointsHistory`)
  for auditability; team win-rate stats are **derived** live. Sports Day team
  points were made **persisted** specifically because the user asked for
  auditable cumulative scores.
- **`side1Source`/`side2Source` added** (a deviation from an approved "no DB
  changes" plan) because testing proved edit-time re-derivation is impossible
  without retaining the placeholder reference. Flagged explicitly to the user.
- **Points as config, not per-fixture** — the user's suggestion, adopted: rules
  keyed by sport+category, synced onto fixtures. More scalable for future events.

## Rejected approaches
- **Radix for everything** — rejected initially (project isn't shadcn-based); later
  adopted **only** `@radix-ui/react-popover` when hand-rolled positioning proved
  insufficient after two attempts.
- **Custom tooltip positioning** — replaced by Radix collision detection.
- **`<label>`-wrapped checkboxes** — caused double-toggle that silently broke bulk
  selection. Now plain rows with `role="checkbox"`.
- **Recharts `<Legend>`** — replaced with a custom legend for layout control.
- **Deleting stale data automatically** — always report, never auto-delete.

## UX decisions
- Logo on a **white chip** because the OpsHub artwork is dark navy on transparency
  and would vanish on the dark theme. Recolouring/inverting would break the brand red.
- Schedule page **public** — nothing sensitive.
- Welcome popup on **every login** (not once ever) at the user's request.
- Rules made "impossible to miss": floating button + fixtures card + home section
  + popup link.
- Confidence shows **live point preview** ("+20 if right · −10 if wrong").

## Important assumptions
- Office runs on **IST**; server runs UTC → always pin the timezone explicitly.
- **Doubles partners always share an office team** — verified: 63 sides, 0 mixed.
- Team-sport labels (`"Team Aniket"`) map to the office team by **owner name**
  with fuzzy tolerance (`"Team Akash"` → `"Aakash & Bhoomi"`).
- Points appear **only on Grand Finals**.
- Re-imports must never clobber predictions or entered results.

## Process learnings
- **Always verify against real data**, not assumptions — row-count guesses about
  "19 new fixtures" turned out to be 19 *incomplete* rows, not new matches.
- **Neon branch copies** are the safe way to test data migrations.
- Several genuine bugs were caught **only** by browser/DB verification
  (double-toggle checkboxes, transparent tooltips, group-match point leakage,
  bracket edit re-derivation). Verify, don't assume.

---

# 13. Current Project Status

## Production snapshot (21 July 2026)
```
Users: 57 (4 admins)   Teams: 4   Players: 79   Sports: 7
Fixtures: 114  → SCHEDULED 84 | LOCKED 5 | COMPLETED 25
Predictions: 1332      PointsHistory: 585     LeaderboardEntries: 44
ChampionPredictions: 6 TeamPointRules: 26     TeamPointsAwards: 0
ResultEdits: 13        Unresolved placeholders: 31
Tournament: "Sports Day 2026", championLock = 21 Jul 2026 20:30 IST
Match dates (IST): 17, 20, 21, 22, 23, 25 July 2026
```

## ✅ Complete
All 9 PRs merged and deployed. Every feature explicitly requested is live:
predictions with confidence risk/reward, tournament winner prediction + admin
controls, schedule, three-tab leaderboard, statistics with tooltips, admin panel
(10 tabs), result editing with audit, automatic bracket progression, bulk fixture
editing, admin prediction insights, Sports Day team points, OpsHub branding.

## 🔄 In progress
Nothing. Working tree clean on `main` at `9cb288c`.

## ⏳ Pending (admin actions, not code)
1. **HIGH — Run bracket progression once** (Admin → Fixtures → ⚡). 25 results are
   in but 31 placeholders remain unresolved; finals can't award points until the
   bracket advances.
2. **MEDIUM — Resolve the 5 unresolved fixtures / add "Joy"** so team stats and
   final awards are complete.
3. **LOW — Decide** whether to correct times on the 25 completed fixtures
   (affects bonus grouping — needs explicit approval).
4. **LOW — Technical debt:** add an automated test suite (§11) and point local
   development at a non-production database (§8).

## Immediate next steps for a new chat
1. Read this document + `AGENTS.md` (Next.js version warning).
2. Confirm current DB state before acting (things change — the app is live).
3. Follow §9 workflow strictly: **analyze → propose → wait for approval → branch →
   test → PR → user merges → deploy**.
4. Remind the user about the pending bracket-progression run.

## Quick reference
```bash
npm run dev            # dev server
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run db:push        # apply schema
npm run seed           # seed admin + demo users
npm run import -- <xlsx…>   # CLI Excel import
npx vercel --prod      # deploy (after merging to main)
```
- Live: https://sports-prediction-league.vercel.app
- Repo: https://github.com/mahipat303/sports-prediction-league
- Neon project: `calm-band-52307994`
- Admin login: `admin@opshub.com` (password rotated — ask the user)

---

# 14. Code Navigation Map

**Where things live.** Use this instead of grepping blind.

## `src/lib/` — all business logic
| File | Purpose | Key exports |
|---|---|---|
| `prisma.ts` | Prisma singleton | `prisma` |
| `auth.ts` | NextAuth config + guards. Domain restriction & `emailVerified` check live in `authorize()` / `signIn` callback | `requireUser`, `requireAdmin` |
| `scoring.ts` | **Prediction points engine.** Confidence multipliers/penalties, fixture evaluation, daily bonuses, leaderboard recompute, champion bonuses, auto-locking | `DEFAULT_SETTINGS`, `getSettings`, `evaluateFixture`, `recomputeLeaderboardEntry`, `evaluateChampionPredictions`, `lockDueFixtures`, `scorePreview`, `rulesValuesFrom` |
| `team-points.ts` | **Sports Day team points** (real tournament score) | `awardTeamPointsForFixture`, `recomputeAllTeamPoints`, `getTeamPointStandings`, `seedRulesFromFixtures`, `matchTeamByLabel` |
| `bracket.ts` | **Automatic bracket progression.** Parses placeholder labels, resolves winners recursively | `parsePlaceholder`, `propagateBracket` |
| `fixture-resolution.ts` | Keeps `side1TeamId`/`side2TeamId` snapshots in sync with player→team assignments; retries name matching | `resolveFixtureSides`, `resolvePlayerFixtures`, `reresolveAllFixtures` |
| `fixtures.ts` | Serialises fixtures for `MatchCard` (computes `isOpen`, pick counts, confidence preview) | `getFixtures`, `serializeFixture`, `fixtureInclude` |
| `standings.ts` | Win/loss records (shared by Stats + Leaderboard) | `computeTeamStandings`, `computePlayerStandings` |
| `excel-import.ts` | Workbook detection, IST-safe date parsing, fuzzy player matching, import | `importWorkbook`, `matchPlayer`, `isPlaceholderLabel`, `IST_OFFSET_MIN` |
| `email.ts` | SMTP → Resend → console fallback | `sendEmail`, `generateVerificationCode` |
| `utils.ts` | `cn`, formatting, category/confidence metadata, accuracy | `formatDateTime`, `accuracy`, `CATEGORY_META`, `CONFIDENCE_META` |
| `welcome.ts` | Once-per-login popup flag | `WELCOME_SEEN_KEY`, `resetWelcome` |

## Server Actions
| File | Contains |
|---|---|
| `src/app/actions.ts` | **User** actions: `submitPrediction`, `submitChampionPrediction`, `registerUser`, `verifyEmail`, `resendVerificationCode` |
| `src/app/admin/actions.ts` | **All 25 admin actions** (see §2). Every one calls `requireAdmin()` |

## Notable components
| Component | Notes |
|---|---|
| `match-card.tsx` | The prediction card. **Reused** on `/fixtures`, `/`, `/predictions` — change once, applies everywhere |
| `tabs.tsx` | Shared tab switcher (server-rendered panels passed as props) |
| `rules-button.tsx` | `floating` \| `card` \| `inline` variants — one rules modal everywhere |
| `searchable-select.tsx` | Dependency-free combobox (placeholder resolution) |
| `bulk-fixture-actions.tsx` | Bulk edit; rows use `role="checkbox"` (NOT `<label>` — see §12) |
| `ui/tooltip.tsx` | `InfoTip` — Radix Popover based |
| `ui/modal.tsx` | Shared modal (confirmations, rules, welcome) |

## `scripts/` — CLI utilities
| Script | Purpose |
|---|---|
| `import.ts` | `npm run import -- <files>` — same engine as the admin UI |
| `fix-schedule.ts` | One-off: corrected +5:30 times, created 19 Grand Finals. **Dry-run unless `--apply`** |
| `fix-protected-times.ts` | One-off: corrected times on prediction-carrying fixtures. **Dry-run unless `--apply`** |
| `generate-template.ts` | `npm run template` — sample Excel files |

---

# 15. Operational Runbooks

## Deploy to production
```bash
git checkout main && git pull --ff-only origin main
npx vercel --prod                       # schema auto-applies via vercel-build
sleep 60 && npx vercel ls | head -3     # confirm ● Ready
curl -s -o /dev/null -w "%{http_code}" https://sports-prediction-league.vercel.app/
```
Verify a few routes (`/`, `/fixtures`, `/leaderboard`, `/stats`) return 200.
If `Error: fetch failed` appears, it's transient — simply retry.

## Rollback
Vercel keeps every deployment. To revert:
```bash
npx vercel ls                                  # find the previous Ready deployment
npx vercel promote <deployment-url>            # instant rollback
```
⚠️ **Schema changes do NOT roll back** — `prisma db push` is forward-only. Since
all migrations so far have been **additive** (new nullable columns/tables), an
older build keeps working against the newer schema. Never drop a column that a
live build still reads.

## Tournament-day admin sequence
1. **Admin → Fixtures** — confirm today's fixtures have correct times/participants.
2. As each match finishes: **Admin → Results** → pick winner → optional score →
   tick *Upset* if the underdog won → **Save & Score**. This single action:
   scores predictions → awards team points (finals only) → advances the bracket →
   notifies users.
3. Mistake? **Edit Result** on the same page (confirmation dialog + audit trail).
   Everything re-computes idempotently.
4. Placeholders should resolve automatically. If one doesn't, use the searchable
   dropdowns, or **⚡ Run bracket progression**.
5. After the last final: **Admin → Dashboard → Declare champion** to award the
   +50 champion-prediction bonuses.

## Common data fixes
| Situation | Fix |
|---|---|
| A player shows the wrong team | Admin → Players → change team (historical fixtures re-resolve automatically) |
| A side isn't linked to any team | Admin → Players → **🔄 Re-resolve all fixtures** |
| Schedule changed | Admin → Fixtures → edit date/time inline, or select several → **Bulk edit** |
| New Excel received | Diff first (§7), then `npm run import -- <file>`; never clobbers results/predictions |
| Team points look wrong | Admin → Team Points → adjust the rule, or **🔄 Recompute from results** |

## Adding a new sport / category (future events)
1. Import a schedule workbook containing it — the sport is created automatically.
2. **Admin → Team Points** — set winner/runner-up points for each new
   sport+category (rules are auto-seeded from the sheet where present).
3. Placeholders/brackets need no configuration — `bracket.ts` is generic.

---

# 16. Troubleshooting — errors actually hit in this project

| Symptom | Cause | Fix |
|---|---|---|
| `Error: fetch failed` from `vercel --prod` | Transient network | Retry |
| Neon `P1010: User was denied access` | Serverless endpoint waking up | Retry after a few seconds |
| `neonctl` hangs asking for organization | Multiple orgs | Pass `--org-id org-orange-wind-93187218` |
| `neonctl auth` times out (60s) | Browser OAuth window | Sign in to console.neon.tech **first**, then retry — it's one click |
| `cp: ~/Downloads/…: Operation not permitted` | macOS privacy protection; attachment grants expire | Ask the user to copy the file into the project directory |
| `gh repo create` → "Resource not accessible" | Token lacks `repo` scope | `gh auth refresh -h github.com -s repo` |
| Type error: action "not assignable to `void \| Promise<void>`" | Next 16 requires `<form action>` handlers to return `void` | Return nothing; use `console.warn` for validation failures |
| Lint: `react-hooks/purity` / `set-state-in-effect` | Next 16 strict rules — e.g. `Date.now()` during render | Move into `useEffect` + `requestAnimationFrame` |
| Tooltip/popover renders transparent | `--popover` CSS var is **not defined** in `globals.css` | Use `bg-card` / `text-card-foreground` |
| Checkbox click does nothing | `<label>` wrapper double-toggles | Use a `div` with `role="checkbox"` + `onClick` |
| Client component appears "unhydrated" locally | Preview-harness false negative | Verify on production instead (§9.1) |
| Times off by 5h30m | Server-local date parsing on a UTC host | Build instants from explicit IST offset (already fixed in `excel-import.ts`) |

---

# 17. Glossary & Reference Data

## Domain terms
| Term | Meaning |
|---|---|
| **Side** | One competitor in a fixture — a player, a doubles pair, an office team, or a placeholder. Fixtures have `side1`/`side2`, never "home/away" |
| **Placeholder** | A side not yet decided, e.g. `"Winner Group A Match 1"`. `isPlaceholder = true` blocks predictions |
| **Stage** | Round within a bracket: `Group A Initial`, `Group B Initial`, `Group Final`, `Semi Final`, `Initial Match 1/2`, `Grand Final` |
| **Match Category** | Division within a sport, e.g. `Male Singles`, `Mix Double`, `Gold - Female Single` |
| **Upset** | Admin flag meaning the underdog won → correct predictions score off the higher `POINTS_UPSET` base |
| **Champion prediction** | A user's pick of the overall winning office team (+50, separate from match predictions) |
| **Sports Day points** | The **real** tournament score awarded to office teams for winning finals — not prediction points |
| **Purse** | Auction budget (₹60 Cr per team) |
| **Owner pair** | Each office team is named after its two owners, e.g. *Aakash & Bhoomi* |

## Office teams (4)
| Team | Short | Colour | Players |
|---|---|---|---|
| Aakash & Bhoomi | A&B | `#ef4444` red | 15 |
| Abhi & Jayswee | A&J | `#f59e0b` amber | 14 |
| Aniket & Jahnavi | AN&JA | `#3b82f6` blue | 15 |
| Kabir & Rushina | K&R | `#8b5cf6` violet | 15 |

## Sports (7)
♟️ Chess · 🎯 Carrom · 🏅 TT · 🏸 Badminton · 🏏 Cricket · 🏐 Vollyball · 🎾 Pickleball

> Note: **"Vollyball"** and **"TT"** are spelled as in the source Excel. Do **not**
> "correct" them — names are the join key between the workbook and the DB.

## Match categories (15)
`Male Singles`, `Female Singles`, `Male Doubles`, `Male Double`, `Female Double`,
`Mix Double`, `Platinum - Male Singles`, `Platinum - Male Double`,
`Platinum - Mix Double`, `Gold - Male Singles`, `Gold - Male Double`,
`Gold - Female Single`, `Gold - Female Double`, `Semi final`, `Final`

> Both `Male Doubles` **and** `Male Double` exist (Carrom vs Pickleball). This
> inconsistency comes from the Excel; treat category strings as opaque keys.

## Player categories
💎 `PLATINUM` · 🥇 `GOLD` · 🥈 `SILVER` · 🥉 `BRONZE` (unused)

## Key file paths
```
Live URL     https://sports-prediction-league.vercel.app
Repo         github.com/mahipat303/sports-prediction-league
Neon project calm-band-52307994  (org-orange-wind-93187218)
Prod branch  ep-autumn-violet-azfehzto…ap-southeast-1
Excel files  user's ~/Downloads (copy into repo before reading — macOS blocks access)
```
