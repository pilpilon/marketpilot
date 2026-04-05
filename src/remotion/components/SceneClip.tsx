import { AbsoluteFill, OffthreadVideo } from "remotion";

interface SceneClipProps {
  videoUrl?: string;
  fallbackColor: string;
}

/**
 * Plays a Veo-generated scene clip full-bleed. Veo native audio is kept
 * at low volume so it doesn't fight the music bed (20%).
 *
 * When videoUrl is missing (shouldn't happen in prod), shows a solid brand
 * color fill.
 */
export function SceneClip({ videoUrl, fallbackColor }: SceneClipProps) {
  if (!videoUrl) {
    return <AbsoluteFill style={{ backgroundColor: fallbackColor }} />;
  }

  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={videoUrl}
        volume={0.2}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
}
