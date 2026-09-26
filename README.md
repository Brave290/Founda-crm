# Founda CRM

ChatGPT-style persistent workspace for opencode agents.

## Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Supabase (Auth, PostgreSQL, RLS)
- **AI Engine**: opencode SDK (free built-in agents)
- **Mobile**: Capacitor (com.hx.foundacrm)
- **Deploy**: Vercel

## Quick Start

```bash
npm install
cp .env.example .env.local  # fill Supabase values
npm run dev
```

## Supabase Setup

1. Create project at supabase.com
2. Run `supabase/schema.sql` in SQL Editor
3. Copy URL + anon key to `.env.local`

## Deploy

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOU/founda-crm.git
git push -u origin main
# Import in Vercel → set env vars → Deploy
```

## Mobile (Capacitor)

```bash
npm run export
npx cap init "Founda CRM" com.hx.foundacrm --web-dir out
npx cap add android
npx cap add ios
npx cap sync
npx cap open android   # Build APK
npx cap open ios       # Build iOS
```

## Features

- Glassmorphism dark UI with animations
- Free opencode agents (Build, Plan, General, Explore)
- Voice input, image upload, chat buttons
- Usage tracking: tokens, daily limits, countdown
- Guest mode (no account, no memory stored)
- Session export/import (JSON)
- MCP server connections
- External API key management
- Supabase auth with RLS
- PWA + APK + iOS installable
## Releases

Tagged releases ship a source zip on the [Releases page](https://github.com/Brave290/Founda-crm/releases) (currently **v0.1.0**).
