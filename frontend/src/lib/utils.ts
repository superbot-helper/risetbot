import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_REGEX = /<[^>]*>/g;
const MULTI_SPACE_REGEX = /[ \t]+/g;
const MULTI_NEWLINE_REGEX = /\n{3,}/g;
const FILENAME_UNSAFE_REGEX = /[<>:"/\\|?*\u0000-\u001F]/g;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function stripHtml(value: string) {
  return value.replace(HTML_TAG_REGEX, " ");
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function sanitizeUserText(input: string, maxLength = 2000) {
  const cleaned = stripHtml(String(input ?? ""))
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();

  return truncate(cleaned, maxLength);
}

export function sanitizeMultilineText(input: string, maxLength = 5000) {
  const cleaned = normalizeLineEndings(String(input ?? ""))
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(HTML_TAG_REGEX, " ")
    .split("\n")
    .map((line) => line.replace(MULTI_SPACE_REGEX, " ").trim())
    .join("\n")
    .replace(MULTI_NEWLINE_REGEX, "\n\n")
    .trim();

  return truncate(cleaned, maxLength);
}

export function sanitizeFilename(input: string, maxLength = 255) {
  const cleaned = String(input ?? "")
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(FILENAME_UNSAFE_REGEX, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  return truncate(cleaned || "file", maxLength);
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getStepProgress(currentStep: number, totalSteps: number) {
  if (
    !Number.isFinite(currentStep) ||
    !Number.isFinite(totalSteps) ||
    totalSteps <= 0
  ) {
    return 0;
  }

  return clampProgress((currentStep / totalSteps) * 100);
}

export function getKnowledgeStatusProgress(status: string) {
  switch (status) {
    case "pending":
      return 0;
    case "extracting":
      return 45;
    case "compiling":
      return 80;
    case "awaiting_confirmation":
      return 95;
    case "done":
      return 100;
    case "error":
      return 100;
    default:
      return 10;
  }
}

export function getReportStatusProgress(
  status: string,
  pipeline?: { currentStep?: number; totalSteps?: number } | null,
) {
  if (pipeline?.currentStep && pipeline?.totalSteps) {
    return getStepProgress(pipeline.currentStep, pipeline.totalSteps);
  }

  switch (status) {
    case "queued":
      return 10;
    case "collecting":
      return 25;
    case "analyzing":
      return 50;
    case "generating":
      return 80;
    case "done":
      return 100;
    case "error":
      return 100;
    default:
      return 0;
  }
}

export function isActivePipelineStatus(status: string) {
  return [
    "queued",
    "collecting",
    "analyzing",
    "generating",
    "extracting",
    "compiling",
    "awaiting_confirmation",
  ].includes(status);
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
