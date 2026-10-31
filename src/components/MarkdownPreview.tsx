import { convertFileSrc } from "@tauri-apps/api/core";
import Markdown, { defaultUrlTransform } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";
import { isArchived, linkLabel } from "@/lib/board";
import { resolveLink } from "@/lib/markdown";
import { useWorkspace } from "@/store/workspace";

const SKIP = /(^(```|~~~)[\s\S]*?(?:^\2.*$|(?![\s\S]))|`[^`\n]*`)/gm;
const WIKI = /\[\[([^\][|]+)(?:\|([^\]]*))?\]\]/g;

/** `[[x|y]]` → `[y](wiki:x)`, leaving fenced blocks and inline code untouched. */
export const wikiToLinks = (
  md: string,
  isArchivedTarget?: (target: string) => boolean,
) =>
  md
    .split(SKIP)
    .map(
      (part, i) =>
        i % 3 === 0
          ? part.replace(
              WIKI,
              (_, t: string, label?: string) =>
                `[${label || linkLabel(t, !!isArchivedTarget?.(t))}](wiki:${encodeURIComponent(t.trim())})`,
            )
          : i % 3 === 1
            ? part
            : "", // capture group 2 (fence marker) — not text
    )
    .join("");

/** Resolve `src` against the directory of `path` (both workspace-relative, "/" separated). */
function joinRel(path: string, src: string) {
  const out = path.split("/").slice(0, -1);
  for (const seg of decodeURI(src).split("/")) {
    if (seg === "..") out.pop();
    else if (seg && seg !== ".") out.push(seg);
  }
  return out.join("/");
}

export function MarkdownPreview({
  path,
  onLink,
}: {
  path: string;
  onLink: (target: string) => void;
}) {
  const body = useWorkspace((s) => s.files[path]?.body ?? "");
  return (
    <div className="prose-preview h-full overflow-auto p-6">
      <MarkdownBody body={body} path={path} onLink={onLink} />
    </div>
  );
}

/** Render markdown text; relative images resolve against `path` (workspace-relative). */
export function MarkdownBody({
  body,
  path,
  onLink,
}: {
  body: string;
  path: string;
  onLink: (target: string) => void;
}) {
  const root = useWorkspace((s) => s.root);
  const files = useWorkspace((s) => s.files);
  const ticketsDir = useWorkspace((s) => s.config.ticketsDir);
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      urlTransform={(url, key, node) => {
        if (url.startsWith("wiki:")) return url;
        if (
          key === "src" &&
          node.tagName === "img" &&
          !/^([a-z][a-z0-9+.-]*:|\/)/i.test(url)
        )
          return convertFileSrc(`${root}/${joinRel(path, url)}`);
        return defaultUrlTransform(url);
      }}
      components={{
        a: ({ href, children }) =>
          href?.startsWith("wiki:") ? (
            <a
              href="#"
              className="cursor-pointer text-blue-600 underline dark:text-blue-400"
              onClick={(e) => {
                e.preventDefault();
                onLink(decodeURIComponent(href.slice(5)));
              }}
            >
              {children}
            </a>
          ) : (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
      }}
    >
      {wikiToLinks(body, (t) => {
        const hit = resolveLink(t, Object.values(files));
        return !!hit && isArchived(hit.path, ticketsDir);
      })}
    </Markdown>
  );
}
