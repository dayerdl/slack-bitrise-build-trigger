const LIST_KEYWORDS = new Set(["list", "clients", "versions"]);

/**
 * Parse slash-command text (Slack omits the `/flutter-build` prefix in `text`).
 *
 * List mode: `list`, `list all`, `list Bergen Town Centre` (client name / partial after the keyword).
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
    const afterKeyword = normalized.replace(/^(list|clients|versions)\s*/i, "").trim();
    const listAll =
      !afterKeyword || afterKeyword.toLowerCase() === "all";
    const clientQuery = listAll ? null : afterKeyword;
    return { type: "list", clientQuery };
  }

  const releaseVerb = normalized.match(/^release\s+(add|delete|remove)\s*(.*)$/is);
  if (releaseVerb) {
    const verb = releaseVerb[1].toLowerCase();
    const fieldText = String(releaseVerb[2] ?? "").trim();
    if (verb === "add") {
      return { type: "release_add", fieldText };
    }
    return { type: "release_delete", fieldText };
  }

  if (/^add\s+release\s*/i.test(normalized)) {
    return {
      type: "release_add",
      fieldText: normalized.replace(/^add\s+release\s*/i, "").trim(),
    };
  }

  if (/^(delete|remove)\s+release\s*/i.test(normalized)) {
    return {
      type: "release_delete",
      fieldText: normalized.replace(/^(delete|remove)\s+release\s*/i, "").trim(),
    };
  }

  return { type: "build" };
}
