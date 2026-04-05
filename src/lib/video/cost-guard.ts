/**
 * Cost estimation and enforcement for video generation.
 *
 * Prevents runaway bills by capping per-video cost and tracking spend
 * against a budget envelope set via VIDEO_COST_CAP_USD (default $6).
 */

/** Veo 3.1 Fast pricing (1080p): $0.15 per second of output. */
const VEO_COST_PER_SECOND_USD = 0.15;

/** Remotion Lambda render cost estimate (generous upper bound). */
const COMPOSER_COST_USD = 0.05;

/** Gemini 2.5 Flash script generation (negligible but counted). */
const SCRIPT_COST_USD = 0.01;

/** Default hard cap per video. */
const DEFAULT_CAP_USD = 6;

export interface CostEstimate {
  veoCost: number;
  composerCost: number;
  scriptCost: number;
  totalUsd: number;
  sceneCount: number;
  sceneDurationSeconds: number;
}

export function estimateVideoCost(params: {
  sceneCount: number;
  sceneDurationSeconds: number;
}): CostEstimate {
  const { sceneCount, sceneDurationSeconds } = params;
  const veoCost =
    sceneCount * sceneDurationSeconds * VEO_COST_PER_SECOND_USD;
  const totalUsd = veoCost + COMPOSER_COST_USD + SCRIPT_COST_USD;
  return {
    veoCost,
    composerCost: COMPOSER_COST_USD,
    scriptCost: SCRIPT_COST_USD,
    totalUsd,
    sceneCount,
    sceneDurationSeconds,
  };
}

export function getCostCapUsd(): number {
  const raw = process.env.VIDEO_COST_CAP_USD;
  if (!raw) return DEFAULT_CAP_USD;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CAP_USD;
}

export function assertBelowCap(estimate: CostEstimate): void {
  const cap = getCostCapUsd();
  if (estimate.totalUsd > cap) {
    throw new Error(
      `Estimated video cost $${estimate.totalUsd.toFixed(2)} exceeds cap $${cap.toFixed(2)}. ` +
        `Reduce scene count or duration.`
    );
  }
}
