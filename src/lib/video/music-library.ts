/**
 * Music library — maps brand tone / script mood to a background track URL.
 *
 * Phase 1 ships with a small curated set of placeholder track paths. Upload
 * actual royalty-free MP3s into the `music-library` Supabase Storage bucket
 * at these paths, then the composer will layer them under Veo scenes.
 *
 * Sources (all commercially licensable):
 *   - https://pixabay.com/music/
 *   - https://uppbeat.io/ (free tier)
 *   - YouTube Audio Library
 *
 * Each bucket object must be public-read.
 */

import type { MusicMood } from "./types";

interface MusicTrack {
  id: string;
  mood: MusicMood;
  title: string;
  storagePath: string; // object path inside `music-library` bucket
  durationSeconds: number;
  bpm: number;
}

/**
 * Pre-seeded track catalog. Upload the corresponding files to the
 * `music-library` bucket to activate each track.
 */
const TRACK_CATALOG: MusicTrack[] = [
  {
    id: "energetic-01",
    mood: "energetic",
    title: "Morning Rush",
    storagePath: "energetic/morning-rush.mp3",
    durationSeconds: 60,
    bpm: 128,
  },
  {
    id: "corporate-01",
    mood: "corporate",
    title: "Boardroom",
    storagePath: "corporate/boardroom.mp3",
    durationSeconds: 60,
    bpm: 96,
  },
  {
    id: "chill-01",
    mood: "chill",
    title: "Soft Focus",
    storagePath: "chill/soft-focus.mp3",
    durationSeconds: 60,
    bpm: 84,
  },
  {
    id: "upbeat-01",
    mood: "upbeat",
    title: "Sunlit",
    storagePath: "upbeat/sunlit.mp3",
    durationSeconds: 60,
    bpm: 118,
  },
  {
    id: "cinematic-01",
    mood: "cinematic",
    title: "Rising Horizon",
    storagePath: "cinematic/rising-horizon.mp3",
    durationSeconds: 60,
    bpm: 72,
  },
  {
    id: "minimal-01",
    mood: "minimal",
    title: "Glass",
    storagePath: "minimal/glass.mp3",
    durationSeconds: 60,
    bpm: 100,
  },
];

/** Infer a music mood from brand personality / tone text. */
export function inferMoodFromBrand(brandTone: string): MusicMood {
  const t = (brandTone || "").toLowerCase();
  if (/\b(energetic|dynamic|bold|exciting|action|sport|workout|fitness)\b/.test(t)) {
    return "energetic";
  }
  if (/\b(corporate|professional|enterprise|b2b|saas|business)\b/.test(t)) {
    return "corporate";
  }
  if (/\b(calm|chill|wellness|zen|mindful|spa|peaceful|soft)\b/.test(t)) {
    return "chill";
  }
  if (/\b(fun|playful|cheerful|friendly|happy|warm|bright)\b/.test(t)) {
    return "upbeat";
  }
  if (/\b(cinematic|luxury|premium|dramatic|story|bold)\b/.test(t)) {
    return "cinematic";
  }
  if (/\b(minimal|clean|simple|modern|understated)\b/.test(t)) {
    return "minimal";
  }
  return "upbeat";
}

/** Return a public URL for the mood's music track, or null if unavailable. */
export function getMusicTrackUrl(mood: MusicMood): string | null {
  if (mood === "none") return null;
  const track = TRACK_CATALOG.find((t) => t.mood === mood);
  if (!track) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/music-library/${track.storagePath}`;
}

/** List all available moods with display labels. */
export function listAvailableMoods(): Array<{ mood: MusicMood; label: string }> {
  return [
    { mood: "energetic", label: "Energetic" },
    { mood: "corporate", label: "Corporate" },
    { mood: "chill", label: "Chill" },
    { mood: "upbeat", label: "Upbeat" },
    { mood: "cinematic", label: "Cinematic" },
    { mood: "minimal", label: "Minimal" },
    { mood: "none", label: "No music" },
  ];
}
