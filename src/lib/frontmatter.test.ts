import { describe, expect, it } from "vitest";
import { removeFrontmatterKey, setFrontmatterKey } from "./frontmatter";

describe("setFrontmatterKey", () => {
  it("replaces an existing value and keeps the trailing comment", () => {
    const src = "---\ntitle: A\nstatus: todo   # column\n---\nbody\n";
    expect(setFrontmatterKey(src, "status", "done")).toBe("---\ntitle: A\nstatus: done   # column\n---\nbody\n");
  });

  it("appends a missing key as the last line of the block", () => {
    expect(setFrontmatterKey("---\ntitle: A\n---\nbody", "order", 2)).toBe("---\ntitle: A\norder: 2\n---\nbody");
  });

  it("handles an empty block", () => {
    expect(setFrontmatterKey("---\n---\nx", "a", "b")).toBe("---\na: b\n---\nx");
  });

  it("prepends a block when there is no frontmatter", () => {
    expect(setFrontmatterKey("hello\n", "status", "todo")).toBe("---\nstatus: todo\n---\nhello\n");
    expect(setFrontmatterKey("", "title", "T")).toBe("---\ntitle: T\n---\n");
  });

  it("keeps CRLF", () => {
    const src = "---\r\ntitle: A\r\nstatus: todo\r\n---\r\nbody\r\n";
    expect(setFrontmatterKey(src, "status", "done")).toBe("---\r\ntitle: A\r\nstatus: done\r\n---\r\nbody\r\n");
    expect(setFrontmatterKey(src, "order", 1)).toBe("---\r\ntitle: A\r\nstatus: todo\r\norder: 1\r\n---\r\nbody\r\n");
    expect(setFrontmatterKey("x\r\ny", "a", "b")).toBe("---\r\na: b\r\n---\r\nx\r\ny");
  });

  it("quotes values that need it", () => {
    const set = (v: string) => setFrontmatterKey("", "k", v);
    expect(set("a: b")).toBe('---\nk: "a: b"\n---\n');
    expect(set("a # b")).toBe('---\nk: "a # b"\n---\n');
    expect(set(" x")).toBe('---\nk: " x"\n---\n');
    expect(set("")).toBe('---\nk: ""\n---\n');
    expect(set("plain")).toBe("---\nk: plain\n---\n");
  });

  it("does not match nested lookalikes", () => {
    const src = "---\nmeta:\n  status: x\n---\n";
    expect(setFrontmatterKey(src, "status", "done")).toBe("---\nmeta:\n  status: x\nstatus: done\n---\n");
  });

  it("leaves a body that looks like frontmatter alone", () => {
    expect(setFrontmatterKey("---\na: 1\n---\n---\nb: 2\n---\n", "a", 3)).toBe("---\na: 3\n---\n---\nb: 2\n---\n");
  });
});

describe("removeFrontmatterKey", () => {
  it("removes only that line", () => {
    expect(removeFrontmatterKey("---\na: 1\nb: 2\n---\nx", "a")).toBe("---\nb: 2\n---\nx");
    expect(removeFrontmatterKey("---\r\na: 1\r\nb: 2\r\n---\r\n", "b")).toBe("---\r\na: 1\r\n---\r\n");
  });
  it("is a no-op when missing", () => {
    expect(removeFrontmatterKey("---\na: 1\n---\n", "z")).toBe("---\na: 1\n---\n");
    expect(removeFrontmatterKey("no fm", "a")).toBe("no fm");
  });
});
