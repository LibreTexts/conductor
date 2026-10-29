import DOMPurify from "dompurify";
import { useEffect, useMemo, useRef, useState } from "react";
import parse, {
  attributesToProps,
  domToReact,
  Element,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { IconButton } from "@libretexts/davis-react";
import { IconCheck, IconLink } from "@tabler/icons-react";
import api from "../../api";
import {
  createHeadingIdFactory,
  headingLink,
  type ArticleHeading,
} from "../../utils/kbHeadings";

interface KBRendererProps extends React.HTMLAttributes<HTMLDivElement> {
  content?: string;
  /**
   * Called with the article's `<h2>`/`<h3>` headings whenever the rendered
   * content changes, so a parent can build a table of contents. Fires only
   * after oEmbeds have been resolved, which is when the article is complete.
   */
  onHeadingsChange?: (headings: ArticleHeading[]) => void;
}

/** Heading levels that get an anchor and a table-of-contents entry. */
const ANCHORED_HEADINGS = ["h2", "h3"];

/** The visible text of a parsed node and everything under it. */
function textOf(node: DOMNode): string {
  if (node.type === "text") return (node as any).data ?? "";
  if (node instanceof Element) {
    return (node.children as DOMNode[]).map(textOf).join("");
  }
  return "";
}

/**
 * A copy-link control for one section, shown beside its heading.
 *
 * Revealed on hover and on keyboard focus, but never removed from the tab
 * order — `opacity` rather than `display`, so a keyboard user can reach it.
 * Feedback is a brief inline state change plus a live region, which keeps the
 * confirmation out of the way of a reader moving through the article.
 */
const HeadingAnchorButton: React.FC<{ id: string; text: string }> = ({
  id,
  text,
}) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(headingLink(id));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <span className="not-prose inline-flex items-center align-middle ml-2">
      <IconButton
        type="button"
        onClick={handleCopy}
        variant="ghost"
        size="sm"
        icon={
          copied ? (
            <IconCheck size={16} aria-hidden="true" />
          ) : (
            <IconLink size={16} aria-hidden="true" />
          )
        }
        aria-label={`Copy link to section: ${text}`}
        tooltip={copied ? "Link copied" : "Copy link to this section"}
        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
      <span className="sr-only" role="status">
        {copied ? `Link to ${text} copied` : ""}
      </span>
    </span>
  );
};

const KBRenderer: React.FC<KBRendererProps> = ({
  content,
  onHeadingsChange,
  ...rest
}) => {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  useEffect(() => {
    getInnerHTML();
  }, [content]);

  async function handleOEmbeds(content: string) {
    try {
      const oembedPattern = /<oembed\s+url="([^"]+)"\s*>\s*<\/oembed>/g;
      const linkPattern = /<a\s+href="(https:\/\/commons\.libretexts\.org\/file[^"]+)"[^>]*>.*?<\/a>/g; // Search for links to Commons files (e.g. videos)

      const oembeds = [...content.matchAll(oembedPattern)];
      const links = [...content.matchAll(linkPattern)];

      if ((!oembeds || oembeds.length === 0) && (!links || links.length === 0)) return content;

      for (const oembed of oembeds) {
        const fullMatch = oembed[0];
        const url = oembed[1];

        if (!fullMatch || !url) continue;

        const res = await api.getKBOEmbed(url);
        if (res.data.err) {
          console.error(res.data.errMsg);
          continue;
        }

        if (!res.data || !res.data.oembed) continue;
        content = content.replace(fullMatch, res.data.oembed);
      }

      for (const link of links) {
        const fullMatch = link[0];
        const url = link[1];
  
        if (!fullMatch || !url) continue;
  
        const res = await api.getKBOEmbed(url);
        if (res.data.err) {
          console.error(res.data.errMsg);
          continue;
        }
  
        if (!res.data || !res.data.oembed) continue;
        content = content.replace(fullMatch, res.data.oembed);
      }

      return content;
    } catch (err) {
      console.error(err);
      return content;
    }
  }

  const getInnerHTML = async () => {
    if (!content) {
      setHtml("");
      return;
    }
    const sanitized = DOMPurify.sanitize(content, {
      ADD_TAGS: [
        "iframe",
        "li",
        "ul",
        "ol",
        "span",
        "pre",
        "code",
        "figure",
        "oembed",
      ],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "scrolling",
        "srcdoc",
        "class",
        "url",
      ],
    });
    const withOembeds = await handleOEmbeds(sanitized);
    setHtml(withOembeds);
  };

  /**
   * Parses the sanitized article into React elements, giving each `<h2>`/`<h3>`
   * an id and a copy-link control, and collecting the headings on the way
   * through.
   *
   * The ids come from this pass rather than from reading the DOM afterwards, so
   * the table of contents can never disagree with the anchors that were
   * rendered. Saved articles already carry server-generated ids; those are
   * reused as-is, which is what keeps a shared link working after an author
   * renames a heading.
   */
  const { nodes, headings } = useMemo(() => {
    const collected: ArticleHeading[] = [];
    if (!html) return { nodes: null, headings: collected };

    const nextId = createHeadingIdFactory();

    const options: HTMLReactParserOptions = {
      replace: (domNode) => {
        if (!(domNode instanceof Element)) return;
        if (!ANCHORED_HEADINGS.includes(domNode.name)) return;

        const text = textOf(domNode).trim();
        if (!text) return;

        const id = nextId(text, domNode.attribs?.id);
        collected.push({ id, text, level: Number(domNode.name.slice(1)) });

        const props = attributesToProps(domNode.attribs);
        const Tag = domNode.name as "h2" | "h3";

        return (
          <Tag
            {...props}
            id={id}
            className={`group scroll-mt-8 ${props.className ?? ""}`.trim()}
          >
            {domToReact(domNode.children as DOMNode[], options)}
            <HeadingAnchorButton id={id} text={text} />
          </Tag>
        );
      },
    };

    return { nodes: parse(html, options), headings: collected };
  }, [html]);

  useEffect(() => {
    onHeadingsChange?.(headings);
  }, [headings]);

  return (
    <div className="kb-content prose !max-w-full" {...rest}>
      {nodes}
    </div>
  );
};

export default KBRenderer;
