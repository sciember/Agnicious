## Habit Tracker Pro (MVP Starter)

Modern SaaS-ready habit tracker built with Next.js App Router, Prisma/Postgres, NextAuth, and Tailwind.

### Tech Stack

- Next.js 16 + React 19
- Prisma ORM + PostgreSQL
- NextAuth (Google OAuth + Email/Password)
- Tailwind CSS (dark modern dashboard)
- Recharts-ready analytics surfaces
- AI coach endpoint scaffold (Groq-ready)

### Included MVP

- Habit CRUD (`/api/habits`, `/api/habits/:id`)
- Daily habit logs (`/api/logs`)
- Streak + XP update logic
- Overview + life score stats APIs
- Leaderboard + social feed APIs
- Dashboard, habits, calendar, analytics, social, AI coach screens
- Protected app routes via middleware

### Setup

1. Copy env file:
   - `cp .env.example .env` (or manually create `.env` on Windows)
2. Fill required values in `.env`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. Run migrations:
   - `npm run prisma:migrate`
5. Start app:
   - `npm run dev`

### Important Routes

- UI:
  - `/` landing
  - `/sign-in`
  - `/dashboard`
  - `/habits`
  - `/calendar`
  - `/analytics`
  - `/social`
  - `/ai-coach`
- API:
  - `/api/auth/[...nextauth]`
  - `/api/habits`
  - `/api/logs`
  - `/api/stats/overview`
  - `/api/stats/life-score`
  - `/api/leaderboard`
  - `/api/social/feed`
  - `/api/ai/coach`

### Deployment (Vercel)

1. Push repo to GitHub
2. Import into Vercel
3. Add all env vars from `.env.example`
4. Set build command: `npm run build`
5. Set install command: `npm install`
6. Run migrations against production database before first launch
