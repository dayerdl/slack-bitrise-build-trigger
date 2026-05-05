export function parseBitriseCommitMessageMetadata(commitMessage) {
  const msg = String(commitMessage ?? "").trim();
  if (!msg.startsWith("slack_flutter_build|")) {
    return null;
  }
  const head = msg.split(" — ")[0];
  const parts = head.split("|").slice(1);
  const out = {};
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      out[k] = v;
    }
  }
  if (!out.platform_account || !out.build_env || !out.build_version) {
    return null;
  }
  return out;
}

