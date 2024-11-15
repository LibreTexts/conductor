import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import api from "../../api";

interface KBRendererProps extends React.HTMLAttributes<HTMLDivElement> {
  content?: string;
}

const KBRenderer: React.FC<KBRendererProps> = ({ content, ...rest }) => {
  const [innerHTML, setInnerHTML] = useState<string>("");

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
    if (!content) return "";
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
    setInnerHTML(withOembeds);
  };

  return (
    <div
      className="prose !max-w-full"
      {...rest}
      dangerouslySetInnerHTML={{ __html: innerHTML }}
    ></div>
  );
};

export default KBRenderer;
