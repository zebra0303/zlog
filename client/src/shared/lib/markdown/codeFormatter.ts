/**
 * 코드블록 자동 포맷팅 — Prettier standalone (dynamic import로 번들 최적화)
 */

// Prettier 지원 언어 → parser 매핑
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

/** 해당 언어가 Prettier로 포맷 가능한지 */
export function isFormattable(lang: string): boolean {
  return lang.toLowerCase() in LANG_PARSER_MAP;
}

/** 코드를 Prettier로 포맷 (지원 언어만, 실패 시 원본 반환) */
export async function formatCode(code: string, lang: string): Promise<string> {
  const parser = LANG_PARSER_MAP[lang.toLowerCase()];
  if (!parser) return code;

  try {
    // dynamic import로 필요시에만 로드 (번들 최적화)
    const [prettier, estreePlugin] = await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/estree"),
    ]);

    // parser에 따라 필요한 플러그인만 로드
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins: any[] = [estreePlugin.default ?? estreePlugin];

    if (parser === "babel" || parser === "json") {
      const babel = await import("prettier/plugins/babel");
      plugins.push(babel.default ?? babel);
    } else if (parser === "typescript") {
      const [babel, ts] = await Promise.all([
        import("prettier/plugins/babel"),
        import("prettier/plugins/typescript"),
      ]);
      plugins.push(babel.default ?? babel);
      plugins.push(ts.default ?? ts);
    } else if (parser === "css" || parser === "scss" || parser === "less") {
      const css = await import("prettier/plugins/postcss");
      plugins.push(css.default ?? css);
    } else if (parser === "html") {
      const html = await import("prettier/plugins/html");
      plugins.push(html.default ?? html);
    } else if (parser === "markdown") {
      const md = await import("prettier/plugins/markdown");
      plugins.push(md.default ?? md);
    } else if (parser === "yaml") {
      const yaml = await import("prettier/plugins/yaml");
      plugins.push(yaml.default ?? yaml);
    } else if (parser === "graphql") {
      const gql = await import("prettier/plugins/graphql");
      plugins.push(gql.default ?? gql);
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

    // prettier는 끝에 줄바꿈을 추가하므로 trim
    return formatted.trimEnd();
  } catch {
    // 포맷 실패 시 (구문 오류 등) 원본 유지
    return code;
  }
}
