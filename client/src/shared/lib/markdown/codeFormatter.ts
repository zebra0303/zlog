/**
 * Code block auto-formatting — Prettier standalone (bundle optimization via dynamic import)
 */

// Prettier supported language → parser mapping
const LANG_PARSER_MAP: Record<string, string> = {
  javascript: "babel",
  js: "babel",
  jsx: "babel",
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  json: "json",
  graphql: "graphql",
  markdown: "markdown",
  md: "markdown",
  yaml: "yaml",
  yml: "yaml",
};

/** Check if the language is formattable by Prettier */
export function isFormattable(lang: string): boolean {
  return lang.toLowerCase() in LANG_PARSER_MAP;
}

/** Format code with Prettier (supported languages only, returns original on failure) */
export async function formatCode(code: string, lang: string): Promise<string> {
  const parser = LANG_PARSER_MAP[lang.toLowerCase()];
  if (!parser) return code;

  try {
    // Load only when needed via dynamic import (bundle optimization)
    const [prettier, estreePlugin] = await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/estree"),
    ]);

    // Load only the required plugins based on the parser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins: any[] = [estreePlugin.default ?? estreePlugin]; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

    if (parser === "babel" || parser === "json") {
      const babel = await import("prettier/plugins/babel");
      plugins.push(babel.default ?? babel); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    } else if (parser === "typescript") {
      const [babel, ts] = await Promise.all([
        import("prettier/plugins/babel"),
        import("prettier/plugins/typescript"),
      ]);
      plugins.push(babel.default ?? babel); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      plugins.push(ts.default ?? ts); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    } else if (parser === "css" || parser === "scss" || parser === "less") {
      const css = await import("prettier/plugins/postcss");
      plugins.push(css.default ?? css); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    } else if (parser === "html") {
      const html = await import("prettier/plugins/html");
      plugins.push(html.default ?? html); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    } else if (parser === "markdown") {
      const md = await import("prettier/plugins/markdown");
      plugins.push(md.default ?? md); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    } else if (parser === "yaml") {
      const yaml = await import("prettier/plugins/yaml");
      plugins.push(yaml.default ?? yaml); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    } else if (parser === "graphql") {
      const gql = await import("prettier/plugins/graphql");
      plugins.push(gql.default ?? gql); // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    }

    const formatted = await prettier.format(code, {
      parser,
      plugins,
      printWidth: 80,
      tabWidth: 2,
      singleQuote: true,
      semi: true,
      trailingComma: "all",
    });

    // Prettier adds a trailing newline, so trim it
    return formatted.trimEnd();
  } catch {
    // On format failure (e.g. syntax error), keep the original
    return code;
  }
}
