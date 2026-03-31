/**
 * Builds locale-aware context strings for research, synthesis, and skill prompts.
 * Returns empty strings when locale is "en" or unset (backward compatible).
 */

export interface ProjectSettings {
  locale?: "en" | "he";
  market?: string;
  language?: string;
  timezone?: string;
}

export function parseProjectSettings(raw: unknown): ProjectSettings {
  if (!raw || typeof raw !== "object") return {};
  return raw as ProjectSettings;
}

interface LocaleContext {
  /** Appended to Perplexity research queries */
  researchContext: string;
  /** Appended to Gemini synthesis prompts */
  synthesisContext: string;
  /** Appended to skill generation prompts */
  skillContext: string;
}

export function buildLocaleContext(settings: ProjectSettings): LocaleContext {
  if (!settings.locale || settings.locale === "en") {
    return { researchContext: "", synthesisContext: "", skillContext: "" };
  }

  if (settings.locale === "he") {
    return {
      researchContext: `
IMPORTANT MARKET CONTEXT:
- This brand operates in the ISRAELI MARKET. Focus your research on Israeli companies, Israeli competitors, and the Israeli consumer landscape.
- Search for Hebrew-language sources and Israeli business directories when possible.
- Key platforms in Israel: Instagram, Facebook, TikTok, WhatsApp (NOT Twitter/X — very low adoption in Israel).
- Consider Israeli cultural context: Jewish holidays, Shabbat timing, military service demographics, startup nation culture.
- The local timezone is Asia/Jerusalem (IST/IDT).`,

      synthesisContext: `
LOCALE INSTRUCTIONS:
- This brand targets the Israeli market and communicates in Hebrew.
- Write all content strategies with Hebrew content in mind (RTL text, Hebrew idioms, local slang where appropriate).
- Reference Israeli cultural touchpoints: Jewish holidays (Rosh Hashana, Pesach, Sukkot, etc.), national events (Independence Day, Memorial Day), and local trends.
- Platform priorities for Israel: Instagram > Facebook > TikTok > WhatsApp. Twitter/X has minimal presence in Israel.
- Israeli audiences value directness, authenticity, and humor. Overly corporate tones tend to underperform.
- Consider Hebrew-specific hashtag strategies (both Hebrew and English hashtags are used in Israel).`,

      skillContext: `
LOCALE & MARKET:
- Target market: Israel. Primary language: Hebrew.
- Write captions and content in Hebrew unless explicitly asked otherwise.
- Use Israeli cultural references and local trends where relevant.
- Optimal posting times (IST): Instagram 12:00-14:00 & 19:00-22:00, Facebook 11:00-13:00 & 18:00-21:00, TikTok 18:00-23:00.
- Include both Hebrew and English hashtags for maximum reach.
- Platform defaults for Israel: Instagram, Facebook, TikTok (NOT Twitter/LinkedIn unless specified).
- Consider Shabbat (Friday evening to Saturday evening) when scheduling — some audiences are offline, others are highly active.`,
    };
  }

  return { researchContext: "", synthesisContext: "", skillContext: "" };
}
