import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import { processUploadedImage } from "../../lib/image/processor.js";

const uploadRoute = new Hono();

uploadRoute.post("/image", authMiddleware, async (c) => {
  const body = await c.req.parseBody();
  const file = body.image;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Please select an image file." }, 400);
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: "Only JPEG, PNG, WebP, and GIF formats are supported." }, 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: "File size must not exceed 10MB." }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processUploadedImage(buffer);

    return c.json({ url: processed.url, width: processed.width, height: processed.height });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Failed to process image." }, 500);
  }
});

export default uploadRoute;
