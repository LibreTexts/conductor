import { Card, Icon, SemanticICONS } from "semantic-ui-react";

interface CardMetaWIconProps {
  icon: SemanticICONS;
  children: React.ReactNode;
}

const CardMetaWIcon: React.FC<CardMetaWIconProps> = ({ icon, children }) => {
  return (
    <Card.Meta className="flex">
      <div>
        <Icon name={icon} color="blue" className="!mr-1" />
      </div>
      <div>{children}</div>
    </Card.Meta>
  );
};

export default CardMetaWIcon;
