import { PrismLight } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";

/**
 * Prism with the languages models write most, instead of all ~300 grammars
 * (about 700 KB of the bundle). Anything else renders as plain text.
 */
const LANGUAGES: Record<string, unknown> = {
  bash,
  c,
  cpp,
  css,
  diff,
  docker,
  go,
  java,
  javascript,
  json,
  jsx,
  kotlin,
  markdown,
  markup,
  python,
  rust,
  sql,
  swift,
  toml,
  tsx,
  typescript,
  yaml,
};

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

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  PrismLight.registerLanguage(name, grammar);
}

/** The registered grammar for a fence's language tag, or "text". */
export function resolveLanguage(tag: string): string {
  const lower = tag.toLowerCase();
  const name = ALIASES[lower] ?? lower;
  return name in LANGUAGES ? name : "text";
}

export const SyntaxHighlighter = PrismLight;
