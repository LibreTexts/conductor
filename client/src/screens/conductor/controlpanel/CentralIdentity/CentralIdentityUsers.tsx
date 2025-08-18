import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Dropdown,
  Input,
} from "semantic-ui-react";
import Breakpoint from "../../../../components/util/Breakpoints";
import { CentralIdentityUser } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import {
  getPrettyAuthSource,
  getPrettyUserType,
  getPrettyVerficationStatus,
  academyOnlineAccessLevels,
  getPrettyAcademyOnlineAccessLevel,
} from "../../../../utils/centralIdentityHelpers";
import useDebounce from "../../../../hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import api from "../../../../api";
import SearchableDropdown from "../../../../components/util/SearchableDropdown";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import { IconLockExclamation } from "@tabler/icons-react";

const CentralIdentityUsers = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  //UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [sortChoice, setSortChoice] = useState<string>("first");
  const [searchInput, setSearchInput] = useState<string>(""); // For debouncing
  const [searchString, setSearchString] = useState<string>(""); // For the actual search
  const [academyFilters, setAcademyFilters] = useState<string[]>([]);
  const [adminRoleFilters, setAdminRoleFilters] = useState<string[]>([]);

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

  const adminRoleOptions = [
    { value: "org_admin", label: "Org Admin" },
    { value: "org_sys_admin", label: "Org Sys Admin" },
  ];

  const academyOptions = academyOnlineAccessLevels.map((o) => ({
    value: String(o.value),
    label: `${o.value} - ${o.text}`,
  }));

  //Data
  const { data: users, isLoading } = useQuery<CentralIdentityUser[]>({
    queryKey: [
      "central-identity-users",
      activePage,
      itemsPerPage,
      sortChoice,
      searchString,
      academyFilters,
      adminRoleFilters,
    ],
    queryFn: () =>
      getUsers({
        activePage,
        itemsPerPage,
        searchString,
        sortChoice,
      }),
    keepPreviousData: true,
  });

  // Handlers & Methods
  async function getUsers({
    activePage,
    itemsPerPage,
    searchString,
    sortChoice,
  }: {
    activePage: number;
    itemsPerPage: number;
    searchString: string;
    sortChoice: string;
  }) {
    try {
      const res = await api.getCentralIdentityUsers({
        page: activePage,
        limit: itemsPerPage,
        query: searchString,
        sort: sortChoice,
        academy_online: academyFilters.map(Number),
        admin_role: adminRoleFilters,
      });

      if (
        res.data.err ||
        !res.data.users ||
        !Array.isArray(res.data.users) ||
        res.data.total === undefined
      ) {
        throw new Error("Error retrieving users");
      }

      setTotalItems(res.data.total);
      setTotalPages(Math.ceil(res.data.total / itemsPerPage));

      return res.data.users;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const getUsersDebounced = debounce((searchVal: string) => {
    setActivePage(1); // Reset to first page on new search
    setSearchString(searchVal);
  }, 250);

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
                    <div className="flex flex-row gap-2 flex-wrap">
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
                      <SearchableDropdown
                        options={academyOptions}
                        placeholder="Filter by Academy Online Access..."
                        multiple
                        value={academyFilters}
                        onChange={(value) =>
                          setAcademyFilters(Array.isArray(value) ? value : [])
                        }
                      />
                      <SearchableDropdown
                        options={adminRoleOptions}
                        placeholder="Filter by Admin Role..."
                        multiple
                        value={adminRoleFilters}
                        onChange={(value) =>
                          setAdminRoleFilters(Array.isArray(value) ? value : [])
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {academyFilters.map((filter) => (
                        <span
                          key={filter}
                          className="bg-gray-200 text-gray-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center"
                        >
                          {academyOptions.find((o) => o.value === filter)
                            ?.label || filter}
                          <button
                            type="button"
                            className="ml-2 text-gray-500 hover:text-gray-800"
                            onClick={() =>
                              setAcademyFilters(
                                academyFilters.filter((f) => f !== filter)
                              )
                            }
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {adminRoleFilters.map((role) => (
                        <span key={role} className="bg-blue-200 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center">
                          {adminRoleOptions.find(o => o.value === role)?.label || role}
                          <button
                            type="button"
                            className="ml-2 text-blue-500 hover:text-blue-800"
                            onClick={() => setAdminRoleFilters(adminRoleFilters.filter(r => r !== role))}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </Grid.Column>
                  <Grid.Column width={5}>
                    <Input
                      icon="search"
                      placeholder="Search by Name, Email, Student ID, or UUID..."
                      onChange={(e) => {
                        setSearchInput(e.target.value);
                        getUsersDebounced(e.target.value);
                      }}
                      value={searchInput}
                      fluid
                    />
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={totalItems}
              />
            </Segment>
            <Segment>
              <SupportCenterTable<CentralIdentityUser & { actions?: string }>
                data={users}
                loading={isLoading}
                onRowClick={(record) => {
                  window.open(`/controlpanel/libreone/users/${record.uuid}`);
                }}
                columns={[
                  {
                    accessor: "first_name",
                    title: "First Name",
                    render(record) {
                      return (
                        <div className="flex items-center">
                          <span>{record.first_name} </span>
                          {record.disabled && (
                            <IconLockExclamation className="h-5 w-5 ml-1" />
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    accessor: "last_name",
                    title: "Last Name",
                    render(record) {
                      return (
                        <div className="flex items-center">
                          <span>{record.last_name} </span>
                          {record.disabled && (
                            <IconLockExclamation className="h-5 w-5 ml-1" />
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    accessor: "email",
                    render(record) {
                      return (
                        <div className="flex items-center">
                          <span>{record.email} </span>
                          {record.disabled && (
                            <IconLockExclamation className="h-5 w-5 ml-1" />
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    accessor: "user_type",
                    title: "User Type",
                    render(record) {
                      return getPrettyUserType(record.user_type);
                    },
                  },
                  {
                    accessor: "verify_status",
                    title: "Verification Status",
                    render(record) {
                      return record.user_type === "instructor" ? (
                        <span>
                          {getPrettyVerficationStatus(record.verify_status)}
                        </span>
                      ) : (
                        <span className="muted-text">N/A</span>
                      );
                    },
                  },
                  {
                    accessor: "academy_online",
                    title: "Academy Online Access",
                    render(record) {
                      return getPrettyAcademyOnlineAccessLevel(record.academy_online);
                    },
                  },
                  {
                    accessor: "external_idp",
                    title: "Auth Source",
                    render(record) {
                      return (
                        <span>
                          {record.external_idp
                            ? getPrettyAuthSource(record.external_idp)
                            : "LibreOne"}
                          {record.disabled && " (Disabled)"}
                        </span>
                      );
                    },
                  },
                ]}
              />
            </Segment>
            <Segment>
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
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityUsers;
