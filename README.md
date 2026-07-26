# TeleGallery

A Google-Photos-style web app that stores your photos, videos, and documents in
**your own Telegram account** — via a private channel — instead of on someone else's server.

Authentication uses the real Telegram **MTProto client API** (via [GramJS](https://gram.js.org/)),
not the Bot API, so you sign in with your own phone number the same way the official
Telegram apps do.

---

## Architecture

```
┌─────────────┐        HTTPS/cookies        ┌──────────────┐        MTProto        ┌───────────────────┐
│   Next.js    │  ───────────────────────►   │   Express    │  ───────────────►     │  Telegram servers  │
│  frontend    │  ◄───────────────────────   │   backend    │  ◄───────────────     │  (your account's   │
│ (gallery UI) │        REST JSON            │  (GramJS +   │   files/messages      │  private channel)  │
└─────────────┘                              │   Prisma)    │                       └───────────────────┘
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                             ┌───────────────┐
                                             │  SQL database  │
                                             │ (metadata only,│
                                             │  no file bytes)│
                                             └───────────────┘
```

- **File bytes never touch your server's disk longer than the upload request itself** —
  they're streamed to Telegram and the temp file is deleted immediately after.
- **Only metadata** (filename, size, dimensions, Telegram message id, etc.) is stored in
  your own database, for fast search and listing.
- **Telegram session strings are AES-256-GCM encrypted at rest** using a key you provide.
- Every "channel" reference is addressed by its id **and access hash**, stored together —
  this avoids a well-known GramJS/Telethon pitfall where a freshly reconnected client
  can't resolve an entity from a bare id alone.

---

## Prerequisites

1. **Node.js 20+**
2. A **Telegram API ID and hash** from <https://my.telegram.org> → API Development Tools
3. **Git** and a **GitHub** account (for deployment)

---

## Local development

```bash
git clone <your-repo-url>
cd telegallery
npm install

cp backend/.env.example backend/.env
# Edit backend/.env: set TELEGRAM_API_ID, TELEGRAM_API_HASH, and generate two secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → SESSION_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → JWT_SECRET

npm run prisma:migrate   # creates backend/prisma/dev.db and applies the schema
npm run dev              # runs backend (:4000) and frontend (:3000) together
```

Open <http://localhost:3000>.

### Local development with Docker instead

```bash
cp .env.example .env
cp backend/.env.example backend/.env
# edit both as above
docker compose up --build
```

---

## Pushing this project to GitHub

1. Create a new **empty** repository on <https://github.com/new> (don't initialize it
   with a README/gitignore — this project already has both)
2. In your terminal, at the project root:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. Your `.env` files are already excluded via `.gitignore` — double check none of your
   secrets show up on GitHub after pushing (look for `backend/.env` — it should NOT
   appear in the repo, only `backend/.env.example` should).

---

## Deploying for free

This deploys the **frontend to Vercel** and the **backend to Render**, both of which have
free tiers, plus a **free Postgres database on Neon** (SQLite's local file doesn't
survive redeploys on most free hosts, so a real hosted database is needed for production).

### Step 1 — Create a free Postgres database (Neon)

1. Go to <https://neon.tech> → sign up free → create a new project
2. Copy the **connection string** it gives you (starts with `postgresql://...`)

### Step 2 — Switch the schema to Postgres and generate fresh migrations

SQLite and Postgres migrations aren't interchangeable, so:

```bash
cd backend
```
Open `prisma/schema.prisma` and change:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
to:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Then delete the old SQLite-based migrations and generate new Postgres ones against your
Neon database:
```bash
rm -rf prisma/migrations
```
Temporarily set `DATABASE_URL` in `backend/.env` to your Neon connection string, then:
```bash
npx prisma migrate dev --name init
```
This creates fresh Postgres migration files and applies them to your Neon database.
Commit these new migration files:
```bash
cd ..
git add .
git commit -m "Switch to Postgres for deployment"
git push
```

From this point on, your local dev environment will also use this same Neon database
(simplest option for a small project) — you can always switch back to a local SQLite
file later by reverting `schema.prisma` and `DATABASE_URL`.

### Step 3 — Deploy the backend to Render

1. Go to <https://render.com> → sign up free → **New +** → **Web Service**
2. Connect your GitHub repo
3. Set:
   - **Root Directory**: `backend`
   - **Environment**: Docker (it will pick up `backend/Dockerfile` automatically)
   - **Instance Type**: Free
4. Add these **Environment Variables** (Render dashboard → Environment):
   ```
   TELEGRAM_API_ID=<your value>
   TELEGRAM_API_HASH=<your value>
   DATABASE_URL=<your Neon connection string>
   SESSION_ENCRYPTION_KEY=<your generated key>
   JWT_SECRET=<your generated key>
   NODE_ENV=production
   COOKIE_NAME=telegallery_session
   CORS_ORIGIN=<leave a placeholder for now, e.g. http://localhost:3000 — you'll update this in Step 5>
   UPLOAD_TMP_DIR=/tmp/telegallery-uploads
   MAX_UPLOAD_SIZE_MB=500
   STORAGE_CHANNEL_TITLE=TeleGallery Storage
   ```
5. Click **Create Web Service**. Wait for the build to finish, then copy the URL Render
   gives you (something like `https://telegallery-backend.onrender.com`)

**Note on Render's free tier:** the service sleeps after 15 minutes of no traffic and
takes ~30–60 seconds to wake up on the next request. That's normal for the free tier.

### Step 4 — Deploy the frontend to Vercel

1. Go to <https://vercel.com> → sign up free → **Add New** → **Project**
2. Import the same GitHub repo
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)
4. Add an **Environment Variable**:
   ```
   NEXT_PUBLIC_API_URL=https://telegallery-backend.onrender.com
   ```
   (use the exact Render URL from Step 3)
