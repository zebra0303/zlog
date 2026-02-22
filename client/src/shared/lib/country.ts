export function countryFlag(code: string): string {
  return Array.from(code.toUpperCase(), (c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join(
    "",
  );
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([navigator.language, "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
