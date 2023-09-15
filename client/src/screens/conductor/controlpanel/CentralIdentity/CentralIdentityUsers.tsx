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
import { CentralIdentityUser, User } from "../../../../types";
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import ManageUserModal from "../../../../components/controlpanel/CentralIdentity/ManageUserModal";
import {
  getPrettyAuthSource,
  getPrettyUserType,
  getPrettyVerficationStatus,
} from "../../../../utils/centralIdentityHelpers";
import useDebounce from "../../../../hooks/useDebounce";

const CentralIdentityUsers = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  //UI
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortChoice, setSortChoice] = useState<string>("");
  const [searchString, setSearchString] = useState<string>("");
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const TABLE_COLS = [
    { key: "firstName", text: "First Name" },
    { key: "lastName", text: "Last Name" },
    { key: "email", text: "Email" },
    { key: "userType", text: "User Type" },
    { key: "verification", text: "Verification Status" },
    { key: "studentId", text: "Student ID" },
    { key: "Auth Source", text: "Auth Source" },
    { key: "Actions", text: "Actions" },
  ];
  const sortOptions = [
    { key: "first", text: "Sort by First Name", value: "first" },
    { key: "last", text: "Sort by Last Name", value: "last" },
    { key: "email", text: "Sort by Email", value: "email" },
    { key: "auth", text: "Sort by Auth Method", value: "auth" },
  ];

  //Data
  const [users, setUsers] = useState<CentralIdentityUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<CentralIdentityUser | null>(
    null
  );

  //Effects
  useEffect(() => {
    getUsers(searchString);
  }, [activePage, itemsPerPage]);

  // Handlers & Methods
  async function getUsers(searchString?: string) {
    try {
      setLoading(true);

      const res = await axios.get("/central-identity/users", {
        params: {
          activePage,
          query: searchString,
        },
      });

      if (
        res.data.err ||
        !res.data.users ||
        !Array.isArray(res.data.users) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving users");
      }

      setUsers(res.data.users);
      setTotalItems(res.data.totalCount);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const getUsersDebounced = debounce(
    (searchVal: string) => getUsers(searchVal),
    500
  );

  function handleSelectUser(user: CentralIdentityUser) {
    setSelectedUser(user);
    setShowUserModal(true);
  }

  function handleCloseUserModal() {
    setShowUserModal(false);
    setSelectedUser(null);
    getUsers(searchString);
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreOne Admin Console: Users
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
                <Breadcrumb.Section active>Users</Breadcrumb.Section>
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
                      disabled={true}
                    />
                  </Grid.Column>
                  <Grid.Column width={5}>
                    <Input
                      icon="search"
                      placeholder="Search by First, Last, Email, or Student ID..."
                      onChange={(e) => {
                        setSearchString(e.target.value);
                        getUsersDebounced(e.target.value.trim());
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
                  {users.length > 0 &&
                    users.map((user) => {
                      return (
                        <Table.Row key={user.uuid} className="word-break-all">
                          <Table.Cell>
                            <span>
                              {user.first_name}{" "}
                              {user.disabled && (
                                <Icon
                                  name="lock"
                                  className="ml-1p"
                                  size="small"
                                />
                              )}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>
                              {user.last_name}
                              {user.disabled && (
                                <Icon
                                  name="lock"
                                  className="ml-1p"
                                  size="small"
                                />
                              )}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>
                              {user.email}
                              {user.disabled && (
                                <Icon
                                  name="lock"
                                  className="ml-1p"
                                  size="small"
                                />
                              )}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{getPrettyUserType(user.user_type)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            {user.user_type === "instructor" ? (
                              <span>
                                {getPrettyVerficationStatus(user.verify_status)}
                              </span>
                            ) : (
                              <span className="muted-text">N/A</span>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {user.student_id ? (
                              <span>{user.student_id}</span>
                            ) : (
                              <span className="muted-text">N/A</span>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <span>
                              {user.external_idp
                                ? getPrettyAuthSource(user.external_idp)
                                : "LibreOne"}
                              {user.disabled && " (Disabled)"}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              color="blue"
                              onClick={() => handleSelectUser(user)}
                            >
                              <Icon name="eye" />
                              View User
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {users.length === 0 && (
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

          {selectedUser && (
            <ManageUserModal
              show={showUserModal}
              userId={selectedUser.uuid}
              onSave={() => handleCloseUserModal()}
              onClose={() => setShowUserModal(false)}
            />
          )}
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityUsers;
