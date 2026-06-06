# MarketPilot

AI-powered social media marketing platform for small businesses. Create branded content, schedule posts, and publish across Instagram, Facebook, Twitter/X, and TikTok — with native Hebrew (RTL) support.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Supabase** (Postgres, Auth, Storage)
- **AI**: OpenAI `gpt-image-1` for primary image generation, Gemini fallback/caption support, Perplexity (trend research)
- **i18n**: next-intl (Hebrew default, English supported)
- **Image pipeline**: Takumi (RTL text) + Sharp (compositing)
- **UI**: Tailwind CSS 4 + shadcn/ui
- **Deploy**: Vercel

## Setup

1. Clone the repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the required values
4. `npm run dev` — opens at [http://localhost:3000](http://localhost:3000)

## Scripts

```bash
npm run dev       # Development server
npm run build     # Production build
npm run start     # Production server
npm run lint      # ESLint
```

## Environment Variables

See `.env.example` for the full list. Key required variables:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase access
- `GOOGLE_AI_API_KEY` — Gemini caption/image fallback support
- `OPENAI_API_KEY` — primary ChatGPT/OpenAI image generation
- `IMAGE_PROVIDER` — `openai` by default; set to `gemini` to force Gemini
- `OPENAI_IMAGE_MODEL` — defaults to `gpt-image-1`
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` — Instagram/Facebook OAuth
- `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` — Twitter/X OAuth
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` — TikTok OAuth
- `CRON_SECRET` — Vercel cron job authorization

## Database

Migrations live in `supabase/migrations/`. Apply them via the Supabase dashboard or CLI.

## Deploy

Deployed on Vercel. Push to `master` to trigger a production deploy. Cron jobs are configured in `vercel.json`.
