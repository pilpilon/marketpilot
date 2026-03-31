import { perplexityResearch } from "./perplexity";

/**
 * Researches current trending topics in a given niche/market.
 * Returns empty string on failure (graceful degradation — posts still generate without trending).
 */
export async function researchTrendingTopics(
  niche: string,
  market?: string
): Promise<string> {
  const marketFocus = market === "IL"
    ? "in the Israeli market. Search Hebrew and English sources. Focus on Israeli social media trends, local news, and cultural moments."
    : "globally. Focus on English-language social media trends, viral content, and industry news.";

  const query = `What are the current trending topics, news, and viral conversations in the ${niche} space ${marketFocus}

Focus on the last 7 days. For each trend, provide:
- Topic/trend name
- Brief context (1-2 sentences explaining why it's trending)
- Relevance to ${niche} brands (how a brand could tie into this)

List 5-8 trending topics. Be specific — name actual events, posts, or conversations, not generic themes.`;

  try {
    return await perplexityResearch(query);
  } catch {
    // Graceful degradation — trending is optional
    return "";
  }
}
