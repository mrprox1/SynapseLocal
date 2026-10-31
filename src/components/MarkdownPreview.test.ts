import { expect, test, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (p: string) => p }));
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("highlight.js/styles/github.css", () => ({}));
vi.mock("@/store/workspace", () => ({ useWorkspace: () => "" }));

const { wikiToLinks } = await import("./MarkdownPreview");

test("wiki links become links, code is untouched", () => {
  const md = "see [[A b|label]] and [[C]] but `[[x]]`\n```\n[[y]]\n```\n[[D]]";
  expect(wikiToLinks(md)).toBe(
    "see [label](wiki:A%20b) and [C](wiki:C) but `[[x]]`\n```\n[[y]]\n```\n[D](wiki:D)",
  );
});
