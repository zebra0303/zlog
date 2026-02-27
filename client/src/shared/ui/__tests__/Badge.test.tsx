import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it("applies default variant with theme token classes", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-[var(--color-primary)]");
    expect(badge.className).toContain("text-white");
  });

  it("applies secondary variant with theme tokens", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText("Secondary");
    expect(badge.className).toContain("text-[var(--color-primary)]");
  });

  it("applies outline variant with theme tokens", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText("Outline");
    expect(badge.className).toContain("border-[var(--color-border)]");
    expect(badge.className).toContain("text-[var(--color-text-secondary)]");
  });

  it("applies destructive variant with theme tokens (no hardcoded red)", () => {
    render(<Badge variant="destructive">Error</Badge>);
    const badge = screen.getByText("Error");
    expect(badge.className).toContain("bg-[var(--color-destructive-light)]");
    expect(badge.className).toContain("text-[var(--color-destructive)]");
    // Ensure no hardcoded Tailwind red classes remain
    expect(badge.className).not.toMatch(/bg-red-\d+/);
    expect(badge.className).not.toMatch(/text-red-\d+/);
  });

  it("merges custom className", () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    expect(screen.getByText("Custom").className).toContain("custom-badge");
  });
});
