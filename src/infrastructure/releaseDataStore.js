import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOCAL_TSV = join(__dirname, "../../data/client-releases.tsv");

/**
 * Load / save `client-releases.tsv` — GitHub API when `GITHUB_TOKEN` + `GITHUB_REPOSITORY` are set,
 * otherwise local file (for `vercel dev` / tests).
 */
export function createReleaseDataStore() {
  const token = String(process.env.GITHUB_TOKEN ?? "").trim();
  const repoFull = String(process.env.GITHUB_REPOSITORY ?? "").trim();
  const branch = String(process.env.GITHUB_RELEASE_BRANCH ?? "main").trim();
  const pathInRepo = String(process.env.RELEASE_TSV_PATH ?? "data/client-releases.tsv").trim();

  if (process.env.VERCEL === "1" && (!token || !repoFull)) {
    throw new Error(
      "Vercel filesystem is read-only. Set `GITHUB_TOKEN` and `GITHUB_REPOSITORY` so releases are saved via the GitHub API."
    );
  }

  if (token && repoFull) {
    const [owner, repo] = splitRepo(repoFull);
    if (!owner || !repo) {
      throw new Error("GITHUB_REPOSITORY must be owner/repo (e.g. dayerdl/slack-bitrise-build-trigger).");
    }
    return {
      async loadTsv() {
        return githubGetFileContent({ token, owner, repo, branch, path: pathInRepo });
      },
      async saveTsv(content, message) {
        const { sha } = await githubGetFileMeta({ token, owner, repo, branch, path: pathInRepo });
        await githubPutFileContent({
          token,
          owner,
          repo,
          branch,
          path: pathInRepo,
          content,
          message,
          sha,
        });
      },
    };
  }

  const localPath = process.env.LOCAL_RELEASE_TSV_PATH || DEFAULT_LOCAL_TSV;

  return {
    async loadTsv() {
      return readFileSync(localPath, "utf8");
    },
    async saveTsv(content) {
      writeFileSync(localPath, content, "utf8");
    },
  };
}

function splitRepo(full) {
  const parts = full.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return [parts[0], parts[1]];
  }
  return ["", ""];
}

async function githubGetFileMeta({ token, owner, repo, branch, path }) {
  const url = contentApiUrl(owner, repo, path) + `?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: githubHeaders(token),
  });

  if (res.status === 404) {
    throw new Error(`GitHub: file not found (${path} on ${branch}).`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.sha) {
    throw new Error("GitHub response missing sha.");
  }

  return { sha: data.sha };
}

async function githubGetFileContent({ token, owner, repo, branch, path }) {
  const url = contentApiUrl(owner, repo, path) + `?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: githubHeaders(token),
  });

  if (res.status === 404) {
    throw new Error(`GitHub: file not found (${path} on ${branch}).`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (typeof data.content !== "string" || data.encoding !== "base64") {
    throw new Error("GitHub file response was not base64 text.");
  }

  return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
}

async function githubPutFileContent({ token, owner, repo, branch, path, content, message, sha }) {
  const url = contentApiUrl(owner, repo, path);
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    sha,
    branch,
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT failed (${res.status}): ${text}`);
  }
}

function contentApiUrl(owner, repo, path) {
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}
