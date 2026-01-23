# 🎬 FMC Gallery App

A modern, responsive event gallery application for the **Film & Media Club (FMC)** at RGIPT. Built with Next.js, Supabase, and Tailwind CSS, this platform allows club members to showcase their events through beautiful photo galleries.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Latest-green?style=flat&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat&logo=tailwind-css)

## ✨ Features

### 🖼️ Gallery Management
- **Event Creation**: Add events with custom slugs, descriptions, cover images, and hero images
- **Photo Uploads**: Bulk image upload with automatic compression (max 1.5MB, 1920px)
- **Masonry Layout**: Responsive, Pinterest-style gallery display
- **Bulk Download**: Select multiple images and download as ZIP file

### 🎨 User Experience
- **Smooth Animations**: Framer Motion animations throughout
- **Carousel Navigation**: Swiper-based event carousel with custom SVG navigation
- **Responsive Design**: Mobile-first, fully responsive across all devices
- **Dark Theme**: Modern black-and-gold aesthetic

### 🔐 Admin Features
- **Event Management**: Create, edit, and delete events
- **Photo Management**: Upload and organize event photos
- **Authentication**: Secure admin access
- **Real-time Updates**: Instant gallery refresh after uploads

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + Storage)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Image Processing**: browser-image-compression
- **Carousel**: Swiper.js
- **Download**: JSZip
- **Language**: TypeScript

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project

### 1. Clone the repository
```bash
git clone https://github.com/MateeRixx/fmc-gallery.git
cd fmc-gallery-app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

**Where to find these:**
- Go to your Supabase project dashboard
- Navigate to **Settings** → **API**
- Copy the Project URL and keys

### 4. Set up Supabase

#### Create the `events` table:
```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_url TEXT,
  hero_image_url TEXT,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  is_public BOOLEAN DEFAULT true,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (is_public = true);
```

#### Create the `photos` table:
```sql
CREATE TABLE photos (
  id BIGSERIAL PRIMARY KEY,
  event_slug TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photos" ON photos
  FOR SELECT USING (true);
```

#### Set up Supabase Storage:
1. Go to **Storage** in your Supabase dashboard
2. Create a bucket named `gallery-images` (public)
3. Allow public access for read operations

### 5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in **Settings** → **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/MateeRixx/fmc-gallery)

## 📖 Usage

### For Admins

1. **Login**: Navigate to `/login` and enter credentials
2. **Create Event**: Go to `/admin` and fill in event details
3. **Upload Photos**: Visit `/events/[event-slug]` and click the `+` button
4. **Manage Events**: Edit or delete events from the admin panel

### For Viewers

1. **Browse Events**: View all events on the homepage carousel
2. **View Gallery**: Click any event to see its photo gallery
3. **Download Photos**: Click "Download" → Select images → Download as ZIP

## 🗂️ Project Structure

```
fmc-gallery-app/
├── src/
│   ├── app/
│   │   ├── admin/           # Admin panel & event management
│   │   ├── events/          # Event gallery pages
│   │   ├── login/           # Authentication
│   │   ├── api/             # API routes (upload, admin)
│   │   └── page.tsx         # Homepage
│   ├── components/
│   │   ├── AdminForm.tsx    # Event creation form
│   │   ├── EventCard.tsx    # Event card component
│   │   ├── Navbar.tsx       # Navigation bar
│   │   └── AddPhotoButton.tsx
│   └── lib/
│       ├── supabase.ts      # Supabase client configs
│       └── events.ts        # Event utilities
├── public/
│   ├── images/              # Static images
│   └── icons/               # App icons
└── package.json
```

## 🎨 Color Palette

- **Primary**: `#FFBF00` (Gold/Yellow)
- **Background**: `#000000` (Black)
- **Text**: `#FFFFFF` (White)
- **Accents**: Purple (`#9333EA`), Blue, Red

## 🔮 Future Enhancements

- [ ] **Google OAuth**: Replace localStorage auth with Supabase OAuth
- [ ] **Member Management**: Admin panel for managing FMC members
- [ ] **Role-Based Access**: Super Admin, Member, and Viewer roles
- [ ] **Comments**: Allow users to comment on photos
- [ ] **Favorites**: Let users bookmark favorite events
- [ ] **Search**: Search events and photos
- [ ] **Analytics**: Track views and downloads

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Notes

- Remote images are allowed from `images.unsplash.com` and any `*.supabase.co` bucket (see `next.config.js`)
- Admin routes use the service-role key on the server; never expose it to the client or commit it
- Incremental TypeScript builds may generate `tsconfig.tsbuildinfo`; you can ignore or delete it locally

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Film & Media Club, RGIPT
- Supabase for the excellent backend platform
- Vercel for seamless deployment
- The Next.js team for an amazing framework

---

**Made with ❤️ for the Film & Media Club at RGIPT**
