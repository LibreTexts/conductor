import { useState, useEffect } from "react";
import { Link, useParams, useHistory } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Image,
  Button,
  Icon,
  Message,
  Dimmer,
  Loader,
  Input,
} from "semantic-ui-react";
import { CentralIdentityOrg } from "../../../../types";
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { format, parseISO } from "date-fns";
import { useTypedSelector } from "../../../../state/hooks";
import api from "../../../../api";

const CentralIdentityOrganizationView = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [loading, setLoading] = useState<boolean>(false);
  const [organization, setOrganization] = useState<CentralIdentityOrg | null>(null);
  const DEFAULT_LOGO_URL = "https://cdn.libretexts.net/DefaultImages/avatar.png";

  const [editedName, setEditedName] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");

  useEffect(() => {
    if (id && isSuperAdmin) {
      loadOrganization();
    }
  }, [id, isSuperAdmin]);

  async function loadOrganization() {
    try {
      if (!id) return;
      setLoading(true);
      const res = await api.getCentralIdentityOrg(
        {orgId: id}
      );
      if (res.data.err || !res.data.org) {
        handleGlobalError("Failed to load organization data.");
        setOrganization(null);
        return;
      }
      setOrganization(res.data.org);
      setEditedName(res.data.org.name || "");
      setOriginalName(res.data.org.name || "");
    } catch (err) {
      handleGlobalError(err);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (!organization) return;
      const res = await api.patchCentralIdentityOrg(
        {
          orgId: organization.id,
          name: editedName
        }
      );
      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to update organization.");
      } else {
        setOriginalName(editedName);
        loadOrganization(); 
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  if (!isSuperAdmin) {
    return (
      <Message negative>
        <Message.Header>Access Denied</Message.Header>
        <p>You must be a Superadmin to access this page.</p>
      </Message>
    );
  }

  if (loading) {
    return (
      <Segment style={{ minHeight: "200px" }}>
        <Dimmer active inverted>
          <Loader inverted content="Loading..." />
        </Dimmer>
      </Segment>
    );
  }

  if (!organization) {
    return (
      <Grid className="controlpanel-container" centered>
        <Grid.Column width={16} textAlign="center">
          <Segment placeholder>
            <Header icon>
              <Icon name="warning sign" />
              Organization Not Found
            </Header>
            <p>The requested organization could not be found or you do not have permission to view it.</p>
            <Button as={Link} to="/controlpanel/libreone/orgs" primary style={{ marginTop: '2.5rem' }}>
              Back to Organizations & Systems
            </Button>
          </Segment>
        </Grid.Column>
      </Grid>
    );
  }

  const { logo, created_at, updated_at } = organization;

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Edit Organization
          </Header>
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
                <Breadcrumb.Section as={Link} to="/controlpanel/libreone">
                  LibreOne Admin Console
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to="/controlpanel/libreone/orgs">
                  Organizations & Systems
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Edit Organization
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment loading={loading}>
              <Grid columns={2} stackable>
                <Grid.Column width={4}>
                  <Image
                    src={logo || DEFAULT_LOGO_URL}
                    size="medium"
                    bordered
                    style={{ marginBottom: "1em" }}
                  />
                </Grid.Column>
                <Grid.Column width={12}>
                  <Header sub>Name</Header>
                  <Input
                    fluid
                    placeholder="Organization Name"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    style={{ marginBottom: "1em" }}
                  />

                  <Header sub>Created At</Header>
                  <p>{created_at ? format(parseISO(created_at), "MM/dd/yyyy hh:mm aa") : "N/A"}</p>

                  <Header sub>Last Updated At</Header>
                  <p>{updated_at ? format(parseISO(updated_at), "MM/dd/yyyy hh:mm aa") : "N/A"}</p>
                </Grid.Column>
              </Grid>
            </Segment>
            <Segment>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Button onClick={() => history.goBack()}>
                  <Icon name="arrow left" /> Back
                </Button>
                <div>
                  <Button
                    color="grey"
                    onClick={() => setEditedName(originalName)}
                    disabled={editedName === originalName}
                    style={{ marginRight: "0.5em" }}
                  >
                    <Icon name="cancel" /> Cancel
                  </Button>
                  <Button
                    color="green"
                    onClick={handleSave}
                    disabled={editedName === originalName}
                  >
                    <Icon name="save" /> Save
                  </Button>
                </div>
              </div>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityOrganizationView;