# Karsus Initiative

A free initiative tracker for theater-of-the-mind D&D combat. The DM runs turns, HP and
conditions from one screen; players follow along on a live, spoiler-free view on a TV or their phones.

**Live:** https://karsusinitiative.com · **Try it without an account:** `/demo`

## Features

- **Turn engine**: initiative order with 5e tiebreaks, round counter, dead creatures skipped automatically.
- **Quick HP**: damage, healing and temp HP in one dialog. Temp HP soaks first, dropping to 0 marks
  monsters dead and PCs unconscious, and concentration save DCs are calculated for you.
- **Timed conditions**: all SRD conditions plus custom effects (Bless, Hex…). They count down at
  the end of the creature's turn and fall off when they expire.
- **Player view**: `/play/<token>`, a cinematic read-only screen with a QR code to share. Monsters
  show a health band (Wounded, Bloodied…), never exact HP or AC, and DM notes are never sent.
- **Dice roller**: `2d6+3`, `4d6kh3`, advantage and disadvantage, and one click to roll initiative
  for every monster.
- **Keyboard first**: Space for the next turn, D damage, H heal, C conditions, J/K to select, ? lists every shortcut.
- **Presets**: save the party or a monster group once; launching one rolls fresh monster initiative.
- **Groups**: "Goblin ×4" with HP `2d6` adds Goblin 1–4, each with its own rolled HP and initiative.

## Stack

Everything runs on Azure, with Cloudflare in front. The only other company involved is Google, and
only for the optional "Continue with Google" sign-in.

| Layer | Choice | Cost |
| ----- | ------ | ---- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, TanStack Query, Motion | |
| Hosting + API | Azure Static Web Apps (Free): the site, plus managed Azure Functions (Node 22) under `/api` | Free |
| Database | Azure Cosmos DB free tier (1000 RU/s, 25 GB), capped so it can't bill | Free |
| Live sync | Azure Web PubSub (Free: 20 live connections, 20k messages a day) | Free |
| Images | Azure Blob Storage | Cents |
| Email | Azure Communication Services, for password reset links only | ~$0.00025 per email |
| Edge | Cloudflare: DNS, TLS, caching, rate limiting | Free |

## How it works

- **One origin.** Static Web Apps serves `dist/` and routes `/api/*` to the Functions in `api/`.
  There's no CORS and nothing secret in the browser.
- **Accounts.** Email + password (scrypt) or Google (OAuth code flow with PKCE, run by the API). The
  session is a signed `HttpOnly`, `SameSite=Lax` cookie. A password reset signs out every other
  device. Ten wrong passwords lock the account for 15 minutes, and Cloudflare rate-limits
  `/api/auth/*` on top.
- **Data.** The Cosmos container `tables` holds one document per encounter or preset with its
  creatures embedded, partitioned by owner. Every write is a compare-and-swap on the document's
  ETag with retries, so two devices editing at once both land. The `directory` container holds
  users, email and Google aliases, share links, and reset tokens (which expire through Cosmos TTL).
- **One turn engine.** `src/lib/combat.ts` runs in the API for real turns and in the browser for
  the instant (optimistic) update and the offline demo, so they can't disagree.
- **Player view.** `/api/play/<token>` returns a redacted snapshot: no DM notes, and monsters show a
  health band instead of HP or AC.
- **Live sync.** After every encounter write the API sends a content-free `changed` ping to that
  encounter's Web PubSub group, and every open screen refetches through its own protected or
  redacted path. Player screens also poll every 30 s as a safety net.
- **Images** are resized and converted to WebP in the browser (portraits ≤ 640 px, backdrops
  ≤ 1920 px), checked by the API, and stored in a public-read Blob container under the uploader's id.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173. The landing page and /demo work without the API.
```

For accounts, run the API next to it. This needs
[Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local)
(`npm i -g azure-functions-core-tools@4`):

```bash
cp api/local.settings.example.json api/local.settings.json
npm run dev:api    # http://localhost:7071, proxied by Vite at /api
```

With `KARSUS_DEV=1` and no `COSMOS_CONNECTION_STRING`, the API keeps data in memory (gone on
restart) and prints reset emails to the terminal. Paste connection strings into
`api/local.settings.json` to use real Azure services instead.

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Vite dev server |
| `npm run dev:api` | Bundles the API and starts it with `func` |
| `npm run build` | Typecheck, build the site to `dist/`, bundle the API to `api/dist/index.js` |
| `npm run typecheck` | `tsc -b` for the site, the config files and the API |
| `npm run lint` | ESLint (typescript-eslint strict + React hooks) |
| `npm test` | Vitest: dice, combat rules and the DM board (jsdom), plus the API's routes, auth and redaction (Node) |

## One-time setup

### 1. Azure resources (about 10 minutes)

`infra/main.bicep` creates everything: the Static Web App, Cosmos DB, Storage, Web PubSub,
Communication Services, and the app settings that wire them together.

```bash
az login
az group create -n karsus -l westeurope
az deployment group create -g karsus -f infra/main.bicep \
  -p sessionSecret="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")" \
  -p googleClientId="<client id>" googleClientSecret="<client secret>"   # optional, see step 4
