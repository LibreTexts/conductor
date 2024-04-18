import { useState, useEffect, lazy } from "react";
import { Link } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Table,
  Icon,
  Button,
  Dropdown,
  Input,
} from "semantic-ui-react";
import { Author } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import useDebounce from "../../../../hooks/useDebounce";
import api from "../../../../api";
const ManagePersonModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/PeopleManager/ManagePersonModal"
    )
);
const BulkAddPeopleModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/PeopleManager/BulkAddPeopleModal"
    )
);

const PeopleManager = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  //UI
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortChoice, setSortChoice] = useState<string>("firstName");
  const [searchString, setSearchString] = useState<string>("");
  const TABLE_COLS = [
    { key: "firstName", text: "First Name" },
    { key: "lastName", text: "Last Name" },
    { key: "email", text: "Email" },
    { key: "primaryInstitution", text: "Primary Institution" },
    { key: "Actions", text: "Actions" },
  ];

  const sortOptions = [
    { key: "firstName", text: "Sort by First Name", value: "firstName" },
    { key: "lastName", text: "Sort by Last Name", value: "lastName" },
    { key: "email", text: "Sort by Email", value: "email" },
  ];

  //Data
  const [people, setPeople] = useState<Author[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(
    undefined
  );
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState<boolean>(false);

  //Effects
  useEffect(() => {
    getPeople(searchString);
  }, [activePage, itemsPerPage, sortChoice]);

  // Handlers & Methods
  async function getPeople(searchString?: string) {
    try {
      setLoading(true);

      const res = await api.getAuthors({
        page: activePage,
        limit: itemsPerPage,
        query: searchString,
        sort: sortChoice ? sortChoice : undefined,
      });

      if (
        res.data.err ||
        !res.data.authors ||
        !Array.isArray(res.data.authors) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving authors");
      }

      setPeople(res.data.authors);
      setTotalItems(res.data.totalCount);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const getPeopleDebounced = debounce((searchVal: string) => {
    setActivePage(1); // reset to first page when query changes
    getPeople(searchVal);
  }, 500);

  function handleSelectPerson(id?: string) {
    if (!id) return;
    setSelectedPersonId(id);
    setShowManageModal(true);
  }

  function handleCloseManageModal() {
    setSelectedPersonId(undefined);
    getPeople(searchString);
    setShowManageModal(false);
  }

  function handleCloseBulkAddModal() {
    setSelectedPersonId(undefined);
    setShowBulkAddModal(false);
    getPeople(searchString);
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            People Manager
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <div className="flex flex-row justify-between items-center">
                <Breadcrumb>
                  <Breadcrumb.Section as={Link} to="/controlpanel">
                    Control Panel
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section active>People Manager</Breadcrumb.Section>
                </Breadcrumb>
                <div>
                  <Button
                    color="blue"
                    onClick={() => setShowBulkAddModal(true)}
                    size="small"
                  >
                    <Icon name="file alternate outline" />
                    Bulk Add
                  </Button>
                  <Button
                    color="green"
                    onClick={() => setShowManageModal(true)}
                    size="small"
                    className="ml-2"
                  >
                    <Icon name="plus" />
                    Add Person
                  </Button>
                </div>
              </div>
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
                      placeholder="Search by First, Last, or Email"
                      onChange={(e) => {
                        setSearchString(e.target.value);
                        getPeopleDebounced(e.target.value.trim());
                      }}
                      value={searchString}
                      fluid
                    />
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </Segment>
            <Segment loading={loading}>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={totalItems}
              />
            </Segment>
            <Segment loading={loading}>
              <Table striped celled selectable>
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
                  {people.length > 0 &&
                    people.map((p) => {
                      return (
                        <Table.Row
                          key={crypto.randomUUID()}
                          className="word-break-all"
                        >
                          <Table.Cell>
                            <span>{p.firstName} </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{p.lastName}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{p.email}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{p.primaryInstitution}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              color="blue"
                              onClick={() => handleSelectPerson(p._id)}
                            >
                              <Icon name="edit outline" />
                              Edit
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {people.length === 0 && (
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
            <Segment loading={loading}>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={totalItems}
              />
            </Segment>
          </Segment.Group>
          <ManagePersonModal
            show={showManageModal}
            onClose={handleCloseManageModal}
            personID={selectedPersonId}
          />
          <BulkAddPeopleModal
            open={showBulkAddModal}
            onClose={handleCloseBulkAddModal}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default PeopleManager;
