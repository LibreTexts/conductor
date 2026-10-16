import { useRef, useState, useEffect } from "react";
import {
  Breadcrumb,
  Button,
  Card,
  Heading,
  Spinner,
  Stack,
} from "@libretexts/davis-react";
import { IconCircleCheck, IconDeviceFloppy } from "@tabler/icons-react";
import CampusSettingsForm from "./OrgsManager/CampusSettingsForm.js";
import { useTypedSelector } from "../../state/hooks";
import DefaultScreenContainer from "../navigation/DefaultScreenContainer.js";

const CampusSettings = () => {
  //Global state
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);

  useEffect(() => {
    if (!user || !user.uuid) { // Ensure user is loaded before checking roles
      return;
    }
    if (!user.isCampusAdmin && !user.isSuperAdmin && !user.isSupport) {
      window.location.href = "/home";
    }
  }, [user]);

  const settingsFormRef =
    useRef<React.ElementRef<typeof CampusSettingsForm>>(null);
  const [loadedData, setLoadedData] = useState(false);
  const [savedData, setSavedData] = useState(false);

  return (
    <DefaultScreenContainer>
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Campus Settings</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Campus Settings</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      <Card>
        <Card.Body>
          {!loadedData && (
            <div className="flex justify-center py-12">
              <Spinner size="md" />
            </div>
          )}
          <div className={!loadedData ? "hidden" : undefined}>
            <CampusSettingsForm
              ref={settingsFormRef}
              orgID={org.orgID}
              showCatalogSettings={false}
              onUpdateLoadedData={(newVal) => setLoadedData(newVal)}
              onUpdateSavedData={(newVal) => setSavedData(newVal)}
            />
          </div>
        </Card.Body>
        <Card.Footer>
          <Button
            variant="primary"
            fullWidth
            icon={
              savedData ? (
                <IconCircleCheck size={16} />
              ) : (
                <IconDeviceFloppy size={16} />
              )
            }
            onClick={() => settingsFormRef.current?.requestSave()}
          >
            {!savedData && "Save Changes"}
          </Button>
        </Card.Footer>
      </Card>
    </DefaultScreenContainer>
  );
};

export default CampusSettings;
