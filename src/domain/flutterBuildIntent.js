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
  if (parts.length < 2) {
    return null;
  }

  const [slugRaw, envRaw, ...rest] = parts;
  const envLower = envRaw.toLowerCase();
  if (!isValidBuildEnv(envLower)) {
    return null;
  }

  const firstLower = slugRaw.toLowerCase();
  if (QUICK_DEPLOY_RESERVED_FIRST.has(firstLower)) {
    return null;
  }

  let buildDebug = false;
  let branch = null;
  let tag = null;
  let buildPlatform = null;
  const messageParts = [];
  for (let i = 0; i < rest.length; i++) {
    const item = rest[i];
    const normalizedItem = String(item ?? "").trim();
    const normalizedLower = normalizedItem.toLowerCase();
    if (normalizedLower === "--debug" || normalizedLower === "debug") {
      buildDebug = true;
      continue;
    }
    if (normalizedLower === "platform:web" || normalizedLower === "web") {
      buildPlatform = "web";
      continue;
    }
    if (normalizedLower === "--platform") {
      const next = String(rest[i + 1] ?? "").trim().toLowerCase();
      if (!next) {
        return null;
      }
      if (next !== "web") {
        return null;
      }
      buildPlatform = "web";
      i++;
      continue;
    }
    if (normalizedLower.startsWith("--platform=")) {
      const value = normalizedItem.slice("--platform=".length).trim().toLowerCase();
      if (value !== "web") {
        return null;
      }
      buildPlatform = "web";
      continue;
    }
    if (normalizedLower === "--branch") {
      const next = String(rest[i + 1] ?? "").trim();
      if (!next) {
        return null;
      }
      branch = next;
      i++;
      continue;
    }
    if (normalizedLower.startsWith("--branch=")) {
      const value = normalizedItem.slice("--branch=".length).trim();
      if (!value) {
        return null;
      }
      branch = value;
      continue;
    }
    if (normalizedLower.startsWith("branch:")) {
      const value = normalizedItem.slice("branch:".length).trim();
      if (!value) {
        return null;
      }
      branch = value;
      continue;
    }
    if (normalizedLower === "--tag") {
      const next = String(rest[i + 1] ?? "").trim();
      if (!next) {
        return null;
      }
      tag = next;
      i++;
      continue;
    }
    if (normalizedLower.startsWith("--tag=")) {
      const value = normalizedItem.slice("--tag=".length).trim();
      if (!value) {
        return null;
      }
      tag = value;
      continue;
    }
    if (normalizedLower.startsWith("tag:")) {
      const value = normalizedItem.slice("tag:".length).trim();
      if (!value) {
        return null;
      }
      tag = value;
      continue;
    }
    messageParts.push(normalizedItem);
  }

  if (messageParts.length > 1) {
    return null;
  }

  if (branch && tag) {
    return null;
  }

  return {
    type: "quick_deploy",
    platformSlug: slugRaw.trim().toLowerCase(),
    buildEnv: envLower,
    commitMessage: messageParts[0] ? String(messageParts[0]).trim() : null,
    buildDebug,
    branch,
    tag,
    buildPlatform,
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
