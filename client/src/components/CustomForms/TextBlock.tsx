import { useEffect } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { CustomFormTextBlock } from "../../types";

const TextBlock: React.FC<{ item: CustomFormTextBlock }> = ({
  item,
  ...rest
}) => {

  useEffect(() => {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }, []);

  return (
    <p
      className="mb-2p"
      key={item.order}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked(item.text, { breaks: true })),
      }}
      {...rest}
    />
  );
};
export default TextBlock;
