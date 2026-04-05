/**
 * Google Veo 3.1 Fast client — text-to-video via Gemini API.
 *
 * Veo calls are long-running operations:
 *   1. POST :predictLongRunning → returns operation name
 *   2. GET  :fetchPredictOperation → poll until done=true
 *   3. Download video bytes from the signed URI
 *
 * We persist the operation name on the job so the cron worker can resume
 * polling across serverless invocations without blocking a request.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/video
 */

const VEO_MODEL = "veo-3.1-fast-generate-preview";

export interface VeoGenerateInput {
  /** Scene prompt (English, filmable description). */
  prompt: string;
  /** Aspect ratio supported natively. */
  aspectRatio: "9:16" | "1:1" | "16:9";
  /** Duration in seconds (Veo caps at 8). */
  durationSeconds: number;
  /** Optional reference image for scene continuity (base64-encoded). */
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  /** Enable/disable native audio generation. */
  generateAudio?: boolean;
}

export interface VeoOperationHandle {
  operationName: string;
  model: string;
}

export interface VeoOperationResult {
  done: boolean;
  /** Signed URI to fetch the video bytes (only when done=true). */
  videoUri?: string;
  /** Error message if the operation failed. */
  error?: string;
}

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not configured");
  return key;
}

/**
 * Kick off a video generation. Returns an operation handle that callers
 * should persist and poll with pollVeoOperation.
 */
export async function startVeoGeneration(
  input: VeoGenerateInput
): Promise<VeoOperationHandle> {
  const apiKey = getApiKey();

  const instance: Record<string, unknown> = {
    prompt: input.prompt,
  };

  if (input.referenceImageBase64 && input.referenceImageMimeType) {
    instance.image = {
      bytesBase64Encoded: input.referenceImageBase64,
      mimeType: input.referenceImageMimeType,
    };
  }

  const parameters: Record<string, unknown> = {
    aspectRatio: input.aspectRatio,
    durationSeconds: Math.min(8, Math.max(4, input.durationSeconds)),
    sampleCount: 1,
    resolution: "1080p",
  };
  // Veo 3.1 generates audio natively. The Fast tier rejects the
  // generateAudio parameter explicitly, so we never send it.
  void input.generateAudio;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}:predictLongRunning?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [instance], parameters }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Veo start failed (${res.status}): ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("Veo did not return an operation name");

  return { operationName: data.name, model: VEO_MODEL };
}

/**
 * Poll a previously-started Veo operation. Returns done=false if still
 * running — the caller should requeue the job and try again shortly.
 */
export async function pollVeoOperation(
  handle: VeoOperationHandle
): Promise<VeoOperationResult> {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/${handle.operationName}?key=${apiKey}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Veo poll failed (${res.status}): ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    done?: boolean;
    error?: { message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: Array<{ video?: { uri?: string } }>;
      };
    };
  };

  if (data.error?.message) {
    return { done: true, error: data.error.message };
  }

  if (!data.done) return { done: false };

  const uri =
    data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    return { done: true, error: "Veo completed but returned no video URI" };
  }

  return { done: true, videoUri: uri };
}

/**
 * Download the video bytes from Veo's signed URI. The URI requires the
 * API key appended; Veo returns MP4 bytes.
 */
export async function downloadVeoVideo(videoUri: string): Promise<{
  bytes: Buffer;
  mimeType: string;
}> {
  const apiKey = getApiKey();
  const separator = videoUri.includes("?") ? "&" : "?";
  const url = `${videoUri}${separator}key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Veo download failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") || "video/mp4";
  return { bytes: Buffer.from(arrayBuffer), mimeType };
}
