import { CustomFormHeading } from "../../types";

interface HeadingBlockProps {
  item: CustomFormHeading;
  className?: string;
}

const HeadingBlock: React.FC<HeadingBlockProps> = ({ item, className }) => {
  return (
    <h4 className={`text-base font-semibold border-b border-gray-200 pb-1 mb-3 ${className ?? ""}`}>
      {item.text}
    </h4>
  );
};

export default HeadingBlock;
