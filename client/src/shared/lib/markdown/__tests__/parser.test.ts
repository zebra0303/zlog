import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../parser";

describe("Markdown Parser", () => {
  it("should parse normal markdown", async () => {
    const markdown = "# Hello\n\n**bold** text";
    const html = await parseMarkdown(markdown);
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<strong>bold</strong> text");
  });

  it("should support image dimensions syntax: ![alt|width|height](url)", async () => {
    const markdown = "![My Image|200](/path/to/img.png)\n![Hero|100%|300px](/hero.jpg)";
    const html = await parseMarkdown(markdown);
    expect(html).toContain('<img src="/path/to/img.png" alt="My Image" width="200">');
    expect(html).toContain('<img src="/hero.jpg" alt="Hero" width="100%" height="300px">');
  });

  it("should support github-style alerts/callouts", async () => {
    // Replace literal '\n' as line break
    const actualMarkdown = "> [!NOTE]\n> This is a note";
    const html = await parseMarkdown(actualMarkdown);
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('<div class="callout-title">Note</div>');
    expect(html).toContain("This is a note");
  });

  it("should not format standard images with alt|width regex if no piped dimension", async () => {
    const markdown = "![standard](img.png)";
    const html = await parseMarkdown(markdown);
    expect(html).toContain('<img src="img.png" alt="standard"');
  });
});
