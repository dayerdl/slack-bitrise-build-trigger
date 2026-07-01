import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isValidBuildEnv } from "./buildCommand.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WEB_HOSTING_PATH = join(__dirname, "../../data/client_web_hosting.json");

export class WebHostingConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebHostingConfigError";
  }
}

/** @returns {Record<string, Record<string, { web_hosting_url: string, web_hosting_s3_bucket: string }>>} */
export function loadWebHostingMap(path = DEFAULT_WEB_HOSTING_PATH) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {string} platformSlug
 * @param {string} buildEnv
 * @param {string} [mapPath]
 */
export function resolveWebHostingConfig(platformSlug, buildEnv, mapPath = DEFAULT_WEB_HOSTING_PATH) {
  const slug = String(platformSlug ?? "").trim().toLowerCase();
  const env = String(buildEnv ?? "").trim().toLowerCase();

  if (!slug) {
    throw new WebHostingConfigError("Missing platform account for web deploy.");
  }

  if (!isValidBuildEnv(env)) {
    throw new WebHostingConfigError(`Invalid env "${buildEnv}". Use qa, pre, stage, or prod.`);
  }

  const map = loadWebHostingMap(mapPath);
  const clientConfig = map[slug];
  if (!clientConfig) {
    throw new WebHostingConfigError(
      `Web deploy is not configured for "${slug}". Add hosting data in data/client_web_hosting.json.`
    );
  }

  const hosting = clientConfig[env];
  if (!hosting?.web_hosting_s3_bucket || !hosting?.web_hosting_url) {
    throw new WebHostingConfigError(
      `No web hosting config for "${slug}" in env "${env}". Check data/client_web_hosting.json.`
    );
  }

  return {
    web_hosting_url: String(hosting.web_hosting_url).trim(),
    web_hosting_s3_bucket: String(hosting.web_hosting_s3_bucket).trim(),
  };
}

export function isWebBuildPlatform(value) {
  return String(value ?? "").trim().toLowerCase() === "web";
}
