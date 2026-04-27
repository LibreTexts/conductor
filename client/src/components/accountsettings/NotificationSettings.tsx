import { useState } from "react";
import {
  Segment,
  Divider,
  Card,
  Image,
  Header,
  Button,
  Icon,
  Form,
  Modal,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { Account } from "../../types";
import useGlobalError from "../error/ErrorHooks";
import { normalizeURL, truncateString } from "../util/HelperFunctions";

const NotificationSettings = ({
  account,
  onDataChange,
}: {
  account: Account;
  onDataChange: Function;
}) => {
  const DEFAULT_AVATAR = "/mini_logo.png";

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <Segment basic className="pane-segment" loading={loading}>
      <h2>Notification Settings</h2>
      <Divider />
      <em>This feature is coming soon!</em>
    </Segment>
  );
};
export default NotificationSettings;
