import { useEffect, useState } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import {
  Breadcrumb,
  Button,
  Card,
  Heading,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useTypedSelector } from "../../state/hooks";
import useGlobalError from "../error/ErrorHooks";
import { useNotifications } from "../../context/NotificationContext";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import DefaultScreenContainer from "../navigation/DefaultScreenContainer.js";
import KBCKEditor from "../kb/KBCKEditor";

const AccessibilityStatementManager = () => {
  useDocumentTitle("Accessibility Statement | Control Panel");
  const dispatch = useDispatch();
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  const [statement, setStatement] = useState(org.accessibilityStatement ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !user.uuid) return;
    if (!user.isCampusAdmin && !user.isSuperAdmin && !user.isSupport) {
      window.location.href = "/home";
    }
  }, [user]);

  useEffect(() => {
    // LibreTexts has its own dedicated /accessibility page.
    if (org.orgID === "libretexts") window.location.href = "/controlpanel";
  }, [org.orgID]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await axios.put(`/org/${org.orgID}`, {
        accessibilityStatement: statement,
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (res.data?.updatedOrg?.orgID === org.orgID) {
        dispatch({ type: "SET_ORG_INFO", payload: res.data.updatedOrg });
      }
      addNotification({
        type: "success",
        message: "Accessibility statement saved.",
      });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DefaultScreenContainer>
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Accessibility Statement</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Accessibility Statement</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <Card>
        <Card.Body>
          <Text>
            This statement appears at <code>/accessibility-statement</code> on
            your Campus Commons, linked from the navbar and footer. Leave it
            empty and save to remove the statement and its links.
          </Text>
          <div className="mt-4">
            <KBCKEditor data={statement} onDataChange={setStatement} />
          </div>
        </Card.Body>
        <Card.Footer>
          <Button
            variant="primary"
            fullWidth
            icon={<IconDeviceFloppy size={16} />}
            loading={saving}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Card.Footer>
      </Card>
    </DefaultScreenContainer>
  );
};

export default AccessibilityStatementManager;
