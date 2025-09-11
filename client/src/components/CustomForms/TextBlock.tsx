import { useEffect } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { CustomFormTextBlock } from "../../types";
import classNames from "classnames";

const TextBlock: React.FC<{ item: CustomFormTextBlock; className?: string }> = ({
  item,
  className,
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
      className={classNames("mb-2p prose prose-code:before:hidden prose-code:after:hidden", className)}
      key={item.order}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked(item.text, { breaks: true })),
      }}
      {...rest}
    />
  );
};
export default TextBlock;
