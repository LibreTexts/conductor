import { useState, useEffect} from "react";
import * as React from "react";
import { Link, useHistory } from "react-router-dom";
import {
  Table,
  Button,
  Icon,
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Modal,
  Message,
} from "semantic-ui-react";
import { CentralIdentityOrg, CentralIdentitySystem } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useTypedSelector } from "../../../../state/hooks";
import CreateSystemModal from "../../../../components/controlpanel/CentralIdentity/CreateSystemModal";
import CreateOrgModal from "../../../../components/controlpanel/CentralIdentity/CreateOrgModal";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import api from "../../../../api";

const CentralIdentityOrgs = () => {
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [systems, setSystems] = useState<CentralIdentitySystem[]>([]);
  const [organizations, setOrganizations] = useState<CentralIdentityOrg[]>([]);
  const [expandedSystemIds, setExpandedSystemIds] = useState<number[]>([]);
  const [showCreateSystemModal, setShowCreateSystemModal] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
      setTotalPages(
        Math.ceil(
          (systems.length + organizations.length) / itemsPerPage
        )
      );
    }
  }, [activePage, itemsPerPage, isSuperAdmin]);

  async function loadData() {
    try {
      setLoading(true);
      const [systemsRes, orgsRes] = await Promise.all([
        await api.getCentralIdentitySystems(),
        await api.getCentralIdentityOrgs()
      ]);
  
      const systemsData = systemsRes.data.systems || [];
      const orgsData = (orgsRes.data.orgs as CentralIdentityOrg[]).filter((org) => !org.system);
      setSystems(systemsData);
      setOrganizations(orgsData);
      setTotalPages(
        Math.ceil(
          (systemsData.length + orgsData.length) / itemsPerPage
        )
      );
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSystemExpand(systemId: number) {
    setExpandedSystemIds((prev) =>
      prev.includes(systemId)
        ? prev.filter((id) => id !== systemId)
        : [...prev, systemId]
    );
  }

  function handleEdit(type: "org" | "system", id: number) {
    history.push(
      `/controlpanel/libreone/orgs/${type === "org" ? "org" : "system"}/${id}`
    );
  }

  const handlePageChange = (page: number) => {
    setActivePage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setActivePage(1);
  };

  const getPaginatedData = () => {
    const startIndex = (activePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    const allItems = [
      ...systems.map(system => ({
        ...system,
        type: 'system' as const
      })),
      ...organizations.map(org => ({
        ...org,
        type: 'org' as const
      }))
    ];
    
    return allItems.slice(startIndex, endIndex);
  };

  if (!isSuperAdmin) {
    return (
      <Message negative>
        <Message.Header>Access Denied</Message.Header>
        <p>You must be a Superadmin to access this page.</p>
      </Message>
    );
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreOne Admin Console: Organizations & Systems
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
                <Breadcrumb.Section active>
                  Organizations & Systems
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <Button
                color="blue"
                onClick={() => setShowCreateSystemModal(true)}
              >
                <Icon name="plus" />
                New System
              </Button>
              <Button
                color="blue"
                onClick={() => setShowCreateOrgModal(true)}
                style={{ marginLeft: "10px" }}
              >
                <Icon name="plus" />
                New Organization
              </Button>
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={handleItemsPerPageChange}
                setActivePageFn={handlePageChange}
                totalLength={systems.length + organizations.length}
              />
            </Segment>
            <Segment loading={loading}>
              <Table celled>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell width={1} textAlign="center"></Table.HeaderCell>
                    <Table.HeaderCell width={2}>Logo</Table.HeaderCell>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {getPaginatedData().map((item) => {
                    if (item.type === 'system') {
                      return (
                        <React.Fragment key={`system-${item.id}`}>
                          <Table.Row>
                            <Table.Cell collapsing>
                              <Icon
                                name={
                                  expandedSystemIds.includes(item.id)
                                    ? "chevron down"
                                    : "chevron right"
                                }
                                link
                                onClick={() => toggleSystemExpand(item.id)}
                              />
                            </Table.Cell>
                            <Table.Cell textAlign="center">
                              {item.logo ? (
                                <a 
                                  href={item.logo} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ cursor: 'pointer' }}
                                >
                                  <img
                                    src={item.logo}
                                    alt={`${item.name} logo`}
                                    style={{ width: 32, height: 32, objectFit: "contain", display: "inline-block" }}
                                  />
                                </a>
                              ) : (
                                <Icon name="image outline" size="large" />
                              )}
                            </Table.Cell>
                            <Table.Cell>
                              <b>{item.name}</b>
                            </Table.Cell>
                            <Table.Cell>System</Table.Cell>
                            <Table.Cell>
                              <Button
                                icon
                                color="blue"
                                size="tiny"
                                onClick={() => handleEdit("system", item.id)}
                              >
                                <Icon name="edit" />
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                          {expandedSystemIds.includes(item.id) &&
                            item.organizations &&
                            item.organizations.map((org) => (
                              <Table.Row key={`org-${org.id}`}>
                                <Table.Cell />
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
                                        style={{ width: 32, height: 32, objectFit: "contain", display: "inline-block"  }}
                                      />
                                    </a>
                                  ) : (
                                    <Icon name="image outline" size="large" />
                                  )}
                                </Table.Cell>
                                <Table.Cell style={{ paddingLeft: 40 }}>
                                  {org.name}
                                </Table.Cell>
                                <Table.Cell>Organization</Table.Cell>
                                <Table.Cell>
                                  <Button
                                    icon
                                    color="blue"
                                    size="tiny"
                                    onClick={() => handleEdit("org", org.id)}
                                  >
                                    <Icon name="edit" />
                                  </Button>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                        </React.Fragment>
                      );
                    } else {
                      return (
                        <Table.Row key={`org-${item.id}`}>
                          <Table.Cell />
                          <Table.Cell textAlign="center">
                            {item.logo ? (
                              <a 
                                href={item.logo} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ cursor: 'pointer' }}
                              >
                                <img
                                  src={item.logo}
                                  alt={`${item.name} logo`}
                                  style={{ width: 32, height: 32, objectFit: "contain", display: "inline-block" }}
                                />
                              </a>
                            ) : (
                              <Icon name="image outline" size="large" />
                            )}
                          </Table.Cell>
                          <Table.Cell>{item.name}</Table.Cell>
                          <Table.Cell>Organization</Table.Cell>
                          <Table.Cell>
                            <Button
                              icon
                              color="blue"
                              size="tiny"
                              onClick={() => handleEdit("org", item.id)}
                            >
                              <Icon name="edit" />
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    }
                  })}
                </Table.Body>
              </Table>
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={handleItemsPerPageChange}
                setActivePageFn={handlePageChange}
                totalLength={systems.length + organizations.length}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>

      <CreateSystemModal
        show={showCreateSystemModal}
        onClose={() => setShowCreateSystemModal(false)}
        onCreated={() => {
          setShowCreateSystemModal(false);
          loadData();
        }}
      />
      
      <CreateOrgModal
        show={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onCreated={() => {
          setShowCreateOrgModal(false);
          loadData();
        }}
      />
    </Grid>
  );
};

export default CentralIdentityOrgs;