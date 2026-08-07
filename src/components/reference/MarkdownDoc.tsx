import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownDoc({ markdown }: { markdown: string }) {
  // The card is here rather than in each page: every markdown reference page
  // renders through this one component, so one surface decision covers the
  // whole family. Long training prose on the bare cream ground read as a
  // dump; on the app's standard card it reads as a document.
  return (
    <article className="doc card p-5 md:p-8">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
