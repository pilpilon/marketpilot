import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Perplexity Sonar for web research (live search).
 * Falls back to Gemini when Perplexity key is unavailable.
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
  }

  return geminiFallback(query);
}

/**
 * Perplexity for synthesis/generation (no live search needed).
 * Uses sonar model for consistency. Falls back to Gemini.
 */
export async function perplexitySynthesize(prompt: string): Promise<string> {
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
              "You are a senior brand and marketing strategist. Create detailed, actionable marketing documents based on the provided research data. Be specific and structured.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content as string;
    }
  }

  return geminiFallback(prompt);
}

/**
 * Gemini fallback (training data only, no live search).
 */
async function geminiFallback(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
