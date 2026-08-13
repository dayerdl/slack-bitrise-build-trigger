/**
 * Normalize a git branch name for Bitrise clone.
 * Strips a leading remote prefix so `origin/releases/foo` → `releases/foo`.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function normalizeGitBranch(value) {
  let branch = String(value ?? "").trim();
  if (!branch) {
    return branch;
  }

  if (/^origin\//i.test(branch)) {
    branch = branch.replace(/^origin\//i, "");
  }

  return branch;
}
