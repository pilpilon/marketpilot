@AGENTS.md

# MarketPilot

AI-powered social media marketing platform for small businesses. Hebrew-first, with English support. Generates branded content, schedules posts, and publishes to social platforms.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database**: Supabase (Postgres + Auth + Storage)
- **AI**: Google Gemini (image gen + captions via 2.5 Flash), Perplexity (research)
- **i18n**: next-intl (cookie-based locale, Hebrew default)
- **Image pipeline**: Takumi v1.0.0-rc.13+ (native RTL text rendering) + Sharp (compositing)
- **UI**: Tailwind CSS 4 + shadcn/ui + Radix
- **Payments**: Paddle (env vars present but not yet integrated in code)
- **Deploy**: Vercel (Hobby plan, cron via vercel.json)

## Directory Layout

```
src/
  app/
    (auth)/          Login, signup pages
    (dashboard)/     Dashboard layout + project pages + settings
    (marketing)/     Landing page route group (empty, uses root page.tsx)
    api/
      ai/            AI endpoints: fill-template, generate-caption, generate-hashtags
      auth/          Supabase auth callback
      campaigns/     CRUD for campaigns
      cron/          publish-scheduled, refresh-tokens, monitor-comments
      data-deletion/ Facebook data deletion callback
      posts/         CRUD + publish + calendar endpoints
      projects/      CRUD + analyze + context + campaigns
      skills/        content-calendar, creative-designer, template-render
      social/        OAuth connect/callback/disconnect, accounts list
  components/
    calendar/        Content calendar view
    campaigns/       Campaign list, asset cards, platform preview
    compose/         Post editor, AI assist panel, platform preview
    dashboard/       Project cards
    layout/          App sidebar
    social/          Connect button, account cards, platform icons
    templates/       Template selector, customizer, overlay preview, carousel
    ui/              shadcn primitives (button, card, dialog, etc.)
  hooks/             use-mobile
  i18n/              next-intl request config
  lib/
    ai/              Context builder, locale context, Perplexity client, SOP/storytelling prompts
    payments/        (exists but unused)
    skills/          creative-designer, schedule-builder logic
    social/          OAuth flows, platform publishers (IG, FB, Twitter, TikTok), token manager
    supabase/        Client, server, middleware helpers
    templates/       Overlay registry, compositor, renderer, brand tokens, dimensions, prompt-builder, render-template-image (shared renderer)
  messages/          en.json, he.json (i18n translation files)
  middleware.ts      Supabase auth + next-intl locale
  types/             database.ts, templates.ts
supabase/
  migrations/        00001–00006 (core, social, settings, attachments, templates, facebook/brand_urls)
public/
  templates/         Overlay thumbnail images
  sw.js              Service worker (PWA)
  manifest.json      PWA manifest
```

## Quick Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

## Environment Variables

Required (used in source code):
```
NEXT_PUBLIC_SUPABASE_URL       Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  Supabase anon key
SUPABASE_SERVICE_ROLE_KEY      Supabase service role key
GOOGLE_AI_API_KEY              Gemini API key (image gen + fill-template)
PERPLEXITY_API_KEY             Perplexity API key (trending research)
FACEBOOK_APP_ID                Facebook OAuth app ID
FACEBOOK_APP_SECRET            Facebook OAuth app secret
TWITTER_CLIENT_ID              Twitter/X OAuth client ID
TWITTER_CLIENT_SECRET          Twitter/X OAuth client secret
TIKTOK_CLIENT_KEY              TikTok OAuth client key
TIKTOK_CLIENT_SECRET           TikTok OAuth client secret
CRON_SECRET                    Vercel cron authorization secret
NEXT_PUBLIC_APP_URL            App base URL (default: http://localhost:3000)
```

Not yet used in code (in .env.example only):
```
ANTHROPIC_API_KEY              Reserved for future Claude API integration
IMAGEKIT_*                     Reserved for future image CDN
PADDLE_*                       Reserved for future billing integration
```

## Architecture Notes

### Content Pipeline
1. User creates a project with brand context (text + attachments)
2. AI skills generate content: **Content Calendar** (batch schedule) and **Creative Designer** (images)
3. Templates apply text overlays via Takumi (RTL-native) + Sharp compositor
4. Posts are scheduled in the content calendar and published via cron or manual trigger

### Social Platform Integration
- OAuth connect flow: `/api/social/connect/[platform]` → platform OAuth → `/api/social/callback/[platform]`
- Supported platforms: Instagram, Facebook, Twitter/X, TikTok
- Token refresh via daily cron (`/api/cron/refresh-tokens`)
- Publishing via `/api/posts/[id]/publish` → platform-specific publisher

### Facebook Multi-Page Publishing
- One Facebook user account is shared across all projects (same OAuth token)
- The callback stores the **user profile** (not a specific Page) — keeps the connect flow simple and reliable
- **Page routing happens at publish time**: `FacebookClient.resolvePage()` calls `/me/accounts`, then matches page name against project name (e.g., "Bestrestapp" project → "Bestrestapp" page)
- Both Facebook and Instagram OAuth require `business_management` scope — without it, `/me/accounts` returns empty after app re-authorization
- **Never remove the Facebook app from Facebook Settings** — re-authorization doesn't reliably restore page permissions. If needed, disconnect and reconnect from MarketPilot instead

### Template System
- 7 overlay styles: centered, split_layout, gradient_overlay, corner, boxed_badge, bottom_bar, full_overlay
- Shared renderer: `renderTemplateImage()` in `src/lib/templates/render-template-image.ts` — used by both Content Calendar and Creative Designer template mode
- Pipeline: AI generates background image (via `prompt-builder.ts`, field text excluded to prevent Gemini baking text into backgrounds) → Takumi renders RTL text overlay → Sharp composites final
- Template customizer UI for adjusting text, colors, fonts per-slide
- RTL detection: `detectDirection()` in overlays auto-detects Hebrew/Arabic and sets `direction: rtl` + `textAlign: right`

### Cron Jobs (vercel.json)
- `publish-scheduled` — daily at midnight UTC (also via pg_cron every 5 min on Supabase)
- `refresh-tokens` — daily at 1 AM UTC
- `monitor-comments` — daily at 2 AM UTC

### i18n
- Cookie-based locale detection via next-intl
- Translation files: `src/messages/en.json`, `src/messages/he.json`
- Server components: `getTranslations()` / Client components: `useTranslations()`
- RTL handled via logical CSS properties (no physical left/right)

### Takumi Rendering (Critical for Overlay Work)
- **Version requirement**: v1.0.0-rc.13+ — RTL support (`direction`, `textAlign`) was added in PR #414 (April 2026). Older versions silently ignore these properties.
- **RTL alignment**: Use `direction: "rtl"` + `textAlign: "right"` on block-level text divs. Both properties are required.
- **No flex wrappers on text**: Do NOT wrap text in `display: "flex"` containers — flex items shrink to content width, making `textAlign` ineffective. Use plain block divs.
- **Padding shorthand**: Use individual `paddingTop`/`paddingBottom`/`paddingLeft`/`paddingRight` — shorthand is unreliable.
- **Avoid `overflow: hidden`**: Use inner wrappers with explicit `width` instead.
- **Font loading**: Fonts (Inter + Heebo) are loaded once at module scope and cached across renders.
- **Background images**: `renderTemplateImage()` sends only the visual scene description to Gemini, NOT the Hebrew headline/subheadline text, to prevent Gemini from rendering words into the background.
