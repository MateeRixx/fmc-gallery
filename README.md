# FMC Gallery

A production-deployed photo management platform for RGIPT's Film & Media Club — built with Next.js App Router, Supabase (PostgreSQL + Storage), and TypeScript. Handles bulk image uploads, admin-controlled event management, and a responsive masonry gallery served to real users.

🔗 **Live:** [fmc-rgipt.in](https://www.fmc-rgipt.in/) &nbsp;|&nbsp; **Stack:** Next.js · TypeScript · Supabase · Tailwind CSS · Vercel

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Storage-green?style=flat&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat&logo=tailwind-css)

---

## Technical Highlights

- **Client-side image compression pipeline** — browser-image-compression enforces a 1.5MB / 1920px cap before upload, reducing Supabase Storage bandwidth and keeping gallery load times fast on mobile
- **Row Level Security (RLS)** — public read access on `events` and `photos` tables; write operations restricted to service-role key server-side, never exposed to the client
- **Bulk ZIP download** — JSZip streams selected images client-side without a backend roundtrip, keeping download latency low regardless of selection size
- **Slug-based routing** — event pages use custom slugs (`/events/[slug]`) for clean URLs and SEO-friendly sharing
- **Masonry layout** — pure CSS multi-column layout with Framer Motion entrance animations, no third-party grid library

---

## Architecture

```
Browser
  │
  ├── Next.js App Router (Vercel Edge)
  │     ├── /                  → Homepage with Swiper carousel
  │     ├── /events/[slug]     → Masonry gallery + bulk download
  │     ├── /admin             → Event CRUD (protected)
  │     ├── /login             → Admin auth
  │     └── /api/upload        → Server-side upload handler
  │
  └── Supabase
        ├── PostgreSQL
        │     ├── events (id, title, slug, cover_url, hero_image_url, is_public)
        │     └── photos (id, event_slug, url, created_at)
        └── Storage
              └── gallery-images (public bucket)
```

---

## Features

**Gallery**
- Masonry (Pinterest-style) responsive layout
- Swiper-based event carousel with custom SVG navigation
- Framer Motion page transitions and image entrance animations
- Select + bulk download as ZIP (client-side, no server roundtrip)

**Admin Panel**
- Event creation with slug, description, cover image, hero image
- Bulk image upload with automatic compression (1.5MB / 1920px)
- Edit and delete events
- Real-time gallery refresh post-upload

**Auth & Security**
- Secure admin login — service-role key used only in server-side API routes
- Supabase RLS policies enforce public read / restricted write

---



## Getting Started

**Prerequisites:** Node.js 18+, Supabase project

```bash
git clone https://github.com/MateeRixx/fmc-gallery.git
cd fmc-gallery
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Run the tables above in your Supabase SQL editor, create a public `gallery-images` storage bucket, then:

```bash
npm run dev
# → http://localhost:3000
```

**Deploy:** Import to [Vercel](https://vercel.com), add the three env vars, deploy.

---

## Project Structure

```
src/
├── app/
│   ├── admin/          # Event CRUD, protected routes
│   ├── events/[slug]/  # Per-event masonry gallery
│   ├── login/          # Admin authentication
│   ├── api/upload/     # Server-side Supabase upload handler
│   └── page.tsx        # Homepage + event carousel
├── components/
│   ├── AdminForm.tsx
│   ├── EventCard.tsx
│   ├── Navbar.tsx
│   └── AddPhotoButton.tsx
└── lib/
    ├── supabase.ts     # Client + server Supabase instances
    └── events.ts       # Event fetch utilities
```

---



## License

MIT — see [LICENSE](LICENSE)