```

The outputs include `staticWebAppName` and `staticWebAppHostname`.

- **Cosmos DB free tier** is limited to one account per subscription. If the deployment says it's
  taken, delete the other free-tier account first. Deploying with `cosmosFreeTier=false` would bill
  for 1000 RU/s.
- **To change app settings later**, go to the Azure portal → the Static Web App → Environment
  variables. `api/src/config.ts` lists what the API reads.

### 2. Deploys from GitHub

```bash
az staticwebapp secrets list -n <staticWebAppName> -g karsus --query properties.apiKey -o tsv
```

Save that as the repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. Every push to `main` then
typechecks, lints, runs the tests, builds, and uploads the site and the API
(`.github/workflows/deploy.yml`). Pull requests run the checks without deploying.

### 3. Cloudflare → karsusinitiative.com

1. In the Azure portal, open the Static Web App → **Custom domains → Add → Custom domain on other
   DNS**, enter `karsusinitiative.com` and pick **TXT** validation. Add the TXT record it shows in
   Cloudflare DNS.
2. In Cloudflare DNS, remove the old GitHub Pages `A` records (`185.199.x.x`) and any old
   `*.azurestaticapps.net` CNAME, then add:

   | Type  | Name  | Content                  | Proxy              |
   | ----- | ----- | ------------------------ | ------------------ |
   | CNAME | `@`   | `<staticWebAppHostname>` | DNS only, at first |
   | CNAME | `www` | `<staticWebAppHostname>` | DNS only, at first |

   Cloudflare flattens the apex CNAME. Add `www.karsusinitiative.com` as a second custom domain in
   Azure too (CNAME validation).
3. Once Azure shows both domains as **Ready**, switch the records to **Proxied**, then set
   **SSL/TLS → Full (strict)** and turn on **Always Use HTTPS**.
4. **Security → WAF → Rate limiting rules** (the free plan includes one): when *URI Path starts
   with* `/api/auth/`, allow 20 requests per 10 seconds per IP, then block.

Caching needs no rules: hashed files under `/assets/` are served as immutable, and the API sends
`no-store`. Live-sync sockets go straight to `*.webpubsub.azure.com`, not through Cloudflare.

### 4. Google sign-in (optional)

In Google Cloud Console, go to **APIs & Services → Credentials → Create OAuth client (Web)** and add
these authorized redirect URIs:

- `https://karsusinitiative.com/api/auth/google/callback`
- `http://localhost:5173/api/auth/google/callback` (local development)

Pass the client ID and secret to the deployment (step 1), or set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in the Static Web App's environment variables. Without them the button
doesn't appear. You can reuse your old Google client if you add these redirect URIs to it.

### 5. Shut down the old Azure deployment

Once the new site is live on the domain, delete the old resource group (Static Web App on the
Standard plan, Cosmos DB, Storage, Key Vault, Web PubSub) so it stops billing. The new deployment
runs on the Free plan; nothing here needs Standard.

## Free-tier notes

- **Web PubSub Free** allows 20 connections at once, about two or three tables with a TV and a few
  phones each. Past that, extra screens still update through their 30-second refresh.
- **Managed Functions on the Free plan** sleep when idle, so the first request after a quiet spell
  can take a few seconds.
- **Cosmos DB** is capped at the free 1000 RU/s in the template, so a traffic spike slows requests
  down rather than adding to the bill.

## Project layout

```
src/                        the site
  app/router.tsx            routes; every page is lazy-loaded
  pages/                    one file per route
  features/
    auth/                   session provider + route guard
    combat/                 DM board, HP / conditions / creature dialogs, shortcuts
    encounters/, presets/   TanStack Query hooks (optimistic writes, live-sync listener) + forms
    play/                   the player / TV view
    dice/                   dice roller panel
    demo/                   offline demo store (localStorage + BroadcastChannel)
  lib/
    api.ts                  fetch wrapper for /api
    combat.ts               the turn engine, shared with the API (unit tested)
    dice.ts                 notation parser + unbiased crypto roller (unit tested)
    types.ts                the data contract, shared with the API
  components/ui/            buttons, fields, native <dialog>, avatars, HP bars…
  styles/index.css          design tokens (OKLCH)
api/                        Azure Functions, deployed as the Static Web App's managed API
  src/routes/               auth, encounters, presets, player view, images
  src/domain/               validation and pure encounter/preset operations
  src/store/                Cosmos DB store + in-memory store (tests, local dev)
  src/auth/                 sessions, scrypt passwords, Google OAuth
  src/*.test.ts             route tests against the in-memory store
infra/main.bicep            every Azure resource
public/staticwebapp.config.json   SPA fallback, security headers, caching
```
