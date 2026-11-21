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
  // Auto-orient EXIF metadata before resizing and converting to WebP
  const metadata = await sharp(buffer).rotate().metadata();
  const width = metadata.width;

  // If image is very large, resize it
  let pipeline = sharp(buffer).rotate().webp({ quality: 80 });

  if (width > 1920) {
    pipeline = pipeline.resize({ width: 1920, withoutEnlargement: true });
  }

  await pipeline.toFile(filepath);

  // Get final dimensions
  const finalMetadata = await sharp(filepath).metadata();

  return {
    url: `/uploads/images/${filename}`,
    width: finalMetadata.width,
    height: finalMetadata.height,
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

/** Resolve an upload URL safely within UPLOADS_DIR to prevent path traversal */
function resolveSafeUploadPath(imageUrl: string): string | null {
  if (!imageUrl.startsWith("/uploads/images/")) return null;
  const filename = path.basename(imageUrl);
  if (!filename || filename !== imageUrl.slice("/uploads/images/".length)) return null;
  const resolvedDir = path.resolve(UPLOADS_DIR);
  const resolvedPath = path.resolve(resolvedDir, filename);
  if (!resolvedPath.startsWith(resolvedDir + path.sep)) return null;
  return resolvedPath;
}

export async function getImageDimensions(
  imageUrl: string | null | undefined,
): Promise<{ width: number; height: number } | null> {
  if (!imageUrl) return null;
  const filePath = resolveSafeUploadPath(imageUrl);
  if (!filePath) return null;
  try {
    const metadata = await sharp(filePath).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
  } catch (err) {
    console.error("Failed to get image dimensions:", err);
  }
  return null;
}

export function deleteUploadedImage(imageUrl: string) {
  const filePath = resolveSafeUploadPath(imageUrl);
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore – file may already be deleted */
  }
}
