/**
 * Extracts a user-friendly error message from an unknown caught value.
 * Returns the Error's message if available, otherwise the fallback string.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Extracts error message with i18n ERR_ code translation support.
 * Used in federation-related catch blocks where server returns ERR_ prefixed messages.
 */
export function getFederationErrorMessage(
  err: unknown,
  fallback: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string,
): string {
  if (!(err instanceof Error)) return fallback;
  if (err.message.startsWith("ERR_")) {
    const translated = t(err.message.toLowerCase());
    return translated || fallback;
  }
  return err.message || fallback;
}
