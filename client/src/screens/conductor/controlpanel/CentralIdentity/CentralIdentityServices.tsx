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
  Dropdown,
  Input,
} from "semantic-ui-react";
import { CentralIdentityService } from "../../../../types";
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import ViewServiceDetailsModal from "../../../../components/controlpanel/CentralIdentity/ViewServiceDetailsModal";
import useDebounce from "../../../../hooks/useDebounce";
import { useTypedSelector } from "../../../../state/hooks";
import api from "../../../../api";

const CentralIdentityServices = () => {
  //Global State
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  //UI
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchInput, setSearchInput] = useState<string>(""); 
  const [searchString, setSearchString] = useState<string>(""); 
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [sortChoice, setSortChoice] = useState<string>("name");
  const TABLE_COLS = [
    { key: "name", text: "Name" },
    { key: "service_Id", text: "ID" },
    { key: "actions", text: "Actions" },
  ];
  const sortOptions = [
    { key: "name", text: "Sort by Name", value: "name" },
    { key: "service_Id", text: "Sort by Service URL", value: "service_Id" },
  ];

  //Data
  const [services, setServices] = useState<CentralIdentityService[]>([]);
  const [selectedService, setSelectedService] =
    useState<CentralIdentityService | null>(null);

  //Permissions
  const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);

  //Effects
  useEffect(() => {
    if (isSuperAdmin){
      getServices(searchString);
    }
  }, [activePage, itemsPerPage, searchString, sortChoice]);

  const getServicesDebounced = debounce(
    (searchVal: string) => setSearchString(searchVal),
    250
  );

  function refreshServices() {
    getServices(searchString);
  }

  async function getServices(searchString: string) {
    try {
      setLoading(true);
      const res = await api.getCentralIdentityServices({
        activePage,
        limit: itemsPerPage,
        query: searchString,
        sort: sortChoice
      })
      if (
        res.data.err ||
        !res.data.services ||
        !Array.isArray(res.data.services) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving services");
      }

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
            LibreOne Admin Console: Services
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
            <Segment>
               <Grid>
                 <Grid.Row>
                  <Grid.Column width={11}>
                     <Dropdown
                       placeholder="Sort by..."
                       floating
                       selection
                       button
                       options={sortOptions}
                       onChange={(_e, { value }) => {
                         setSortChoice(value as string);
                       }}
                       value={sortChoice}
                     />
                   </Grid.Column>
                   <Grid.Column width={5}>
                     <Input
                       icon="search"
                       placeholder="Search by Name or ID..."
                       onChange={(e) => {
                         setSearchInput(e.target.value);
                         getServicesDebounced(e.target.value);
                       }}
                       value={searchInput}
                       fluid
                    />
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </Segment>
            {loading && (
              <Segment>
                <Loader active inline="centered" />
              </Segment>
            )}

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
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
      <ViewServiceDetailsModal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        service={selectedService}
        onServiceUpdated={refreshServices}
      />
    </Grid>
  );
};

export default CentralIdentityServices;