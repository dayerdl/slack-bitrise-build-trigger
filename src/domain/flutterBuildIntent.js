import { isValidBuildEnv } from "./buildCommand.js";

const LIST_KEYWORDS = new Set(["list", "clients", "versions"]);

const QUICK_DEPLOY_RESERVED_FIRST = new Set([
  "help",
  "list",
  "clients",
  "versions",
  "release",
  "add",
  "delete",
  "remove",
  "confirm",
]);

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

  const quickDeploy = tryParseQuickDeploy(normalized);
  if (quickDeploy) {
    return quickDeploy;
  }

  return { type: "build" };
}

/**
 * Short form: `<platform_slug> <build_env>` e.g. `moa stage` (no pipes).
 */
function tryParseQuickDeploy(normalized) {
  if (normalized.includes("|")) {
    return null;
  }

  const parts = splitArgsRespectingQuotes(normalized);
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  const [slugRaw, envRaw, messageRaw] = parts;
  const envLower = envRaw.toLowerCase();
  if (!isValidBuildEnv(envLower)) {
    return null;
  }

  const firstLower = slugRaw.toLowerCase();
  if (QUICK_DEPLOY_RESERVED_FIRST.has(firstLower)) {
    return null;
  }

  return {
    type: "quick_deploy",
    platformSlug: slugRaw.trim(),
    buildEnv: envLower,
    commitMessage: messageRaw ? String(messageRaw).trim() : null,
  };
}

function splitArgsRespectingQuotes(input) {
  const s = String(input ?? "").trim();
  const out = [];
  let i = 0;

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) {
      i++;
    }
    if (i >= s.length) {
      break;
    }

    const ch = s[i];
    if (ch === "\"" || ch === "'") {
      const quote = ch;
      i++;
      let token = "";
      while (i < s.length && s[i] !== quote) {
        token += s[i];
        i++;
      }
      if (i < s.length && s[i] === quote) {
        i++;
      }
      out.push(token);
      continue;
    }

    let token = "";
    while (i < s.length && !/\s/.test(s[i])) {
      token += s[i];
      i++;
    }
    if (token) {
      out.push(token);
    }
  }

  return out.filter((x) => String(x).length > 0);
}
