import sharp from "sharp";

export async function convertBase64SVGToBase64PNG(base64SVG: string): Promise<string> {
  const buffer = Buffer.from(base64SVG, "base64");
  const pngBuffer = await sharp(buffer).png().toBuffer();
  return pngBuffer.toString("base64");
}
