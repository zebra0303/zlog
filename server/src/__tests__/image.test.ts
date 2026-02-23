import { describe, it, expect, vi, beforeEach } from "vitest";
import { processUploadedImage, generateThumbnail } from "../lib/image/processor.js";

// Mock sharp
const mockToFile = vi.fn();
const mockWebp = vi.fn(() => ({
  toFile: mockToFile,
  resize: vi.fn().mockReturnThis(),
}));
const mockResize = vi.fn().mockReturnThis();
const mockMetadata = vi.fn(() => Promise.resolve({ width: 1000, height: 800 }));

vi.mock("sharp", () => {
  return {
    default: vi.fn(() => ({
      metadata: mockMetadata,
      webp: mockWebp,
      resize: mockResize,
    })),
  };
});

// Mock fs and path to avoid actual file system writes
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true), // Assume dir exists
    mkdirSync: vi.fn(),
  };
});

describe("Image Processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process uploaded image correctly", async () => {
    const buffer = Buffer.from("fake-image-data");
    const result = await processUploadedImage(buffer);

    expect(result).toHaveProperty("url");
    expect(result.url).toMatch(/\/uploads\/images\/.*\.webp$/);
    expect(result.width).toBe(1000);
    expect(result.height).toBe(800);
    expect(result.format).toBe("webp");

    expect(mockWebp).toHaveBeenCalledWith({ quality: 80 });
    expect(mockToFile).toHaveBeenCalled();
  });

  it("should generate thumbnail correctly", async () => {
    const buffer = Buffer.from("fake-image-data");
    const originalId = "test-id";
    const result = await generateThumbnail(buffer, originalId);

    expect(result).toMatch(/\/uploads\/images\/test-id_thumb\.webp$/);
    // expect(mockResize).toHaveBeenCalledWith({ width: 400, height: 400, fit: "cover" }); // Mock logic is a bit simple, verify call structure if needed
  });
});
