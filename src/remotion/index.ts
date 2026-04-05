/**
 * Remotion root — registers the MarketPilot video composition.
 *
 * Deploy with:
 *   npx remotion lambda sites create src/remotion/index.ts --site-name=marketpilot-video
 *
 * Then set REMOTION_SERVE_URL in your env to the returned bundle URL.
 */

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
