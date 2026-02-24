import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { createApp } from "../app.js";
import {
  cleanDb,
  seedDefaultSettings,
  seedTestAdmin,
  getAuthToken,
  type TestAdmin,
} from "./helpers.js";

// Mock the image processor
vi.mock("../lib/image/processor.js", () => ({
  processUploadedImage: vi.fn().mockResolvedValue({
    url: "/uploads/images/mocked-id.webp",
    width: 800,
    height: 600,
    format: "webp",
  }),
}));

describe("Upload API", () => {
  const app = createApp();
  let admin: TestAdmin;
  let token: string;

  beforeAll(async () => {
    cleanDb();
    admin = seedTestAdmin();
    seedDefaultSettings();
    token = await getAuthToken(admin.id);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/upload/image", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await app.request("/api/upload/image", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 when no image is provided", async () => {
      const res = await app.request("/api/upload/image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: new FormData(),
      });
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Please select an image file.");
    });

    it("should return 400 for unsupported file types", async () => {
      const formData = new FormData();
      const blob = new Blob(["fake-text-content"], { type: "text/plain" });
      formData.append("image", blob, "test.txt");

      const res = await app.request("/api/upload/image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Only JPEG, PNG, WebP, and GIF formats are supported.");
    });

    it("should upload and process image correctly", async () => {
      const formData = new FormData();
      const blob = new Blob(["fake-image-content"], { type: "image/png" });
      formData.append("image", blob, "test.png");

      const res = await app.request("/api/upload/image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { url: string; width: number; height: number };
      expect(data.url).toBe("/uploads/images/mocked-id.webp");
      expect(data.width).toBe(800);
      expect(data.height).toBe(600);
    });
  });
});
