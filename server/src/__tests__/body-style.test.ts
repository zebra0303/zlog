import { describe, it, expect } from "vitest";

// Pure helper for CSS variable color resolution (mirrors AppLayout.tsx logic)
function computeColorVar(
  settings: Record<string, string>,
  lightKey: string,
  darkKey: string,
  isDark: boolean,
): string | undefined {
  return isDark ? settings[darkKey] : settings[lightKey];
}

// Pure body style computation logic (mirrors client/src/features/site-settings/model/store.ts getBodyStyle)
function computeBodyStyle(
  settings: Record<string, string>,
  isDark: boolean,
): { background?: string; backgroundColor?: string } {
  const from = isDark ? settings.body_bg_color_dark : settings.body_bg_color_light;
  const to = isDark ? settings.body_bg_gradient_to_dark : settings.body_bg_gradient_to_light;
  const dir = isDark
    ? settings.body_bg_gradient_direction_dark
    : settings.body_bg_gradient_direction_light;

  if (!from) return {};
  if (to) {
    return { background: `linear-gradient(${dir ?? "to bottom"}, ${from}, ${to})` };
  }
  return { backgroundColor: from };
}

describe("computeBodyStyle", () => {
  it("returns empty object when no color is set", () => {
    expect(computeBodyStyle({}, false)).toEqual({});
    expect(computeBodyStyle({}, true)).toEqual({});
  });

  it("returns backgroundColor for light mode solid color", () => {
    const settings = { body_bg_color_light: "#ffffff" };
    expect(computeBodyStyle(settings, false)).toEqual({ backgroundColor: "#ffffff" });
  });

  it("returns backgroundColor for dark mode solid color", () => {
    const settings = { body_bg_color_dark: "#1a1a24" };
    expect(computeBodyStyle(settings, true)).toEqual({ backgroundColor: "#1a1a24" });
  });

  it("ignores dark color in light mode and vice versa", () => {
    const settings = { body_bg_color_dark: "#1a1a24" };
    expect(computeBodyStyle(settings, false)).toEqual({});

    const settings2 = { body_bg_color_light: "#ffffff" };
    expect(computeBodyStyle(settings2, true)).toEqual({});
  });

  it("returns gradient for light mode when gradient-to is set", () => {
    const settings = {
      body_bg_color_light: "#ffffff",
      body_bg_gradient_to_light: "#000000",
      body_bg_gradient_direction_light: "to right",
    };
    expect(computeBodyStyle(settings, false)).toEqual({
      background: "linear-gradient(to right, #ffffff, #000000)",
    });
  });

  it("returns gradient for dark mode when gradient-to is set", () => {
    const settings = {
      body_bg_color_dark: "#1a1a24",
      body_bg_gradient_to_dark: "#0f0f14",
      body_bg_gradient_direction_dark: "to bottom right",
    };
    expect(computeBodyStyle(settings, true)).toEqual({
      background: "linear-gradient(to bottom right, #1a1a24, #0f0f14)",
    });
  });

  it("defaults to 'to bottom' direction when direction is not set", () => {
    const settings = {
      body_bg_color_light: "#ffffff",
      body_bg_gradient_to_light: "#cccccc",
    };
    expect(computeBodyStyle(settings, false)).toEqual({
      background: "linear-gradient(to bottom, #ffffff, #cccccc)",
    });
  });

  it("returns solid color when gradient-to is empty string", () => {
    const settings = {
      body_bg_color_light: "#ffffff",
      body_bg_gradient_to_light: "",
    };
    expect(computeBodyStyle(settings, false)).toEqual({ backgroundColor: "#ffffff" });
  });
});

describe("computeColorVar (surface / text CSS variable resolution)", () => {
  it("returns light value in light mode", () => {
    const settings = { surface_color_light: "#ffffff", surface_color_dark: "#1a1a24" };
    expect(computeColorVar(settings, "surface_color_light", "surface_color_dark", false)).toBe(
      "#ffffff",
    );
  });

  it("returns dark value in dark mode", () => {
    const settings = { surface_color_light: "#ffffff", surface_color_dark: "#1a1a24" };
    expect(computeColorVar(settings, "surface_color_light", "surface_color_dark", true)).toBe(
      "#1a1a24",
    );
  });

  it("returns undefined when key is not set", () => {
    expect(computeColorVar({}, "surface_color_light", "surface_color_dark", false)).toBeUndefined();
  });

  it("does not use dark key in light mode", () => {
    const settings = { surface_color_dark: "#1a1a24" };
    expect(
      computeColorVar(settings, "surface_color_light", "surface_color_dark", false),
    ).toBeUndefined();
  });

  it("does not use light key in dark mode", () => {
    const settings = { surface_color_light: "#ffffff" };
    expect(
      computeColorVar(settings, "surface_color_light", "surface_color_dark", true),
    ).toBeUndefined();
  });

  it("works for text color in light mode", () => {
    const settings = { text_color_light: "#1a1a2e", text_color_dark: "#f0f0f5" };
    expect(computeColorVar(settings, "text_color_light", "text_color_dark", false)).toBe("#1a1a2e");
  });

  it("works for text color in dark mode", () => {
    const settings = { text_color_light: "#1a1a2e", text_color_dark: "#f0f0f5" };
    expect(computeColorVar(settings, "text_color_light", "text_color_dark", true)).toBe("#f0f0f5");
  });

  it("returns empty string when key is set to empty string", () => {
    const settings = { surface_color_light: "" };
    expect(computeColorVar(settings, "surface_color_light", "surface_color_dark", false)).toBe("");
  });
});
