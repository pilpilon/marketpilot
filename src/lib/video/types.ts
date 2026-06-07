/**
 * Shared types for the Video Creator skill.
 *
 * All video generation flows persist state in public.pipeline_jobs
 * (job_type='video_creator') with VideoJobMetadata stored in metadata.
 */

export type VideoFramework =
  | "problem_aha_proof_cta"
  | "pas"
  | "aida"
  | "bab";

export type VideoLanguage = "en" | "he";

export type VideoMode = "freeform" | "template";

export type VideoTemplate =
  | "product_demo"
  | "educational"
  | "ugc"
  | "ai_avatar";

export type VideoAspectRatio = "9:16" | "1:1" | "16:9";

export type MusicMood =
  | "energetic"
  | "corporate"
  | "chill"
  | "upbeat"
  | "cinematic"
  | "minimal"
  | "none";

export type VideoJobStatus =
  | "pending"
  | "planning"     // script generation
  | "generating"   // scene generation via Veo
  | "composing"    // remotion/fallback stitching
  | "completed"
  | "failed";

/** A single scene in the generated video. */
export interface VideoScene {
  index: number;
  /** Prompt used to generate the scene via Veo. */
  prompt: string;
  /** Short on-screen overlay text for this scene (optional). */
  overlayText: string;
  /** Seconds of this scene in the final video. */
  duration: number;
  /** Public URL of the generated scene clip (once complete). */
  videoUrl?: string;
  /** Public URL of a product/app screenshot used for screenshot walkthrough scenes. */
  imageUrl?: string;
  /** Veo long-running operation name (while generating). */
  veoOperationName?: string;
  /** Reference image URL passed to Veo (last frame of previous scene). */
  referenceImageUrl?: string;
}

/** Structured script output from the AI planner. */
export interface VideoScript {
  /** Big headline displayed during the hook (0-3s). */
  hook: string;
  /** Mid-video key message / metric. */
  keyMessage: string;
  /** Final call-to-action text. */
  cta: string;
  /** Framework used. */
  framework: VideoFramework;
  /** Scenes of the video (typically 3-4 × 8s). */
  scenes: VideoScene[];
  /** Script language. */
  language: VideoLanguage;
  /** Music mood auto-selected from brand tone. */
  musicMood: MusicMood;
  /** Total target duration in seconds. */
  totalDuration: number;
}

/** Metadata blob persisted on pipeline_jobs.metadata for video jobs. */
export interface VideoJobMetadata {
  mode: VideoMode;
  language: VideoLanguage;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  framework: VideoFramework;
  template: VideoTemplate;
  musicMood: MusicMood;
  musicTrackUrl?: string;
  script?: VideoScript;
  /** Final MP4 public URL once composed. */
  finalVideoUrl?: string;
  /** Accumulated cost in USD (Veo + composer). */
  costUsd: number;
  /** Composer implementation used. */
  composer?: "remotion_lambda" | "fallback_first_scene";
  /** Warnings surfaced to the user. */
  warnings?: string[];
}

/** Input for starting a new video job. */
export interface CreateVideoJobInput {
  projectId: string;
  mode: VideoMode;
  language?: VideoLanguage;
  durationSeconds?: number;
  framework?: VideoFramework;
  template?: VideoTemplate;
  goal?: string;
  tone?: string;
  musicMood?: MusicMood;
  campaignName?: string;
}

/** Client-side polling response shape. */
export interface VideoJobStatusResponse {
  jobId: string;
  status: VideoJobStatus;
  currentStep: string;
  totalScenes: number;
  completedScenes: number;
  campaignId: string;
  assetId?: string;
  finalVideoUrl?: string;
  errorMessage: string | null;
  warnings: string[];
  costUsd: number;
}
