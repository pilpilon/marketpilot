import { perplexityResearch } from "./perplexity";

/**
 * Researches current trending topics in a given niche/market.
 * Returns empty string on failure (graceful degradation — posts still generate without trending).
 */
export async function researchTrendingTopics(
  niche: string,
  market?: string
): Promise<string> {
  const now = new Date();
  const currentDate = now.toISOString().slice(0, 10);
  const currentYear = now.getFullYear();
  const marketFocus = market === "IL"
    ? "in the Israeli market. Search Hebrew and English sources. Focus on Israeli social media trends, local news, and cultural moments."
    : "globally. Focus on English-language social media trends, viral content, and industry news.";

  const query = `Today is ${currentDate} and the current year is ${currentYear}.

What are the current trending topics, news, and viral conversations in the ${niche} space ${marketFocus}

Focus on the last 7 days. For each trend, provide:
- Topic/trend name
- Brief context (1-2 sentences explaining why it's trending)
- Relevance to ${niche} brands (how a brand could tie into this)

List 5-8 trending topics. Be specific — name actual events, posts, or conversations, not generic themes.

Temporal accuracy rules:
- Do not present past events from earlier years as current/upcoming.
- Reject stale examples like Euro 2024 / יורו 2024 when the current year is ${currentYear}.
- If an event is current/upcoming, include its year explicitly.`;

  try {
    return await perplexityResearch(query);
  } catch {
    // Graceful degradation — trending is optional
    return "";
  }
}
