// src/types/index.ts

export interface Event {
  id: number;
  slug: string;
  title: string;
  description: string;
  cover_url: string;
  hero_image_url?: string | null;
  starts_at?: string;
}

