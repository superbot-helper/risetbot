/**
 * Input sanitization helpers for backend routes and services.
 * Keeps user-provided text safe, normalized, and predictable.
 */

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_REGEX = /<[^>]*>/g;
const MULTI_SPACE_REGEX = /[ \t]+/g;
const MULTI_NEWLINE_REGEX = /\n{3,}/g;
const FILE_UNSAFE_REGEX = /[<>:"/\\|?*\u0000-\u001F]/g;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function stripHtml(value: string): string {
  return value.replace(HTML_TAG_REGEX, " ");
}

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_REGEX, "");
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Sanitize single-line plain text.
 */
export function sanitizeText(input: unknown, maxLength = 1000): string {
  const value = String(input ?? "");
  const cleaned = stripControlChars(stripHtml(value))
    .replace(/\s+/g, " ")
    .trim();

  return truncate(cleaned, maxLength);
}

/**
 * Sanitize multi-line plain text while preserving meaningful newlines.
 */
export function sanitizeMultilineText(
  input: unknown,
  maxLength = 5000,
): string {
  const value = normalizeLineEndings(String(input ?? ""));
  const cleaned = stripControlChars(stripHtml(value))
    .split("\n")
    .map((line) => line.replace(MULTI_SPACE_REGEX, " ").trim())
    .join("\n")
    .replace(MULTI_NEWLINE_REGEX, "\n\n")
    .trim();

  return truncate(cleaned, maxLength);
}

/**
 * Sanitize optional text and return null when empty.
 */
export function sanitizeOptionalText(
  input: unknown,
  maxLength = 1000,
): string | null {
  const cleaned = sanitizeText(input, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitize optional multi-line text and return null when empty.
 */
export function sanitizeOptionalMultilineText(
  input: unknown,
  maxLength = 5000,
): string | null {
  const cleaned = sanitizeMultilineText(input, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitize chat/user prompt text with a slightly larger default limit.
 */
export function sanitizeChatMessage(input: unknown, maxLength = 4000): string {
  return sanitizeMultilineText(input, maxLength);
}

/**
 * Sanitize filenames for storage/display.
 */
export function sanitizeFilename(input: unknown, maxLength = 255): string {
  const value = String(input ?? "");
  const cleaned = stripControlChars(value)
    .replace(FILE_UNSAFE_REGEX, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  const fallback = cleaned || "file";
  return truncate(fallback, maxLength);
}

/**
 * Sanitize arrays of text values.
 */
export function sanitizeStringArray(
  input: unknown,
  maxItems = 100,
  maxItemLength = 255,
): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .slice(0, maxItems)
    .map((item) => sanitizeText(item, maxItemLength))
    .filter(Boolean);
}

/**
 * Best-effort sanitization for schema columns.
 */
export function sanitizeSchemaColumns<T extends Record<string, unknown>>(
  columns: T[] | unknown,
): Array<
  T & {
    name: string;
    aiGuidance?: string;
    description?: string;
  }
> {
  if (!Array.isArray(columns)) return [];

  return columns.map((column) => {
    const next = { ...(column as T) } as T & {
      name: string;
      aiGuidance?: string;
      description?: string;
    };

    next.name = sanitizeText(next.name, 120);

    if ("aiGuidance" in next) {
      next.aiGuidance = sanitizeMultilineText(next.aiGuidance, 1500);
    }

    if ("description" in next) {
      next.description = sanitizeMultilineText(next.description, 1500);
    }

    return next;
  });
}
