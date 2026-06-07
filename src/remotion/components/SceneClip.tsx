import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface SceneClipProps {
  videoUrl?: string;
  imageUrl?: string;
  fallbackColor: string;
}

/**
 * Plays a Veo-generated scene clip full-bleed. Veo native audio is kept
 * at low volume so it doesn't fight the music bed (20%).
 *
 * When videoUrl is missing (shouldn't happen in prod), shows a solid brand
 * color fill.
 */
export function SceneClip({ videoUrl, imageUrl, fallbackColor }: SceneClipProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorEnter = spring({
    frame: Math.max(0, frame - Math.round(fps * 0.7)),
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.8 },
  });
  const cursorX = interpolate(cursorEnter, [0, 1], [800, 560]);
  const cursorY = interpolate(cursorEnter, [0, 1], [1420, 890]);

  if (imageUrl) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0b1020", overflow: "hidden" }}>
        <Img
          src={imageUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${zoom})`,
            filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.45))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            width: 0,
            height: 0,
            borderLeft: "22px solid white",
            borderTop: "14px solid transparent",
            borderBottom: "14px solid transparent",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.65))",
            transform: "rotate(-35deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: cursorX - 42,
            top: cursorY - 42,
            width: 96,
            height: 96,
            borderRadius: 999,
            border: "4px solid rgba(255,255,255,0.72)",
            opacity: interpolate(frame, [fps, fps * 1.6], [0.95, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </AbsoluteFill>
    );
  }

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
