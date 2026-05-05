import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

export function signQuickDeployToken(payload, secret) {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${Buffer.from(body, "utf8").toString("base64url")}.${sig}`;
}

/**
 * @returns {Record<string, unknown> | null}
 */
export function verifyQuickDeployToken(token, secret, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (!token || !secret) {
    return null;
  }
  const dot = token.lastIndexOf(".");
  if (dot === -1) {
    return null;
  }
  const bodyB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let body;
  try {
    body = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = createHmac("sha256", secret).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof payload.t !== "number" || Number.isNaN(payload.t)) {
    return null;
  }
  if (Date.now() - payload.t > maxAgeMs) {
    return null;
  }
  return payload;
}
