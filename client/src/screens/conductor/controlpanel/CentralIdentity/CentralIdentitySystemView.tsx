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
  Table,
} from "semantic-ui-react";
import { CentralIdentitySystem, CentralIdentityOrg } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { format, parseISO } from "date-fns";
import { useTypedSelector } from "../../../../state/hooks";
import CreateOrgModal from "../../../../components/controlpanel/CentralIdentity/CreateOrgModal";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import api from "../../../../api";

const CentralIdentitySystemView = () => {
  const { systemId } = useParams<{ systemId: string }>();
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [loading, setLoading] = useState<boolean>(false);
  const [system, setSystem] = useState<CentralIdentitySystem | null>(null);
  const DEFAULT_AVATAR_LOGO_URL = "https://cdn.libretexts.net/DefaultImages/system_logo.png";

  const [editedName, setEditedName] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  // Pagination states
  const [orgsPage, setOrgsPage] = useState(1);
  const [allOrganizations, setAllOrganizations] = useState<CentralIdentityOrg[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (systemId && isSuperAdmin) {
      loadSystem();
    }
  }, [systemId, isSuperAdmin]);

  async function loadSystem() {
    try {
      if (!systemId) return;
      setLoading(true);
      const res = await api.getCentralIdentitySystem(
        {systemId: systemId}
      );
      if (res.data.err || !res.data.system) {
        handleGlobalError("Failed to load system data.");
        setSystem(null);
        return;
      }
      setSystem(res.data.system);
      setEditedName(res.data.system.name || "");
      setOriginalName(res.data.system.name || "");
      setAllOrganizations(res.data.system.organizations || []);
    } catch (err) {
      handleGlobalError(err);
      setSystem(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (!system) return;
      const res = await api.putCentralIdentitySystem(
        { 
          systemId: systemId,
          name: editedName,
          logo: DEFAULT_AVATAR_LOGO_URL
        }
      );
      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "Failed to update system.");
      } else {
        setOriginalName(editedName);
        loadSystem(); 
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  function handleAddOrganization() {
    setShowCreateOrgModal(true);
  }

  // Calculate paginated organizations
  const paginatedOrganizations = allOrganizations.slice(
    (orgsPage - 1) * itemsPerPage,
    orgsPage * itemsPerPage
  );

  if (!isSuperAdmin) {
    return (
      <Message negative>
        <Message.Header>Access Denied</Message.Header>
        <p>You must be a Superadmin to access this page.</p>
      </Message>
    );
  }

  if (loading && !system) {
    return (
      <Segment style={{ minHeight: "200px" }}>
        <Dimmer active inverted>
          <Loader inverted content="Loading..." />
        </Dimmer>
      </Segment>
    );
  }

  if (!system) {
    return (
      <Grid className="controlpanel-container" centered>
        <Grid.Column width={16} textAlign="center">
          <Segment placeholder>
            <Header icon>
              <Icon name="warning sign" />
              System Not Found
            </Header>
            <p>The requested system could not be found or you do not have permission to view it.</p>
            <Button as={Link} to="/controlpanel/libreone/orgs" primary style={{ marginTop: '2.5rem' }}>
              Back to Organizations & Systems
            </Button>
          </Segment>
        </Grid.Column>
      </Grid>
    );
  }

  const { logo, created_at, updated_at } = system;

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Edit System
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
                  Edit System
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment loading={loading}>
              <Grid columns={2} stackable>
                <Grid.Column width={4}>
                  <Image
                    src={logo || DEFAULT_AVATAR_LOGO_URL}
                    size="medium"
                    bordered
                    style={{ marginBottom: "1em" }}
                  />
                </Grid.Column>
                <Grid.Column width={12}>
                  <Header sub>Name</Header>
                  <Input
                    fluid
                    placeholder="System Name"
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1em" }}>
                <Header as="h3" style={{ margin: 0 }}>
                  Organizations in this System
                </Header>
                <Button
                  color="blue"
                  icon
                  labelPosition="left"
                  onClick={handleAddOrganization}
                >
                  <Icon name="plus" />
                  Add Organization
                </Button>
              </div>
            </Segment>
              <Segment>
                {allOrganizations.length > 0 && (
                  <PaginationWithItemsSelect
                    itemsPerPage={itemsPerPage}
                    setItemsPerPageFn={setItemsPerPage}
                    activePage={orgsPage}
                    setActivePageFn={setOrgsPage}
                    totalPages={Math.ceil(allOrganizations.length / itemsPerPage)}
                    totalLength={allOrganizations.length}
                  />
                )}
              </Segment>
              <Segment>
              <Table celled>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell width={2}>Logo</Table.HeaderCell>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Created</Table.HeaderCell>
                    <Table.HeaderCell>Updated</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {paginatedOrganizations.length > 0 ? (
                    paginatedOrganizations.map((org: CentralIdentityOrg) => (
                      <Table.Row key={org.id}>
                        <Table.Cell textAlign="center">
                            {org.logo ? (
                            <a 
                                href={org.logo} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ cursor: 'pointer' }}
                            >
                                <img
                                src={org.logo}
                                alt={`${org.name} logo`}
                                style={{ 
                                    width: 32, 
                                    height: 32, 
                                    objectFit: "contain",
                                    display: "inline-block" 
                                }}
                                />
                            </a>
                            ) : (
                            <Icon name="image outline" size="large" />
                            )}
                        </Table.Cell>
                        <Table.Cell>{org.name}</Table.Cell>
                        <Table.Cell>
                          {org.created_at
                            ? format(parseISO(org.created_at), "MM/dd/yyyy")
                            : "N/A"}
                        </Table.Cell>
                        <Table.Cell>
                          {org.updated_at
                            ? format(parseISO(org.updated_at), "MM/dd/yyyy")
                            : "N/A"}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            as={Link}
                            to={`/controlpanel/libreone/orgs/org/${org.id}`}
                            icon
                            color="blue"
                            size="tiny"
                          >
                            <Icon name="edit" />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={4} textAlign="center">
                        <em>No organizations in this system</em>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
              {allOrganizations.length > 0 && (
                <PaginationWithItemsSelect
                  itemsPerPage={itemsPerPage}
                  setItemsPerPageFn={setItemsPerPage}
                  activePage={orgsPage}
                  setActivePageFn={setOrgsPage}
                  totalPages={Math.ceil(allOrganizations.length / itemsPerPage)}
                  totalLength={allOrganizations.length}
                />
              )}
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

      <CreateOrgModal
        show={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onCreated={() => {
          setShowCreateOrgModal(false);
          loadSystem();
        }}
        systemId={system.id}
      />
    </Grid>
  );
};

export default CentralIdentitySystemView;