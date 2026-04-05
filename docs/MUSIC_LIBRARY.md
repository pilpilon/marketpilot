# Music Library Setup

The Video Creator composes a background music track into every video
based on the project's brand tone. Without music files uploaded, videos
play with Veo's native ambient audio only (which cuts hard at every
scene boundary — worth having music).

## What to upload

Six tracks, one per mood. All should be ~60 seconds and MP3 format.
Upload to the **`music-library`** bucket in Supabase Storage at the
exact paths below.

| Mood | Path | Suggested vibe |
|------|------|----------------|
| energetic | `energetic/morning-rush.mp3` | 120+ BPM, driving drums, workout |
| corporate | `corporate/boardroom.mp3` | 90–100 BPM, clean piano, tech |
| chill | `chill/soft-focus.mp3` | 80–90 BPM, lo-fi, wellness |
| upbeat | `upbeat/sunlit.mp3` | 110–120 BPM, happy, friendly |
| cinematic | `cinematic/rising-horizon.mp3` | 70–80 BPM, build-up, strings |
| minimal | `minimal/glass.mp3` | 95–105 BPM, sparse, modern |

## Where to get royalty-free tracks

All commercially licensable:

- **Pixabay Music** — https://pixabay.com/music/ (no attribution needed)
- **YouTube Audio Library** — https://studio.youtube.com (free, no attribution for most)
- **Uppbeat** — https://uppbeat.io (free tier, attribution required)
- **Artgrid** — https://artgrid.io (paid subscription)

## Upload via Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/ydusfdblkcpswigkeyvm/storage/buckets/music-library
2. Create folders: `energetic/`, `corporate/`, `chill/`, `upbeat/`, `cinematic/`, `minimal/`
3. Upload each MP3 to its matching folder using the filenames above

The bucket is public-read, so no signed URLs needed — the composer
fetches tracks by public URL.

## Verifying

After upload, visit (replace `energetic/morning-rush.mp3` with each path):

```
https://ydusfdblkcpswigkeyvm.supabase.co/storage/v1/object/public/music-library/energetic/morning-rush.mp3
```

If you hear the track in the browser, it's ready.

## Adding more tracks / moods

Edit `src/lib/video/music-library.ts`:
- `TRACK_CATALOG` to add a new track entry
- `inferMoodFromBrand()` to map brand keywords → that mood
- `listAvailableMoods()` to expose it in the Video Creator UI
