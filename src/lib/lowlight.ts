// vite.config.ts aliases "lowlight" here: rehype-highlight always registers lowlight's `common`
// (~37 grammars); this swaps in the ones we use. Unlisted fences render uncoloured.
import bash from "highlight.js/lib/languages/bash";
import diff from "highlight.js/lib/languages/diff"; // git DiffView
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";

// the package's `exports` hides lib/, so reach the core by path
export { createLowlight } from "../../node_modules/lowlight/lib/index.js";

export const common = { bash, diff, go, javascript, json, markdown, python, shell, sql, typescript, yaml };
export const all = common;
