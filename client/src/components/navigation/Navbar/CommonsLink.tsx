import { Link } from "react-router-dom";
import { Icon, Menu } from "semantic-ui-react";

const CommonsLink = () => (
  <Menu.Item as={Link} to="/">
    <strong>
      <Icon name="exchange" />
      Commons
    </strong>
  </Menu.Item>
);

export default CommonsLink;
