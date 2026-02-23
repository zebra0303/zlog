export const FONT_OPTIONS = [
  {
    value: "system",
    label: "System Default",
    family:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    value: "pretendard",
    label: "Pretendard (Modern)",
    family:
      '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif',
    cdn: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css",
  },
  {
    value: "nanum-square-neo",
    label: "NanumSquare Neo (Trendy)",
    family:
      '"NanumSquareNeo", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    cdn: "https://cdn.jsdelivr.net/gh/moonspam/NanumSquareNeo@1.0/nanumsquareneo.css",
  },
  {
    value: "noto-sans-kr",
    label: "Noto Sans KR (Standard)",
    family: '"Noto Sans KR", sans-serif',
    cdn: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap",
  },
  {
    value: "nanum-myeongjo",
    label: "Nanum Myeongjo (Serif)",
    family: '"Nanum Myeongjo", serif',
    cdn: "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap",
  },
];

export function applyFont(fontValue: string) {
  const font = FONT_OPTIONS.find((f) => f.value === fontValue) ?? FONT_OPTIONS[0];
  if (!font) return; // Should never happen given FONT_OPTIONS[0] fallback

  // 1. Set CSS Variable for font-family
  document.documentElement.style.setProperty("--font-sans", font.family);
  document.body.style.fontFamily = font.family;

  // 2. Inject CDN link if needed
  if (font.cdn) {
    const id = `font-${font.value}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = font.cdn;
      document.head.appendChild(link);
    }
  }
}
