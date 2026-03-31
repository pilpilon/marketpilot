import sharp from "sharp";

/**
 * Composites a transparent text overlay PNG onto a background image.
 * Returns the final composited image as a PNG buffer.
 */
export async function compositeImage(
  backgroundBuffer: Buffer,
  overlayPngBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  // Resize background to exact target dimensions (Gemini may return slightly different sizes)
  const resizedBackground = await sharp(backgroundBuffer)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();

  // Composite overlay on top of background
  const result = await sharp(resizedBackground)
    .composite([
      {
        input: overlayPngBuffer,
        top: 0,
        left: 0,
      },
    ])
    .png({ quality: 95 })
    .toBuffer();

  return result;
}
