import { Header, HeaderProps } from "semantic-ui-react";
import { CustomFormHeading } from "../../types";

interface HeadingBlockProps extends HeaderProps {
  item: CustomFormHeading;
}

const HeadingBlock: React.FC<HeadingBlockProps> = ({ item, ...rest }) => {
  return (
    <Header as="h4" key={item.order} dividing {...rest}>
      {item.text}
    </Header>
  );
};

export default HeadingBlock;
