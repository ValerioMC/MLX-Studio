import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

md.renderer.rules.image = (tokens, idx, options, _env, self) => {
  tokens[idx]?.attrSet("loading", "lazy");
  tokens[idx]?.attrSet("class", "my-3 max-h-80 rounded-card");
  return self.renderToken(tokens, idx, options);
};

type Token = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

export type Segment = { type: "html"; html: string } | { type: "code"; lang: string; code: string };

/**
 * Splits rendered markdown into HTML segments and fenced-code segments, so a
 * code fence can become a real, interactive Vue component (copy button,
 * theme-aware highlighting) instead of inert innerHTML.
 *
 * Known limitation: a fence nested inside a blockquote or list is still cut
 * out to the top level, which breaks that ancestor's HTML. Model output
 * almost never nests a fence that way, so this is accepted rather than
 * hand-rolling a full recursive AST-to-component renderer.
 */
export function markdownSegments(content: string): Segment[] {
  const tokens = md.parse(content, {});
  const segments: Segment[] = [];
  let buffer: Token[] = [];

  const flush = (): void => {
    if (buffer.length === 0) return;
    segments.push({ type: "html", html: md.renderer.render(buffer, md.options, {}) });
    buffer = [];
  };

  for (const token of tokens) {
    if (token.type === "fence") {
      flush();
      segments.push({
        type: "code",
        lang: token.info.trim().split(/\s+/)[0] || "text",
        code: token.content.replace(/\n$/, ""),
      });
    } else {
      buffer.push(token);
    }
  }
  flush();
  return segments;
}
