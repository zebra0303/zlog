import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../sanitize";

describe("sanitizeHtml", () => {
  it("allows trusted embed iframes (youtube-nocookie, codepen, codesandbox)", () => {
    const html = [
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>',
      '<iframe src="https://codepen.io/team/embed/abc"></iframe>',
      '<iframe src="https://codesandbox.io/embed/xyz"></iframe>',
    ].join("");
    const sanitized = sanitizeHtml(html);
    expect(sanitized).toContain("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(sanitized).toContain("https://codepen.io/team/embed/abc");
    expect(sanitized).toContain("https://codesandbox.io/embed/xyz");
  });

  it("removes untrusted or phishing iframes", () => {
    const dirty = '<p>Hello</p><iframe src="https://evil.example.com/phish"></iframe>';
    const sanitized = sanitizeHtml(dirty);
    expect(sanitized).toContain("<p>Hello</p>");
    expect(sanitized).not.toContain("<iframe");
    expect(sanitized).not.toContain("evil.example.com");
  });

  it("strips dangerous CSS expressions and javascript URLs from inline styles", () => {
    const dirty =
      '<div style="background:url(javascript:alert(1))">Text</div><span style="color: red;">Safe</span>';
    const sanitized = sanitizeHtml(dirty);
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("url(");
    expect(sanitized).toContain("color: red");
  });
});
