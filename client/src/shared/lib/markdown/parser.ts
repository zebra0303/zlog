import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { formatCode, isFormattable } from "./codeFormatter";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "iframe"],
  attributes: {
    ...defaultSchema.attributes,
    iframe: ["src", "width", "height", "frameBorder", "allowFullScreen", "allow", "style"],
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeHighlight, { detect: true })
  .use(rehypeStringify);

export async function parseMarkdown(markdown: string): Promise<string> {
  let processed = markdown;

  processed = processed.replace(/@\[youtube\]\(([^)]+)\)/g, (_match, id: string) => {
    const videoId = id.includes("youtube.com") ? new URL(id).searchParams.get("v") ?? id : id.includes("youtu.be") ? id.split("/").pop() ?? id : id;
    return `<iframe width="100%" height="400" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allowfullscreen style="border-radius:8px;aspect-ratio:16/9;"></iframe>`;
  });

  processed = processed.replace(/@\[codepen\]\(([^)]+)\)/g, (_match, path: string) => {
    const parts = path.split("/");
    return `<iframe height="400" style="width:100%;border-radius:8px;" scrolling="no" src="https://codepen.io/${parts.join("/embed/")}?default-tab=result" frameborder="no" allowfullscreen></iframe>`;
  });

  processed = processed.replace(/@\[codesandbox\]\(([^)]+)\)/g, (_match, id: string) => {
    return `<iframe src="https://codesandbox.io/embed/${id}" style="width:100%;height:500px;border:0;border-radius:8px;overflow:hidden;" allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe>`;
  });

  // 코드블록 자동 포맷팅: ```lang ... ``` 패턴을 찾아 Prettier로 포맷
  // 코드블록 자동 포맷팅: ```lang ... ``` 패턴을 찾아 Prettier로 포맷
  const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
  const matches = [...processed.matchAll(codeBlockRegex)];
  if (matches.length > 0) {
    const formatPromises = matches
      .filter((m) => m[1] && isFormattable(m[1]))
      .map(async (m) => {
        const lang = m[1] as string;
        const code = m[2] as string;
        const formatted = await formatCode(code, lang);
        return { original: m[0], formatted: `\`\`\`${lang}\n${formatted}\n\`\`\`` };
      });
    const results = await Promise.all(formatPromises);
    for (const { original, formatted } of results) {
      processed = processed.replace(original, formatted);
    }
  }

  const result = await processor.process(processed);
  return String(result);
}
