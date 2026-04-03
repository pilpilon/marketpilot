/**
 * Deterministic schedule builder.
 * Computes concrete post time slots based on platforms, time range, locale, and audience timing data.
 */

export type TimeRange = "1_week" | "2_weeks" | "3_weeks" | "1_month";

export interface PostSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (local time)
  platform: string; // e.g. "instagram"
  platformKey: string; // e.g. "instagram_feed"
}

/** Map generic platform name to the default creative designer platform key */
const PLATFORM_KEY_MAP: Record<string, string> = {
  instagram: "instagram_feed",
  facebook: "instagram_feed", // uses same aspect ratio
  tiktok: "tiktok",
  twitter: "twitter",
  linkedin: "linkedin",
};

/** Map format choice to platform key suffix override */
const FORMAT_SUFFIX_MAP: Record<string, Record<string, string>> = {
  feed: { instagram: "instagram_feed", facebook: "instagram_feed" },
  square: { instagram: "instagram_square", facebook: "instagram_square", linkedin: "linkedin", twitter: "twitter_square" },
  story: { instagram: "instagram_story", facebook: "instagram_story", tiktok: "tiktok" },
};

/** Posts per week per platform */
const POSTS_PER_WEEK: Record<string, number> = {
  instagram: 4,
  facebook: 3,
  tiktok: 4,
  twitter: 5,
  linkedin: 2,
};

/** Optimal posting time windows per platform per locale */
const OPTIMAL_TIMES: Record<string, Record<string, Array<[number, number]>>> = {
  he: {
    instagram: [[12, 14], [19, 22]],
    facebook: [[11, 13], [18, 21]],
    tiktok: [[18, 23]],
    twitter: [[12, 14], [19, 21]],
    linkedin: [[8, 10], [17, 18]],
  },
  en: {
    instagram: [[11, 13], [18, 20]],
    facebook: [[10, 12], [17, 19]],
    tiktok: [[17, 21]],
    twitter: [[8, 10], [12, 13]],
    linkedin: [[8, 10], [17, 18]],
  },
};

/** Days in the time range */
const RANGE_DAYS: Record<TimeRange, number> = {
  "1_week": 7,
  "2_weeks": 14,
  "3_weeks": 21,
  "1_month": 28,
};

/** Seeded pseudo-random for deterministic but varied scheduling */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Check if a date+time falls within Shabbat (Friday 16:00 – Saturday 20:00).
 */
function isDuringShabbat(date: Date, hour: number): boolean {
  const day = date.getDay(); // 0=Sun, 5=Fri, 6=Sat
  if (day === 5 && hour >= 16) return true;
  if (day === 6 && hour < 20) return true;
  return false;
}

/**
 * Pick a random time (HH:MM) within the given time windows.
 */
function pickTime(
  windows: Array<[number, number]>,
  rand: () => number
): string {
  // Pick a window weighted by its duration
  const totalHours = windows.reduce((sum, [s, e]) => sum + (e - s), 0);
  let target = rand() * totalHours;
  for (const [start, end] of windows) {
    const duration = end - start;
    if (target < duration) {
      const hour = start + Math.floor(target);
      const minutes = [0, 15, 30, 45];
      const minute = minutes[Math.floor(rand() * minutes.length)];
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
    target -= duration;
  }
  // Fallback to first window
  const hour = windows[0][0];
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Build concrete schedule slots for the content calendar pipeline.
 */
export function buildScheduleSlots(params: {
  platforms: string[];
  timeRange: TimeRange;
  startDate: Date;
  locale: "en" | "he";
  format?: string;
}): PostSlot[] {
  const { platforms, timeRange, startDate, locale, format } = params;
  const totalDays = RANGE_DAYS[timeRange];
  const totalWeeks = totalDays / 7;
  const localeWindows = OPTIMAL_TIMES[locale] || OPTIMAL_TIMES.en;
  const isHebrew = locale === "he";

  // Seed based on startDate for reproducibility
  const seed = startDate.getFullYear() * 10000 + (startDate.getMonth() + 1) * 100 + startDate.getDate();
  const rand = seededRandom(seed);

  const slots: PostSlot[] = [];

  for (const platform of platforms) {
    const postsPerWeek = POSTS_PER_WEEK[platform] || 3;
    const totalPosts = Math.round(postsPerWeek * totalWeeks);
    const windows = localeWindows[platform] || [[10, 12], [17, 19]];
    const platformKey = (format && FORMAT_SUFFIX_MAP[format]?.[platform]) || PLATFORM_KEY_MAP[platform] || "instagram_feed";

    // Distribute posts evenly across the range
    const interval = totalDays / totalPosts;

    for (let i = 0; i < totalPosts; i++) {
      // Offset each post by the interval, add some jitter
      const dayOffset = Math.floor(i * interval + rand() * Math.min(interval * 0.6, 1.5));
      const date = new Date(startDate);
      date.setDate(date.getDate() + Math.min(dayOffset, totalDays - 1));

      const time = pickTime(windows, rand);
      const hour = parseInt(time.split(":")[0], 10);

      // Skip Shabbat for Hebrew locale
      if (isHebrew && isDuringShabbat(date, hour)) {
        // Push to Sunday same time
        const day = date.getDay();
        if (day === 5) {
          date.setDate(date.getDate() + 2); // Friday → Sunday
        } else if (day === 6) {
          date.setDate(date.getDate() + 1); // Saturday → Sunday
        }
      }

      // Don't exceed the time range
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + totalDays);
      if (date >= endDate) continue;

      const dateStr = date.toISOString().split("T")[0];

      slots.push({
        date: dateStr,
        time,
        platform,
        platformKey,
      });
    }
  }

  // Sort chronologically
  slots.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return a.time.localeCompare(b.time);
  });

  return slots;
}
