import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { z } from "zod";
import { SceneClip } from "./components/SceneClip";
import { OverlayCard } from "./components/OverlayCard";

export const videoCompositionSchema = z.object({
  scenes: z.array(
    z.object({
      videoUrl: z.string().optional(),
      overlayText: z.string(),
      duration: z.number(),
    })
  ),
  hook: z.string(),
  keyMessage: z.string(),
  cta: z.string(),
  language: z.enum(["en", "he"]),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]),
  musicTrackUrl: z.string().nullable(),
  brandPalette: z.object({
    primary: z.string(),
    accent: z.string(),
    text: z.string(),
  }),
  totalDurationInFrames: z.number(),
  fps: z.number(),
});

export type VideoCompositionProps = z.infer<typeof videoCompositionSchema>;

export function VideoComposition(props: VideoCompositionProps) {
  const { scenes, language, brandPalette, musicTrackUrl, hook, cta } = props;
  const { fps, durationInFrames } = useVideoConfig();

  // Build sequence offsets (cumulative via reduce so we avoid mutation)
  const sequenced = scenes.reduce<
    Array<{
      scene: typeof scenes[number];
      from: number;
      durationInFrames: number;
    }>
  >((acc, scene) => {
    const frames = Math.round(scene.duration * fps);
    const prev = acc[acc.length - 1];
    const from = prev ? prev.from + prev.durationInFrames : 0;
    acc.push({ scene, from, durationInFrames: frames });
    return acc;
  }, []);

  const totalFrames = durationInFrames;
  const introFrames = Math.min(Math.round(3 * fps), Math.round(totalFrames * 0.15));
  const outroFrames = Math.min(Math.round(4 * fps), Math.round(totalFrames * 0.2));
  const outroStart = Math.max(0, totalFrames - outroFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Scene clips back-to-back */}
      {sequenced.map((entry, i) => (
        <Sequence
          key={i}
          from={entry.from}
          durationInFrames={entry.durationInFrames}
        >
          <SceneClip
            videoUrl={entry.scene.videoUrl}
            fallbackColor={brandPalette.primary}
          />
        </Sequence>
      ))}

      {/* Intro hook card (0–3s) */}
      <Sequence from={0} durationInFrames={introFrames}>
        <OverlayCard
          variant="hook"
          text={hook}
          language={language}
          palette={brandPalette}
        />
      </Sequence>

      {/* Per-scene overlay text (lower third) — each scene's own text */}
      {sequenced.map((entry, i) => {
        // Skip the first scene (hook card already covers it) and last scene
        // (CTA will cover it)
        if (i === 0 || i === sequenced.length - 1) return null;
        if (!entry.scene.overlayText) return null;
        return (
          <Sequence
            key={`lt-${i}`}
            from={entry.from}
            durationInFrames={entry.durationInFrames}
          >
            <OverlayCard
              variant="lowerThird"
              text={entry.scene.overlayText}
              language={language}
              palette={brandPalette}
            />
          </Sequence>
        );
      })}

      {/* Outro CTA card */}
      <Sequence from={outroStart} durationInFrames={outroFrames}>
        <OverlayCard
          variant="cta"
          text={cta}
          language={language}
          palette={brandPalette}
        />
      </Sequence>

      {/* Background music — starts from the top, ducked to 70% */}
      {musicTrackUrl && (
        <Audio src={musicTrackUrl} volume={0.7} />
      )}
    </AbsoluteFill>
  );
}
