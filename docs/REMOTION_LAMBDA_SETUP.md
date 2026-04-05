# Remotion Lambda Setup (one-time)

The Video Creator skill uses Remotion to stitch Veo scenes + overlay cards
+ music into a final MP4. In production this runs on AWS Lambda.

Without this setup, the composer falls back to returning the first Veo
scene as-is (single 8s clip, no overlays, no music).

## Prerequisites

- An AWS account with billing enabled (free tier works for low volume)
- AWS CLI installed locally OR willingness to copy/paste a policy JSON
- About 15 minutes

## Step 1 — Create an IAM user for Remotion

```bash
# This prints a policy you need to attach to a new IAM user.
npx remotion lambda policies user
```

1. The command prints a policy JSON. Copy it.
2. Open https://console.aws.amazon.com/iam/home#/users
3. Click **Create user** → name it `remotion-marketpilot` → Next
4. On "Set permissions" → **Attach policies directly** → **Create policy**
5. Switch to JSON tab, paste the policy from step 1, save as `RemotionUser`
6. Back on the user creation flow, attach `RemotionUser`, finish user creation
7. Click the new user → **Security credentials** → **Create access key**
   → choose **CLI** → copy the Access Key ID + Secret Access Key

Export them locally so the next commands work:

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export REMOTION_AWS_REGION=us-east-1   # or eu-central-1 closer to Supabase
```

## Step 2 — Create the role policy

```bash
npx remotion lambda policies role
```

Same drill: copy the printed JSON, create another policy in AWS Console
called `RemotionRole`, then:

```bash
npx remotion lambda policies role-attach
```

This creates the role `remotion-lambda-role` and attaches the policy.

## Step 3 — Deploy the Lambda function

```bash
npx remotion lambda functions deploy
```

Copy the printed function name — you'll paste it into Vercel env as
`REMOTION_LAMBDA_FUNCTION_NAME`. It looks like:
`remotion-render-4-0-xxx-mem2048mb-disk2048mb-120sec`.

## Step 4 — Deploy the composition bundle

```bash
npx remotion lambda sites create src/remotion/index.ts --site-name=marketpilot-video
```

Copy the printed Serve URL — paste into Vercel env as
`REMOTION_SERVE_URL`. It looks like:
`https://remotionlambda-useast1-xxx.s3.us-east-1.amazonaws.com/sites/marketpilot-video/index.html`.

Re-run this command every time you change `src/remotion/*` and want
the changes live in production.

## Step 5 — Set Vercel env vars

In Vercel project settings → Environment Variables, add (Production):

```
REMOTION_SERVE_URL=<from step 4>
REMOTION_LAMBDA_FUNCTION_NAME=<from step 3>
REMOTION_AWS_REGION=us-east-1
REMOTION_AWS_ACCESS_KEY_ID=<from step 1>
REMOTION_AWS_SECRET_ACCESS_KEY=<from step 1>
```

Redeploy. The composer auto-detects these and switches from the fallback
to Lambda.

## Step 6 — Test locally first (recommended)

Before burning Veo credits, render one composition locally with hardcoded
scene URLs:

```bash
npx remotion render src/remotion/index.ts MarketPilotVideo out.mp4 \
  --props='{"scenes":[{"videoUrl":"https://example.com/clip.mp4","overlayText":"Hook","duration":8}],"hook":"Hook","keyMessage":"Message","cta":"Click","language":"en","aspectRatio":"9:16","musicTrackUrl":null,"brandPalette":{"primary":"#1a1a2e","accent":"#e94560","text":"#ffffff"},"totalDurationInFrames":240,"fps":30}'
```

Open `out.mp4` and verify overlays render correctly in your browser.

## Pricing (approximate)

- Lambda compute: ~$0.02–$0.05 per 30s render
- S3 storage: negligible
- Data transfer: ~$0.01 per video

Budget ~$0.05/video for composition, on top of ~$4.80 for Veo.

## Rotating keys

If you ever need to rotate the IAM keys:
1. AWS Console → IAM → user `remotion-marketpilot` → Security credentials
2. Deactivate old key, create new one
3. Update Vercel env vars, redeploy

## Troubleshooting

**"Access Denied" on function deploy**
→ The user policy is missing `lambda:*` + `iam:PassRole`. Re-run
`npx remotion lambda policies user`, replace the policy content.

**Fonts look wrong in output**
→ Add web fonts to `src/remotion/` with `@remotion/fonts`. Currently the
OverlayCard uses system Heebo/Inter — add `@remotion/google-fonts/Heebo`
import for deterministic rendering.

**Renders time out**
→ Increase the memory/timeout on the Lambda function:
`npx remotion lambda functions deploy --memory=3008 --timeout=300`
