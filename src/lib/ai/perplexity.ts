import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Shared Perplexity Sonar client for web research.
 * Falls back to Gemini (training data only, no live search) when Perplexity key is unavailable.
 */
export async function perplexityResearch(query: string): Promise<string> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (perplexityKey) {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a marketing research analyst. Provide detailed, structured research findings. Be specific with data, market positions, and insights.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content as string;
    }
    // Fall through to Gemini on Perplexity error
  }

  // Gemini fallback (uses training data, no live web search)
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(
    `You are a marketing research analyst with deep knowledge of competitive markets. ${query}\n\nProvide detailed, structured findings based on your knowledge. Be specific about market dynamics, positioning, and insights.`
  );
  return result.response.text().trim();
}
