import "./ControlPanel.css";
import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  Button,
  Grid,
  Header,
  Icon,
  Segment,
} from "semantic-ui-react";
import CampusSettingsForm from "./OrgsManager/CampusSettingsForm.js";
import { useTypedSelector } from "../../state/hooks";

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
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Campus Settings</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Campus Settings</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment raised loading={!loadedData}>
              <CampusSettingsForm
                ref={settingsFormRef}
                orgID={org.orgID}
                showCatalogSettings={false}
                onUpdateLoadedData={(newVal) => setLoadedData(newVal)}
                onUpdateSavedData={(newVal) => setSavedData(newVal)}
              />
              <Button
                color="green"
                className="mt-2p"
                fluid
                onClick={() => settingsFormRef.current?.requestSave()}
              >
                <Icon name={savedData ? "check" : "save"} />
                {!savedData && <span>Save Changes</span>}
              </Button>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CampusSettings;
