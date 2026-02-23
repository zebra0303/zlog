import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import { processUploadedImage } from "../../lib/image/processor.js";

const uploadRoute = new Hono();

uploadRoute.post("/image", authMiddleware, async (c) => {
  const body = await c.req.parseBody();
  const image = body.image;

  if (!image || !(image instanceof File)) {
    return c.json({ error: "Image file is required." }, 400);
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const processed = await processUploadedImage(buffer);

    return c.json({ url: processed.url, width: processed.width, height: processed.height });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Failed to process image." }, 500);
  }
});

export default uploadRoute;
