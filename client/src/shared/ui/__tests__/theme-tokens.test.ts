import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Read the global CSS to extract theme token definitions
const globalCss = fs.readFileSync(
  path.resolve(__dirname, "../../../app/styles/global.css"),
  "utf-8",
);

// Required theme tokens that must exist in both light and dark themes
const REQUIRED_TOKENS = [
  "--color-primary",
  "--color-background",
  "--color-surface",
  "--color-text",
  "--color-text-secondary",
  "--color-border",
  "--color-destructive",
  "--color-destructive-light",
  "--color-success",
  "--color-success-light",
];

describe("Theme tokens", () => {
  it("defines all required tokens in @theme (light mode)", () => {
    // Extract @theme { ... } block
    const themeMatch = /@theme\s*\{([^}]+)\}/.exec(globalCss);
    expect(themeMatch).not.toBeNull();
    const themeBlock = themeMatch?.[1] ?? "";

    for (const token of REQUIRED_TOKENS) {
      expect(themeBlock, `Missing light token: ${token}`).toContain(token);
    }
  });

  it("defines dark mode overrides for mutable tokens in .dark block", () => {
    // Extract .dark { ... } block
    const darkMatch = /\.dark\s*\{([^}]+)\}/.exec(globalCss);
    expect(darkMatch).not.toBeNull();
    const darkBlock = darkMatch?.[1] ?? "";

    // Tokens that must change between light/dark
    const darkRequiredTokens = [
      "--color-background",
      "--color-surface",
      "--color-text",
      "--color-text-secondary",
      "--color-border",
      "--color-destructive",
      "--color-destructive-light",
      "--color-success",
      "--color-success-light",
    ];

    for (const token of darkRequiredTokens) {
      expect(darkBlock, `Missing dark token: ${token}`).toContain(token);
    }
  });

  it("does not use undefined text-primary-foreground class anywhere", () => {
    // Scan all TSX files in client/src for the removed class
    const srcDir = path.resolve(__dirname, "../../..");

    function scanDir(dir: string): string[] {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
          results.push(...scanDir(fullPath));
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("text-primary-foreground")) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const filesWithBadClass = scanDir(srcDir);
    expect(
      filesWithBadClass,
      `Found text-primary-foreground in: ${filesWithBadClass.join(", ")}`,
    ).toHaveLength(0);
  });
});
