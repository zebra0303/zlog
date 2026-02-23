import sharp from "sharp";
import fs from "fs";
import path from "path";
import { generateId } from "../uuid.js";

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "images");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  format: "webp";
}

export async function processUploadedImage(buffer: Buffer): Promise<ProcessedImage> {
  const id = generateId();
  const filename = `${id}.webp`;
  const filepath = path.join(UPLOADS_DIR, filename);

  // Resize logic:
  // - Convert to WebP
  // - Resize to max 1920px width (for large screens)
  // - Maintain aspect ratio
  // - Quality 80%
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;

  // If image is very large, resize it
  let pipeline = sharp(buffer).webp({ quality: 80 });

  if (width > 1920) {
    pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
  }

  await pipeline.toFile(filepath);

  // Get final dimensions
  const finalMetadata = await sharp(filepath).metadata();

  return {
    url: `/uploads/images/${filename}`,
    width: finalMetadata.width ?? 0,
    height: finalMetadata.height ?? 0,
    format: "webp",
  };
}
export async function generateThumbnail(
  buffer: Buffer,
  originalId: string,
): Promise<string | null> {
  try {
    const filename = `${originalId}_thumb.webp`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await sharp(buffer)
      .resize({ width: 400, height: 400, fit: "cover" }) // Square thumbnail
      .webp({ quality: 70 })
      .toFile(filepath);

    return `/uploads/images/${filename}`;
  } catch (error) {
    console.error("Failed to generate thumbnail:", error);
    return null;
  }
}
