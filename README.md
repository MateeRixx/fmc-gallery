# FMC Gallery
Digital media gallery for Film & Media Club built with Next.js (App Router), Supabase auth/storage, and Tailwind.

## Quick start
1) Install dependencies: `npm install`
2) Copy `.env.example` (if present) or create `.env.local` with:
	- `NEXT_PUBLIC_SUPABASE_URL=`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
	- `SUPABASE_SERVICE_ROLE_KEY=` (server-only; used for admin APIs)
3) Run the dev server: `npm run dev` then open http://localhost:3000

## Notes
- Remote images are allowed from `images.unsplash.com` and any `*.supabase.co` bucket (see `next.config.js`).
- Admin routes use the service-role key on the server; never expose it to the client or commit it.
- Incremental TypeScript builds may generate `tsconfig.tsbuildinfo`; you can ignore or delete it locally.
