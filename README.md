# The Leadership Letter

Blog + daily newsletter that publishes real internal corporate correspondence with Claude-generated leadership lessons.

See `CHARTER.md` for editorial constitution, `SOURCES.md` for the source registry, and `WATCHLIST.md` for monitored dockets / companies / leaders.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Prisma + Postgres (Neon)
- Anthropic Claude API (Sonnet 4.6 + Opus 4.7)
- Beehiiv (newsletter + monetization)
- Vercel (deploy + cron + blob storage)

## Local Development
```bash
npm install
cp .env.example .env
# Fill in DATABASE_URL and ANTHROPIC_API_KEY
npx prisma migrate dev
npm run dev
```

## Plan
Full implementation plan lives at `C:\Users\risha\.claude\plans\eventual-mixing-dijkstra.md`.
