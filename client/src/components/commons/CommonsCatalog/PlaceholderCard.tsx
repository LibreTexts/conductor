import { Card, CardProps, Placeholder } from "semantic-ui-react";

const PlaceholderCard: React.FC<CardProps> = ({ ...rest }) => {
  return (
    <Card {...rest}>
      <Placeholder>
        <Placeholder.Image square />
      </Placeholder>
      <Card.Content>
        <Placeholder>
          <Placeholder.Header>
            <Placeholder.Line length="very short" />
            <Placeholder.Line length="medium" />
          </Placeholder.Header>
          <Placeholder.Paragraph>
            <Placeholder.Line length="short" />
          </Placeholder.Paragraph>
        </Placeholder>
      </Card.Content>
    </Card>
  );
};

export default PlaceholderCard;
