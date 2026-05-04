import crypto from "node:crypto";

const SIGNATURE_VERSION = "v0";
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

export function verifySlackSignature({ rawBody, timestamp, signature, signingSecret }) {
  if (!signingSecret || !timestamp || !signature) {
    return false;
  }

  const requestAgeSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(requestAgeSeconds) || requestAgeSeconds > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const baseString = `${SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  const expectedSignature = `${SIGNATURE_VERSION}=${crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  return timingSafeEqual(expectedSignature, signature);
}

function timingSafeEqual(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
