import sharp from "sharp";
import { debugError } from "../debug";

export async function convertBase64SVGToBase64PNG(base64SVG: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64SVG, "base64");
    const pngBuffer = await sharp(buffer).png().toBuffer();
    return pngBuffer.toString("base64");
  } catch (error) {
    debugError(`Error converting SVG to PNG: ${error}`);
    return null;
  }
}

export async function resizeImageBase64(
  base64: string,
  maxDimension: number
): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64, 'base64');
    const resized = await sharp(buffer)
      .resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    return resized.toString('base64');
  } catch (error) {
    debugError(`Error resizing image: ${error}`);
    return null;
  }
}