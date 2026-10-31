export type GitCode = "M" | "A" | "D" | "U";
export type GitStatus = { branch: string; files: Record<string, GitCode> };

/** Parse `git status --porcelain=v1 -z --branch` output; `prefix` is the workspace's path inside the repo. */
export function parseStatus(prefix: string, raw: string): GitStatus {
  const [head = "", ...recs] = raw.split("\0");
  const branch = head.replace(/^## (No commits yet on |Initial commit on )?/, "").split("...")[0];
  const files: Record<string, GitCode> = {};
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.length < 4) continue;
    const [x, y] = [r[0], r[1]];
    const renamed = x === "R" || x === "C" || y === "R" || y === "C";
    if (renamed) i++; // next field is the old path
    const path = r.slice(3);
    if (!path.startsWith(prefix)) continue;
    const c = renamed ? "A" : x === "?" ? "U" : y !== " " ? y : x;
    files[path.slice(prefix.length)] = c === "D" ? "D" : c === "A" || c === "U" ? c : "M";
  }
  return { branch, files };
}