5. Click **Deploy**. Copy the URL Vercel gives you (something like
   `https://telegallery-yourname.vercel.app`)

### Step 5 — Connect the two

Go back to Render → your backend service → Environment → update:
```
CORS_ORIGIN=https://telegallery-yourname.vercel.app
```
(use your exact Vercel URL, no trailing slash). Save — Render will redeploy automatically.

### Step 6 — Try it

Open your Vercel URL. Log in with your phone number as before. Your site is now live and
free, backed by your own Telegram account for storage.

---

## What's implemented vs. scaffolded

**Fully implemented, real code:**
- Full MTProto login flow: phone → OTP → optional 2FA (SRP password), encrypted session storage
- Automatic creation/detection of the private "TeleGallery Storage" channel, addressed
  reliably via stored id + access hash
- Upload pipeline: SHA-256 duplicate detection, image/video metadata extraction, automatic
  thumbnail generation, both original and thumbnail sent to your Telegram channel
- Download/thumbnail proxy endpoints, streaming bytes back from Telegram on demand
- Search & filtering, pagination, favorites, trash with restore, permanent delete
- Virtual albums — create, delete, view detail, add files, remove files (all wired end-to-end
  in both the API and the UI)
- Dashboard statistics, settings (theme, accent color, upload quality)
- Security middleware: Helmet (with cross-origin resource policy configured for a
  separate frontend origin), CORS, three-tier rate limiting, JWT session cookies
  (SameSite=None+Secure in production for cross-domain auth), input validation,
  centralized error handling, logging
- Full dashboard UI: sidebar navigation, responsive masonry gallery, drag-and-drop
  upload with live progress, lightbox with keyboard navigation, bulk selection,
  dedicated Videos/Documents/Favorites/Trash/Albums/Statistics/Settings pages
- Docker Compose for local backend + frontend

**Scaffolded / intentionally left for you to extend:**
- EXIF metadata panel, histogram, and image rotate/pan tools in the viewer
- Tag system UI (the `Tag`/`FileTag` DB tables already exist; only the UI is missing)
- Calendar/timeline/month/year views (data is already queryable by date)
- PWA manifest/service worker, offline cache
- Drag-and-drop album re-organization UI
- Automated tests

---

## Folder structure

```
telegallery/
├── backend/
│   ├── src/
│   │   ├── config/        # env loading/validation
│   │   ├── telegram/      # GramJS auth, channel, upload/download services
│   │   ├── routes/        # auth, files, albums, stats, settings
│   │   ├── middleware/    # auth guard, rate limiting, error handling, multer
│   │   ├── types/         # app-level constants (e.g. FileKind — see note below)
│   │   └── utils/         # crypto (session encryption), logger, media metadata
│   ├── prisma/schema.prisma
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js App Router pages (login, dashboard/*)
│   │   ├── components/    # Sidebar, MasonryGallery, Lightbox, UploadDropzone
│   │   ├── hooks/         # useAuth, useFiles
│   │   └── lib/           # typed API client, formatters
│   └── Dockerfile
├── docs/API.md
├── docker-compose.yml
└── package.json           # npm workspaces root
```

**Why `src/types/fileKind.ts` exists instead of a Prisma enum:** Prisma doesn't generate
a runtime JS object for `enum` types on SQLite (only Postgres/MySQL get that), so a
Prisma-enum-based `FileKind` would be `undefined` at runtime on SQLite. `kind` is stored
as a plain string column, validated against this local constant instead — this also means
it keeps working identically whether you're on SQLite locally or Postgres in production.

---

## Security notes

- Telegram session strings are encrypted with AES-256-GCM before they ever touch the
  database — generate `SESSION_ENCRYPTION_KEY` yourself and keep it secret.
- Auth cookies are `httpOnly`; in production they're also `Secure` + `SameSite=None`
  (required since the frontend and backend live on different domains) and in local dev
  `SameSite=Lax` (sufficient since both run on `localhost`, just different ports).
- Rate limiting is tiered: stricter on `/auth/*`, looser for general reads, moderate for uploads.
- Never commit `backend/.env` or `.env` — both are already in `.gitignore`.

## Known limitations

- The pending-login registry (between OTP send and verify) is in-memory — fine for a
  single instance; a multi-instance deployment would need a shared store (e.g. Redis)
  or sticky sessions for the ~2-minute login window.
- One live GramJS connection is opened per authenticated request and closed afterward;
  for high traffic, a small connection pool would be more efficient (see the comment in
  `backend/src/telegram/sessionClient.ts`).
- Render's free tier sleeps after inactivity — the first request after idling will be slow.
