/**
 * Static storytelling framework for social content generation.
 * Encodes best practices into structured prompt sections.
 */

export const STORYTELLING_FRAMEWORK = `
## STORYTELLING FRAMEWORK

### Hook Types (use a different one for each post):
1. **Contrarian**: Challenge a common belief. "Most people think X. They're wrong."
2. **Curiosity Gap**: Create intrigue. "The #1 reason [thing] fails (and it's not what you think)."
3. **Pain Point**: Name the frustration. "Tired of [pain]? Here's what actually works."
4. **Data Hook**: Lead with a surprising stat. "[Shocking number] — here's why it matters."
5. **Story Hook**: Start mid-action. "Last week, I almost [dramatic moment]..."
6. **Question Hook**: Ask something provocative. "What if everything you knew about [topic] was outdated?"

### Narrative Structures (vary across the batch):
- **PAS** (Problem-Agitate-Solve): Name the problem → amplify the pain → present the solution.
- **BAB** (Before-After-Bridge): Show the before state → paint the after → bridge with how.
- **HSO** (Hook-Story-Offer): Hook attention → tell a relatable story → present the offer/insight.
- **AIDA** (Attention-Interest-Desire-Action): Grab attention → build interest → create desire → call to action.
- **One Big Idea**: Center the entire post around a single powerful insight. No fluff.

### Content Formulas:
- **The List**: "5 ways to..." / "3 things I wish I knew about..."
- **The Myth Buster**: "Stop doing X. Here's why..."
- **The How-To**: Step-by-step breakdown of a process.
- **The Hot Take**: Bold opinion backed by reasoning.
- **The Case Study**: Real example with results and takeaways.
- **The Comparison**: X vs Y — which is better and why.
- **The Behind-the-Scenes**: Show the process, not just the result.

### Post Endings:
- **Direct CTA**: "Click the link in bio" / "DM us for..."
- **Engagement CTA**: "What's your take? Drop a comment."
- **Save/Share CTA**: "Save this for later" / "Share with someone who needs this."
- **Thought Prompt**: End with a reflective question that lingers.
- **Cliffhanger**: "Tomorrow I'll reveal the results..." (for series content).
`;

/**
 * Returns the storytelling framework for injection into social post prompts.
 */
export function getStorytellingPromptSection(): string {
  return STORYTELLING_FRAMEWORK;
}

/**
 * Returns a condensed version for single caption generation.
 */
export function getCondensedStorytellingGuidance(): string {
  return `Structure your caption with a strong hook (contrarian, curiosity gap, pain point, data, story, or question), a clear narrative arc (problem-agitate-solve, before-after-bridge, or one big idea), and an appropriate ending (CTA, engagement prompt, or thought prompt). Vary your approach — don't default to the same structure every time.`;
}
