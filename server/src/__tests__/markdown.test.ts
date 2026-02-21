import { describe, it, expect } from "vitest";
import { stripMarkdown } from "../lib/markdown.js";

describe("stripMarkdown", () => {
  it("should strip HTML tags", () => {
    expect(stripMarkdown("<h1>Hello</h1> World")).toBe("Hello World");
    expect(stripMarkdown("<p>Para</p><br/>")).toBe("Para");
  });

  it("should strip Markdown headers", () => {
    expect(stripMarkdown("# Header 1")).toBe("Header 1");
    expect(stripMarkdown("### Header 3")).toBe("Header 3");
  });

  it("should strip bold and italic", () => {
    expect(stripMarkdown("This is **bold** and *italic*")).toBe("This is bold and italic");
    expect(stripMarkdown("__Bold__ and _Italic_")).toBe("Bold and Italic");
  });

  it("should strip links", () => {
    expect(stripMarkdown("[Google](https://google.com)")).toBe("Google");
  });

  it("should strip images (keep alt text)", () => {
    expect(stripMarkdown("![Image](image.png)")).toBe("Image");
  });

  it("should strip code blocks", () => {
    expect(
      stripMarkdown(`Text
\`\`\`js
console.log(1);
\`\`\`
More text`),
    ).toBe("Text More text");
  });

  it("should strip inline code", () => {
    expect(stripMarkdown("Use `const` var")).toBe("Use const var");
  });

  it("should strip blockquotes", () => {
    expect(stripMarkdown("> This is a quote")).toBe("This is a quote");
  });

  it("should strip GitHub alerts", () => {
    expect(
      stripMarkdown(`> [!NOTE]
> This is a note.`),
    ).toBe("This is a note.");
  });

  it("should normalize whitespace", () => {
    expect(
      stripMarkdown(`Line 1

Line 2`),
    ).toBe("Line 1 Line 2");
  });

  it("should handle mixed content", () => {
    const input = `# Title

Hello **world**.
[Link](url)

<h1>HTML</h1>`;
    expect(stripMarkdown(input)).toBe("Title Hello world. Link HTML");
  });
});
