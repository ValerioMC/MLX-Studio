import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-yaml";

/**
 * Prism with the languages models write most, instead of all ~300 grammars.
 * `javascript`, `css` and `markup` (html/xml/svg) ship in Prism's own core
 * bundle already. Anything else renders as plain text.
 */
const ALIASES: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  dockerfile: "docker",
  html: "markup",
  xml: "markup",
  svg: "markup",
  js: "javascript",
  mjs: "javascript",
  ts: "typescript",
  py: "python",
  rs: "rust",
  yml: "yaml",
  md: "markdown",
  "c++": "cpp",
  kt: "kotlin",
};

/** The registered grammar name for a fence's language tag, or "text". */
export function resolveLanguage(tag: string): string {
  const lower = tag.toLowerCase();
  const name = ALIASES[lower] ?? lower;
  return name in Prism.languages ? name : "text";
}

/** Highlighted HTML for a code string; escaped plain text when there is no grammar. */
export function highlight(code: string, languageTag: string): string {
  const resolved = resolveLanguage(languageTag);
  const grammar = Prism.languages[resolved];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, resolved);
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}
