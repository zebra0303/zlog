import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../parser";

describe("Markdown Parser", () => {
  it("should parse normal markdown", async () => {
    const markdown = "# Hello\n\n**bold** text";
    const html = await parseMarkdown(markdown);
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<strong>bold</strong> text");
  });

  it("should support image dimensions syntax: ![alt](url?width=W&height=H)", async () => {
    const markdown =
      "![My Image](/path/to/img.png?width=200)\\n![Hero](/hero.jpg?width=100%25&height=300px)";
    const html = await parseMarkdown(markdown);
    expect(html).toContain(
      '<img src="/path/to/img.png?width=200" alt="My Image" width="200" style="width: 200px">',
    );
    expect(html).toContain(
      '<img src="/hero.jpg?width=100%25&#x26;height=300px" alt="Hero" width="100%" height="300px" style="width: 100%; height: 300px">',
    );
  });

  it("should support image align syntax: ![alt](url?align=left|right|center)", async () => {
    const markdown =
      "![Left](/img.png?align=left)\\n![Right](/img.png?align=right)\\n![Center](/img.png?align=center)";
    const html = await parseMarkdown(markdown);
    expect(html).toContain(
      '<img src="/img.png?align=left" alt="Left" style="float: left; margin: 0 1rem 1rem 0">',
    );
    expect(html).toContain(
      '<img src="/img.png?align=right" alt="Right" style="float: right; margin: 0 0 1rem 1rem">',
    );
    expect(html).toContain(
      '<img src="/img.png?align=center" alt="Center" style="display: block; margin: 0 auto">',
    );
  });

  it("should support github-style alerts/callouts", async () => {
    // Replace literal '\n' as line break
    const actualMarkdown = "> [!NOTE]\n> This is a note";
    const html = await parseMarkdown(actualMarkdown);
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('<div class="callout-title">Note</div>');
    expect(html).toContain("This is a note");
  });

  it("should not format standard images with width/height attributes if not provided in url query", async () => {
    const markdown = "![standard](img.png)";
    const html = await parseMarkdown(markdown);
    expect(html).toContain('<img src="img.png" alt="standard"');
  });
});
