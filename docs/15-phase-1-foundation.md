# Phase 1 Foundation

## Delivered

- npm workspaces for web and worker processes;
- Next.js 16 mobile-first PWA shell;
- English/Urdu typography and RTL-ready utility;
- mobile bottom navigation and desktop header;
- Supabase SSR clients and PKCE callback;
- email magic-link authentication scaffold;
- protected profile page;
- PostgreSQL profile, roles and audit foundation;
- initial row-level security;
- worker process scaffold;
- Docker targets for web and worker;
- GitHub Actions validation pipeline;
- security headers and environment templates.

## Required configuration

1. Create a Supabase project.
2. Apply `database/migrations/202607300001_foundation.sql`.
3. Configure the public URL and publishable key.
4. Configure the authentication redirect URL as `/auth/callback`.
5. Copy `.env.example` to `.env.local` for local development.
6. Run `npm install && npm run dev`.

## Next PR

Phase 2 should add the catalogue schema, rights records, content studio, YouTube URL import, collections and PostgreSQL search.
