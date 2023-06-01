import DOMPurify from "dompurify";
import { marked } from "marked";
import { CustomFormTextBlock } from "../../types";

const TextBlock: React.FC<{ item: CustomFormTextBlock }> = ({
  item,
  ...rest
}) => {
  return (
    <p
      className="mb-2p"
      key={item.order}
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked(item.text)),
      }}
      {...rest}
    />
  );
};
export default TextBlock;
