import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Loader,
  Table,
  Icon,
  Button,
} from "semantic-ui-react";
import { CentralIdentityService } from "../../../../types";
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";

const StoreManager = () => {
  //Global State
  const { handleGlobalError } = useGlobalError();

  //UI
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const TABLE_COLS = [
    { key: "name", text: "Name" },
    { key: "service_Id", text: "ID" },
    { key: "actions", text: "Actions" },
  ];

  //Data
  const [services, setServices] = useState<CentralIdentityService[]>([]);
  const [selectedService, setSelectedService] =
    useState<CentralIdentityService | null>(null);

  //Effects
  useEffect(() => {
    getServices();
  }, []);

  async function getServices() {
    try {
      setLoading(true);
      const res = await axios.get("/central-identity/services");
      if (
        res.data.err ||
        !res.data.services ||
        !Array.isArray(res.data.services) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving services");
      }

      // console.log(res.data.services);
      setServices(res.data.services);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectService(service: CentralIdentityService) {
    setSelectedService(service);
    setShowUserModal(true);
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreTexts Store Management
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
                  LibreOne Admin Consoles
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Services</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            {loading && (
              <Segment>
                <Loader active inline="centered" />
              </Segment>
            )}

            {true ? (
              <Segment>
                <h2>THIS PAGE COMING SOON</h2>
              </Segment>
            ) : (
              <>
                <Segment>
                  <PaginationWithItemsSelect
                    activePage={activePage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPageFn={setItemsPerPage}
                    setActivePageFn={setActivePage}
                    totalLength={services.length}
                  />
                </Segment>
                <Segment>
                  <Table striped celled>
                    <Table.Header>
                      <Table.Row>
                        {TABLE_COLS.map((item) => (
                          <Table.HeaderCell key={item.key}>
                            <span>{item.text}</span>
                          </Table.HeaderCell>
                        ))}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {services.length > 0 &&
                        services.map((s) => {
                          return (
                            <Table.Row
                              key={s.service_Id}
                              className="word-break-all"
                            >
                              <Table.Cell>
                                <span>{s.name}</span>
                              </Table.Cell>
                              <Table.Cell>
                                <span>{s.service_Id}</span>
                              </Table.Cell>
                              <Table.Cell>
                                <Button
                                  color="blue"
                                  onClick={() => handleSelectService(s)}
                                >
                                  <Icon name="eye" />
                                  View Service
                                </Button>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      {services.length === 0 && (
                        <Table.Row>
                          <Table.Cell colSpan={TABLE_COLS.length + 1}>
                            <p className="text-center">
                              <em>No results found.</em>
                            </p>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                </Segment>
                <Segment>
                  <PaginationWithItemsSelect
                    activePage={activePage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPageFn={setItemsPerPage}
                    setActivePageFn={setActivePage}
                    totalLength={services.length}
                  />
                </Segment>
              </>
            )}
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default StoreManager;
