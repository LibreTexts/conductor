import DOMPurify from "dompurify";
import { useEffect } from "react";

interface KBRendererProps extends React.HTMLAttributes<HTMLDivElement> {
  content?: string;
}

const KBRenderer: React.FC<KBRendererProps> = ({ content, ...rest }) => {
  useEffect(() => {
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  const getInnerHTML = () => {
    if (!content) return "";
    return DOMPurify.sanitize(content, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "scrolling",
        "srcdoc",
      ],
    });
  };

  return (
    <div {...rest} dangerouslySetInnerHTML={{ __html: getInnerHTML() }}></div>
  );
};

export default KBRenderer;
