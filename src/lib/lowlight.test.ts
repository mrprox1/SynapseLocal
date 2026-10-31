import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { describe, expect, it } from "vitest";

const html = (lang: string, code: string) =>
  renderToStaticMarkup(createElement(Markdown, { rehypePlugins: [rehypeHighlight] }, `\`\`\`${lang}\n${code}\n\`\`\``));

describe("trimmed highlight.js grammars (vite alias)", () => {
  it("highlights kept languages, by name and alias", () => {
    expect(html("go", "func main() {}")).toContain("hljs-keyword");
    expect(html("ts", "const x: number = 1")).toContain("hljs-keyword");
    expect(html("diff", "+added")).toContain("hljs-addition");
  });
  it("leaves dropped languages uncoloured", () => {
    expect(html("rust", "fn main() {}")).not.toContain("hljs-keyword");
  });
});
