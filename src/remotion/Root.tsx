import { Composition } from "remotion";
import { VideoComposition, videoCompositionSchema } from "./VideoComposition";

const FPS = 30;
const DEFAULT_DURATION_SECONDS = 32; // 4 × 8s

/**
 * Register one composition that handles all aspect ratios / durations
 * via inputProps. Lambda will resolve real dimensions at render time
 * through calculateMetadata below.
 */
export function RemotionRoot() {
  return (
    <Composition
      id="MarketPilotVideo"
      component={VideoComposition}
      durationInFrames={DEFAULT_DURATION_SECONDS * FPS}
      fps={FPS}
      width={1080}
      height={1920}
      schema={videoCompositionSchema}
      defaultProps={{
        scenes: [],
        hook: "",
        keyMessage: "",
        cta: "",
        language: "en" as const,
        aspectRatio: "9:16" as const,
        musicTrackUrl: null,
        brandPalette: {
          primary: "#1a1a2e",
          accent: "#e94560",
          text: "#ffffff",
        },
        totalDurationInFrames: DEFAULT_DURATION_SECONDS * FPS,
        fps: FPS,
      }}
      calculateMetadata={({ props }) => {
        const { width, height } = resolveDimensions(props.aspectRatio);
        return {
          durationInFrames: props.totalDurationInFrames,
          fps: props.fps,
          width,
          height,
        };
      }}
    />
  );
}

function resolveDimensions(aspectRatio: "9:16" | "1:1" | "16:9"): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}
