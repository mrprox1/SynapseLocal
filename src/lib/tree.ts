export type TreeNode = { name: string; path: string; children?: TreeNode[] }; // children => folder

/** Folders first, then files, each alphabetical. Folders exist only because a path goes through them. */
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const p of paths) {
    let node = root;
    p.split("/").forEach((name, i, parts) => {
      const path = parts.slice(0, i + 1).join("/");
      let next = node.children!.find((c) => c.path === path);
      if (!next) node.children!.push((next = { name, path, ...(i < parts.length - 1 && { children: [] }) }));
      node = next;
    });
  }
  const sort = (ns: TreeNode[]) => {
    ns.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name));
    ns.forEach((n) => n.children && sort(n.children));
  };
  sort(root.children!);
  return root.children!;
}
