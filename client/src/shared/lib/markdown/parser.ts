import { formatCode, isFormattable } from "./codeFormatter";

// Lazy-loaded unified processor (loaded once on first call)
let processorPromise: Promise<{
  process: (input: string) => Promise<{ toString: () => string }>;
}> | null = null;

function getProcessor() {
  processorPromise ??= (async () => {
    const [
      { unified },
      remarkParse,
      remarkGfm,
      remarkRehype,
      rehypeHighlight,
      rehypeRaw,
      rehypeSanitize,
      rehypeStringify,
    ] = await Promise.all([
      import("unified"),
      import("remark-parse").then((m) => m.default),
      import("remark-gfm").then((m) => m.default),
      import("remark-rehype").then((m) => m.default),
      import("rehype-highlight").then((m) => m.default),
      import("rehype-raw").then((m) => m.default),
      import("rehype-sanitize").then((m) => m.default),
      import("rehype-stringify").then((m) => m.default),
    ]);

    const { defaultSchema } = await import("rehype-sanitize");

    const sanitizeSchema = {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames ?? []), "iframe"],
      attributes: {
        ...defaultSchema.attributes,
        iframe: ["src", "width", "height", "frameBorder", "allowFullScreen", "allow", "style"],
        div: ["className", "class"],
        // Allow inline styles on span for text/background color
        span: ["style"],
      },
    };

    return unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, sanitizeSchema)
      .use(rehypeHighlight, { detect: true })
      .use(rehypeStringify);
  })();
  return processorPromise;
}

export async function parseMarkdown(markdown: string): Promise<string> {
  let processed = markdown;

  // Extract mermaid code blocks as placeholders (excluded from Prettier/highlight)
  // HTML comments are stripped by rehype-sanitize, so use plain text markers
  const mermaidBlocks: string[] = [];
  processed = processed.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code: string) => {
    const idx = mermaidBlocks.length;
    mermaidBlocks.push(code.trim());
    return `MERMAID_BLOCK_${idx}_PLACEHOLDER`;
  });

  // GitHub-style alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
  const calloutLabels: Record<string, string> = {
    NOTE: "Note",
    TIP: "Tip",
    IMPORTANT: "Important",
    WARNING: "Warning",
    CAUTION: "Caution",
  };
  processed = processed.replace(
    /^(?:> *)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n((?:^>.*\n?)*)/gim,
    (_match, type: string, body: string) => {
      const key = type.toUpperCase();
      const label = calloutLabels[key] ?? key;
      const content = body.replace(/^> ?/gm, "").trim().replace(/\n/g, "<br/>");
      return `<div class="callout callout-${key.toLowerCase()}"><div class="callout-title">${label}</div><div class="callout-body">${content}</div></div>\n`;
    },
  );

  processed = processed.replace(/@\[youtube\]\(([^)]+)\)/g, (_match, url: string) => {
    let videoId = url;
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      const host = parsed.hostname.toLowerCase();
      // Strict hostname check
      if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "www.youtube.com") {
        videoId = parsed.searchParams.get("v") ?? videoId;
      } else if (host === "youtu.be") {
        videoId = parsed.pathname.substring(1) || videoId;
      } else if (host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
        // Already a nocookie URL, extract ID from path if needed, but usually it's just the ID
        const parts = parsed.pathname.split("/");
        videoId = parts[parts.length - 1] ?? videoId;
      }
    } catch {
      // If URL parsing fails, treat as raw ID
    }
    // Final check for safe ID format (alphanumeric, dashes, underscores only)
    if (!/^[\w-]+$/.test(videoId)) return _match;

    return `<iframe width="100%" height="400" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius:8px;aspect-ratio:16/9;"></iframe>`;
  });

  // Auto-embed standalone YouTube URLs (plain URL on its own line)
  // Refined regex to ensure we only capture legitimate youtube domains
  processed = processed.replace(
    /^[ \t]*(?:<)?https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]+)(?:[^\s)]*?)>?[ \t]*$/gm,
    (_match, videoId: string) => {
      return `<iframe width="100%" height="400" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius:8px;aspect-ratio:16/9;"></iframe>`;
    },
  );

  processed = processed.replace(/@\[codepen\]\(([^)]+)\)/g, (_match, url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      const host = parsed.hostname.toLowerCase();
      if (host !== "codepen.io" && !host.endsWith(".codepen.io")) return _match;

      const path = parsed.pathname.replace(/^\/|\/$/g, "");
      const parts = path.split("/");
      // Expected path: user/pen/id or user/embed/id
      return `<iframe height="400" style="width:100%;border-radius:8px;" scrolling="no" src="https://codepen.io/${parts.join("/embed/")}?default-tab=result" frameborder="no" allowfullscreen></iframe>`;
    } catch {
      return _match;
    }
  });

  processed = processed.replace(/@\[codesandbox\]\(([^)]+)\)/g, (_match, url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      const host = parsed.hostname.toLowerCase();
      if (host !== "codesandbox.io" && !host.endsWith(".codesandbox.io")) return _match;

      const id = parsed.pathname.split("/").pop() ?? "";
      if (!/^[\w-]+$/.test(id)) return _match;

      return `<iframe src="https://codesandbox.io/embed/${id}" style="width:100%;height:500px;border:0;border-radius:8px;overflow:hidden;" allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe>`;
    } catch {
      return _match;
    }
  });

  // Auto-format code blocks: find ```lang ... ``` patterns and format with Prettier
  const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  const matches = [...processed.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    const formatPromises = matches
      .filter((m) => m[1] && isFormattable(m[1]))
      .map(async (m) => {
        const lang = m[1] ?? "";
        const code = m[2] ?? "";
        const formatted = await formatCode(code, lang);
        return { original: m[0], formatted: `\`\`\`${lang}\n${formatted}\n\`\`\`` };
      });
    const results = await Promise.all(formatPromises);
    for (const { original, formatted } of results) {
      processed = processed.replace(original, formatted);
    }
  }

  const processor = await getProcessor();
  const result = await processor.process(processed);
  let html = String(result);

  // Add language label + copy button header to code blocks
  html = html.replace(/<pre><code class="hljs language-(\w+)">/g, (_match, lang: string) => {
    const displayLang = lang.toLowerCase();
    return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${displayLang}</span><button type="button" class="code-block-copy" aria-label="Copy code"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div><pre><code class="hljs language-${lang}">`;
  });

  // Handle closing tags for wrapped code blocks
  // Append </div> after </code></pre> for <pre> wrapped in code-block-wrapper
  html = html.replace(/(<div class="code-block-wrapper">[\s\S]*?<\/code><\/pre>)/g, "$1</div>");

  // Add target="_blank" to all links so they open in a new tab
  html = html.replace(/<a\s+(href="[^"]*")/g, '<a target="_blank" rel="noopener noreferrer" $1');

  // Replace mermaid placeholders with rendering divs
  // After passing through the unified pipeline, they remain as <p>MERMAID_BLOCK_0_PLACEHOLDER</p>
  for (let i = 0; i < mermaidBlocks.length; i++) {
    const raw = mermaidBlocks[i] ?? "";
    const encoded = raw
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = html.replace(
      new RegExp(`<p>MERMAID_BLOCK_${i}_PLACEHOLDER</p>|MERMAID_BLOCK_${i}_PLACEHOLDER`, "g"),
      `<div class="mermaid-block" data-mermaid="${encoded}"><div class="mermaid-loading">Loading diagram...</div></div>`,
    );
  }

  return html;
}
