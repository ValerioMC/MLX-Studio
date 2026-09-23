import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyButton } from "@/components/ui/controls";
import { openExternal } from "@/lib/openExternal";
import { useIsDark } from "@/hooks/useIsDark";
import { resolveLanguage, SyntaxHighlighter } from "./highlighter";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const dark = useIsDark();
  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex h-8 items-center justify-between border-b pl-3 pr-1.5 text-xs text-muted-foreground">
        <span>{language}</span>
        <CopyButton text={code} label="Copy code" showLabel />
      </div>
      <SyntaxHighlighter
        style={dark ? oneDark : oneLight}
        language={resolveLanguage(language)}
        PreTag="div"
        customStyle={{ margin: 0, padding: "0.8rem 0.9rem", background: "transparent", fontSize: "0.86rem" }}
        codeTagProps={{ style: { fontFamily: "inherit", background: "transparent" } }}
        className="font-mono"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

const components: Components = {
  code({ className, children }) {
    const match = /language-([\w+#-]+)/.exec(className ?? "");
    const text = String(children ?? "");
    // Fenced blocks end in a newline; inline code never does.
    if (!match && !text.includes("\n")) {
      return <code className="rounded bg-muted px-1 py-[1px] font-mono text-[0.88em]">{children}</code>;
    }
    return <CodeBlock language={match?.[1] ?? "text"} code={text.replace(/\n$/, "")} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (href && /^https?:\/\//.test(href)) void openExternal(href);
        }}
        className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border-b px-2 py-1.5 text-left font-semibold">{children}</th>;
  },
  td({ children }) {
    return <td className="border-b px-2 py-1.5 align-top">{children}</td>;
  },
  img({ src, alt }) {
    return <img src={src} alt={alt ?? ""} className="my-2 max-h-80 rounded-md" loading="lazy" />;
  },
};

const proseClass = [
  "text-md leading-[1.65] [overflow-wrap:anywhere]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2.5 [&_ul]:my-2.5 [&_ol]:my-2.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5",
  "[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold",
  "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-md [&_h3]:font-semibold",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-5 [&_strong]:font-semibold",
].join(" ");

/** Model output and model cards, rendered as GitHub-flavored Markdown. */
export const Markdown = memo(function Markdown({ content, trailing }: { content: string; trailing?: ReactNode }) {
  return (
    <div className={proseClass}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {trailing}
    </div>
  );
});
