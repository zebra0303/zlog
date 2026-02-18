import { describe, it, expect } from "vitest";

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
