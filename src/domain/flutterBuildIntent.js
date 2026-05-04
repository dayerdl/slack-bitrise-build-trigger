const LIST_KEYWORDS = new Set(["list", "clients", "versions"]);

/**
 * Parse slash-command text (Slack omits the `/flutter-build` prefix in `text`).
 */
export function parseFlutterBuildIntent(text) {
  const normalized = String(text ?? "")
    .trim()
    .replace(/^\/flutter-build\b\s*/i, "")
    .trim();

  if (!normalized) {
    return { type: "empty" };
  }

  const firstWord = normalized.split(/\s+/)[0]?.toLowerCase() ?? "";

  if (firstWord === "help") {
    return { type: "help" };
  }

  if (LIST_KEYWORDS.has(firstWord)) {
    return { type: "list" };
  }

  return { type: "build" };
}
