import { formatClientHelpAppendix } from "./coniqClients.js";

const VALID_BUILD_ENVS = new Set(["qa", "pre", "stage", "prod"]);
const BOOLEAN_ENV_KEYS = new Set(["build_ios", "build_android"]);

export function isValidBuildEnv(value) {
  return VALID_BUILD_ENVS.has(String(value ?? "").trim().toLowerCase());
}

export class BuildCommandValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BuildCommandValidationError";
  }
}

export function parseBuildCommand(input, options = {}) {
  const tokens = tokenizeCommand(input);
  const fields = {};
  const env = {};

  for (const token of tokens) {
    const envMatch = token.match(/^ENV\[([A-Za-z0-9_]+)\]:(.*)$/);

    if (envMatch) {
      const [, key, rawValue] = envMatch;
      env[key] = normalizeValue(rawValue);
      continue;
    }

    const separatorIndex = token.indexOf(":");
    if (separatorIndex === -1) {
      throw new BuildCommandValidationError(`Invalid token "${token}". Expected key:value or ENV[key]:value.`);
    }

    const key = token.slice(0, separatorIndex).trim();
    const rawValue = token.slice(separatorIndex + 1);
    fields[key] = normalizeValue(rawValue);
  }

  if (!env.build_ios) {
    env.build_ios = "true";
  }

  validateCommand(fields, env, options);

  return {
    workflow: fields.workflow,
    branch: fields.branch,
    env,
  };
}

/**
 * @param {{ backendDeployedAt?: string }} [options]
 */
export function buildSlackUsage(options = {}) {
  const backendDeployedAt = String(options.backendDeployedAt ?? "").trim();

  const body = [
    "📋 *Flutter build* — quick reference",
    "",
    "📚 *List & lookup*",
    "• `/flutter-build list` or `/flutter-build list all` — all clients and versions.",
    "• `/flutter-build list bergen` — filter one client (slug or table name).",
    "",
    "📝 *Release rows (manual)*",
    "• `/flutter-build release add | client:moa | version:4.2.400 | date:2026-05-04 | env:prod | status:released | notes:APP-999` — append",
    "• `/flutter-build release delete | client:moa | version:4.2.400` — remove",
    "",
    "🚀 *Full Bitrise trigger* (pipe-separated)",
    "• `/flutter-build workflow:deploy | branch:master | ENV[build_env]:prod | ENV[platform_account]:tanger | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:8.0.18`",
    "",
    "⚡ *Quick deploy* (highest semver across all env rows for that client → bump patch → confirm in Slack)",
    "• `/flutter-build <client> <env>` — optional commit text in `\"` or `'`",
    "• Example: `/flutter-build moa stage` — optional message: `/flutter-build moa stage \"testing push notifications\"`",
    "",
    "🔗 *Release table:* https://github.com/dayerdl/slack-bitrise-build-trigger/blob/main/data/client-releases.tsv",
    "",
    "✅ *Triggers need:* `workflow`, `branch`, `ENV[build_env]`, `ENV[platform_account]` (folder slug when possible).",
    "• Allowed `ENV[build_env]`: `qa`, `pre`, `stage`, `prod`.",
    "• Bitrise also gets `ENV[build_customer]` = same value as `ENV[platform_account]`.",
  ];

  if (backendDeployedAt) {
    body.push("", `⏱ *Backend deployed:* ${backendDeployedAt}`);
  }

  return body.join("\n") + formatClientHelpAppendix();
}

export function formatCommandSummary(command) {
  const envSummary = Object.entries(command.env)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  return `workflow=${command.workflow}, branch=${command.branch}, ${envSummary}`;
}

const BITRISE_COMMIT_MESSAGE_MAX = 500;

/**
 * Shown on the Bitrise build (API `build_params.commit_message`).
 * Optional `ENV[build_message]` overrides; it is not forwarded as a build env var.
 */
export function formatBitriseTriggerMessage(command) {
  const custom = String(command.env?.build_message ?? "").trim();
  const { build_message: _drop, ...restEnv } = command.env;

  const meta = [
    "slack_flutter_build",
    `platform_account=${String(command.env?.platform_account ?? "").trim()}`,
    `build_env=${String(command.env?.build_env ?? "").trim()}`,
    `build_version=${String(command.env?.build_version ?? "").trim()}`,
  ].join("|");

  const suffix = custom
    ? ` — ${custom}`
    : ` — ${formatCommandSummary({ ...command, env: restEnv })}`;

  return truncateUtf16ByLength(`${meta}${suffix}`, BITRISE_COMMIT_MESSAGE_MAX);
}

function truncateUtf16ByLength(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function tokenizeCommand(input) {
  const normalizedInput = String(input ?? "")
    .trim()
    .replace(/^\/flutter-build\b\s*/i, "");

  if (!normalizedInput) {
    throw new BuildCommandValidationError("Missing build command parameters.");
  }

  return normalizedInput
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function validateCommand(fields, env, options) {
  requireValue(fields.workflow, "workflow");
  requireValue(fields.branch, "branch");
  requireValue(env.build_env, "ENV[build_env]");
  requireValue(env.platform_account, "ENV[platform_account]");

  if (!isValidBuildEnv(env.build_env)) {
    throw new BuildCommandValidationError("ENV[build_env] must be one of: qa, pre, stage, prod.");
  }

  for (const key of BOOLEAN_ENV_KEYS) {
    if (env[key] && !["true", "false"].includes(env[key])) {
      throw new BuildCommandValidationError(`ENV[${key}] must be true or false.`);
    }
  }

  const allowedCustomers = options.allowedCustomers ?? [];
  if (allowedCustomers.length > 0 && !allowedCustomers.includes(env.platform_account)) {
    throw new BuildCommandValidationError(
      `ENV[platform_account] must be one of: ${allowedCustomers.join(", ")}.`
    );
  }
}

function requireValue(value, fieldName) {
  if (!value) {
    throw new BuildCommandValidationError(`Missing required parameter: ${fieldName}.`);
  }
}
