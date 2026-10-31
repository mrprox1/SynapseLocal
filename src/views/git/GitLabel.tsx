import type { ReactNode } from "react";
import type { GitCode, GitStatus } from "@/lib/git";
import { useWorkspace } from "@/store/workspace";

export const gitColor = (c: GitCode) => `var(--git-${c === "U" ? "A" : c})`;

// folders take the "worst" child
const ORDER: GitCode[] = ["D", "M", "A", "U"];
export function gitCode(git: GitStatus | null, path: string, folder: boolean): GitCode | null {
  if (!git) return null;
  if (!folder) return git.files[path] ?? null;
  const hits = new Set(Object.entries(git.files).filter(([p]) => p.startsWith(path + "/")).map(([, c]) => c));
  return ORDER.find((c) => hits.has(c)) ?? null;
}

/** Tree row content: name coloured by git status, letter (or dot for folders) right-aligned. */
export function GitLabel({ path, folder, children }: { path: string; folder: boolean; children: ReactNode }) {
  const code = useWorkspace((s) => gitCode(s.git, path, folder));
  if (!code) return <>{children}</>;
  const color = { color: gitColor(code) };
  return (
    <>
      <span className="truncate" style={color}>{children}</span>
      <span className="ml-auto pl-2 text-xs" style={color}>{folder ? "●" : code}</span>
    </>
  );
}
