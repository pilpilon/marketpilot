# Remotion Lambda Setup — Step by Step

Total time: ~30 minutes. Cost: **$0** at low volume (AWS free tier).

The Video Creator skill uses Remotion to stitch Veo scenes + overlay
cards + music into the final MP4. This runs on AWS Lambda in production.

Without this setup, the composer falls back to returning the first Veo
scene as-is (single 8s clip, no overlays, no music).

---

## Prerequisites

- [ ] An AWS account (sign up at https://aws.amazon.com/ if needed)
- [ ] AWS CLI installed (`brew install awscli` on macOS, or
      https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [ ] Local terminal with the marketpilot repo

---

## Step 1 — Create an AWS IAM user for Remotion

### 1a. Generate the user policy

```bash
cd C:/Users/Aorus/Documents/marketpilot
npx remotion lambda policies user
```

Copy the entire JSON output it prints.

### 1b. Create the policy in AWS Console

1. Go to https://console.aws.amazon.com/iam/home#/policies
2. Click **Create policy** → **JSON** tab
3. Paste the JSON from step 1a, overwriting whatever's there
4. Click **Next**, name it `remotion-user`, click **Create policy**

### 1c. Create the IAM user

1. Go to https://console.aws.amazon.com/iam/home#/users
2. Click **Create user**
3. Username: `remotion-marketpilot`, click **Next**
4. **Attach policies directly** → search for `remotion-user` → check it
5. Click **Next**, **Create user**

### 1d. Generate access keys

1. Click the new user `remotion-marketpilot`
2. Go to **Security credentials** tab
3. Scroll to **Access keys** → **Create access key**
4. Select **Command Line Interface (CLI)** → check the warning box → **Next**
5. Skip description tag → **Create access key**
6. **COPY BOTH** the Access Key ID and Secret Access Key — you won't see
   the secret again

### 1e. Set environment variables locally

```bash
export AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
export AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export REMOTION_AWS_REGION=us-east-1
```

(On Windows: `set AWS_ACCESS_KEY_ID=...` in cmd, or
`$env:AWS_ACCESS_KEY_ID="..."` in PowerShell.)

Verify:

```bash
aws sts get-caller-identity
```

Should print your account ID and the `remotion-marketpilot` user ARN.

---

## Step 2 — Create the Lambda role policy

```bash
npx remotion lambda policies role
```

Copy the JSON output.

1. Go to https://console.aws.amazon.com/iam/home#/policies
2. Create policy → JSON → paste → Next
3. Name: `remotion-role`, create

Now attach the role policy:

```bash
npx remotion lambda policies role-attach
```

This creates the role `remotion-lambda-role` and attaches the policy
you just made.

### Verify

```bash
npx remotion lambda policies validate
```

Should print "Your permissions look correct" or similar. If it fails,
re-read the error and fix the flagged policy.

---

## Step 3 — Deploy the Lambda function

```bash
npx remotion lambda functions deploy
```

Wait ~2 min. Output looks like:

```
✅ Deployed as "remotion-render-4-0-352-mem2048mb-disk2048mb-120sec".
```

**Copy that function name.** You'll paste it into Vercel as
`REMOTION_LAMBDA_FUNCTION_NAME`.

---

## Step 4 — Deploy the composition bundle

```bash
npx remotion lambda sites create src/remotion/index.ts --site-name=marketpilot-video
```

Wait ~2 min (bundles the React code, uploads to S3). Output:

```
Serve URL: https://remotionlambda-useast1-xxx.s3.us-east-1.amazonaws.com/sites/marketpilot-video/index.html
```

**Copy the Serve URL.** You'll paste it into Vercel as
`REMOTION_SERVE_URL`.

> Re-run this command every time you change anything in `src/remotion/*`
> and want it live in production.

---

## Step 5 — Set Vercel environment variables

Go to https://vercel.com/idans-projects-fe717255/marketpilot/settings/environment-variables

Add these for **Production**:

| Variable | Value |
|----------|-------|
| `REMOTION_SERVE_URL` | (from step 4) |
| `REMOTION_LAMBDA_FUNCTION_NAME` | (from step 3) |
| `REMOTION_AWS_REGION` | `us-east-1` |
| `REMOTION_AWS_ACCESS_KEY_ID` | (from step 1d) |
| `REMOTION_AWS_SECRET_ACCESS_KEY` | (from step 1d) |

Click **Save**, then go to **Deployments** → latest → **⋯** → **Redeploy**.

The composer auto-detects these and switches from fallback to Lambda.

---

## Step 6 — Test

1. Go to https://marketpilot-one.vercel.app/dashboard/[any-project]/skills/video-creator
2. Fill in the form → Generate
3. Watch the status — should progress through stages
4. Final video should be **32 seconds with overlays + music**, not 8 seconds

If it's still 8 seconds with a warning, check Vercel deployment logs for
`REMOTION_SERVE_URL` being read.

---

## Step 7 (optional) — Test locally before burning Veo credits

Before committing to full AWS usage, render one composition locally
with dummy URLs:

```bash
npx remotion render src/remotion/index.ts MarketPilotVideo out.mp4 --props='{"scenes":[{"videoUrl":"https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4","overlayText":"Hook text here","duration":8}],"hook":"Hook text here","keyMessage":"Proof message","cta":"Get started","language":"en","aspectRatio":"9:16","musicTrackUrl":null,"brandPalette":{"primary":"#1a1a2e","accent":"#e94560","text":"#ffffff"},"totalDurationInFrames":240,"fps":30}'
```

Open `out.mp4` — verify hook card + lower-third + CTA cards render
correctly in your local video player.

---

## Pricing

AWS Lambda free tier (permanent, not 12-month):
- 1,000,000 invocations/month FREE
- 400,000 GB-seconds/month FREE

For a 32s video at 2GB Lambda memory, each render uses ~40 GB-seconds.
Free tier covers ~10,000 videos/month.

Beyond free tier: ~$0.01–0.03 per video.

Plus S3:
- Storage: negligible
- GET/PUT: ~$0.0005 per video
- Data transfer out: ~$0.005 per video

---

## Troubleshooting

**`policies validate` fails with "Access Denied"**
→ The user policy or role policy is missing something. Copy them fresh
from `policies user` / `policies role` and replace the policy content in
AWS Console.

**Deploy succeeds but Lambda times out during render**
→ Increase memory/timeout:
```bash
npx remotion lambda functions deploy --memory=3008 --timeout=300
```

**"Expected a composition with id 'MarketPilotVideo' to exist"**
→ The site bundle is stale. Re-run
`npx remotion lambda sites create src/remotion/index.ts --site-name=marketpilot-video`.

**Fonts look wrong**
→ We use Heebo + Inter as system fonts. For deterministic rendering,
switch `src/remotion/components/OverlayCard.tsx` to use
`@remotion/google-fonts/Heebo` imports.

**Video is still only 8 seconds on prod**
→ The composer is using fallback mode. Check that all 5 env vars are
set in Vercel Production and that you redeployed after setting them.

---

## Rotating AWS keys

1. AWS Console → IAM → user `remotion-marketpilot` → Security credentials
2. Create new key, deactivate old
3. Update Vercel env vars
4. Redeploy
