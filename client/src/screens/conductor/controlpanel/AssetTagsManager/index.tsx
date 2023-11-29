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
  Confirm,
  Label,
} from "semantic-ui-react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import useDebounce from "../../../../hooks/useDebounce";
import api from "../../../../api";
import {
  AssetTagFramework,
  AssetTagFrameworkWithCampusDefault,
} from "../../../../types";
import { truncateString } from "../../../../components/util/HelperFunctions";
import { useTypedSelector } from "../../../../state/hooks";
import { isCallChain } from "typescript";
const ManageFrameworkModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/AssetTagsManager/ManageFrameworkModal"
    )
);
const ConfirmSetOrgDefault = lazy(
  () =>
    import(
      "../../../../components/controlpanel/AssetTagsManager/ConfirmSetOrgDefault"
    )
);

const AssetTagsManager: React.FC<{}> = ({}) => {
  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const org = useTypedSelector((state) => state.org);

  // Data & UI
  const [frameworks, setFrameworks] = useState<
    AssetTagFrameworkWithCampusDefault[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [defaultToSet, setDefaultToSet] = useState<string>("");
  const [showConfirmSetOrgDefault, setShowConfirmSetOrgDefault] =
    useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortChoice, setSortChoice] = useState<string>("");
  const [searchString, setSearchString] = useState<string>("");
  const [showManageFrameworkModal, setShowManageFrameworkModal] =
    useState<boolean>(false);
  const [manageFrameworkMode, setManageFrameworkMode] = useState<
    "create" | "edit"
  >("create");
  const [manageFrameworkId, setManageFrameworkId] = useState<string>("");

  const TABLE_COLS = [
    { key: "name", text: "Framework Name" },
    { key: "descrip", text: "Description" },
    { key: "status", text: "Status" },
    { key: "actions", text: "Actions" },
  ];

  const sortOptions = [
    { key: "name", text: "Sort by Framework Name", value: "name" },
    { key: "status", text: "Sort by Status", value: "status" },
  ];

  useEffect(() => {
    getFrameworks(searchString);
  }, [activePage, itemsPerPage]);

  // Handlers & Methods
  async function getFrameworks(searchString?: string) {
    try {
      setLoading(true);

      const res = await api.getFrameworks({
        page: activePage,
        limit: itemsPerPage,
        query: searchString,
        sort: sortChoice,
      });

      if (
        res.data.err ||
        !res.data.frameworks ||
        !Array.isArray(res.data.frameworks) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving users");
      }

      setFrameworks(res.data.frameworks);
      setTotalItems(res.data.totalCount);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const getFrameworksDebounced = debounce(
    (searchVal: string) => getFrameworks(searchVal),
    500
  );

  async function setAsOrgDefault(id: string) {
    try {
      setLoading(true);

      const res = await api.setAsCampusDefaultFramework(org.orgID, id);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      getFrameworks(searchString);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
      setDefaultToSet(""); // Reset
      setShowConfirmSetOrgDefault(false);
    }
  }

  function handleOpenManageFrameworkModal(
    mode: "create" | "edit",
    id?: string
  ) {
    setManageFrameworkMode(mode);
    if (mode === "edit" && id) {
      setManageFrameworkId(id);
    }
    if (mode === "create") {
      setManageFrameworkId("");
    }
    setShowManageFrameworkModal(true);
  }

  function handleCloseManageFrameworkModal() {
    setShowManageFrameworkModal(false);
    setManageFrameworkMode("create");
    setManageFrameworkId("");
    getFrameworks(searchString); // Refresh data
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Asset Tagging Framework Manager
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment className="flex justify-between align-middle">
              <div>
                <Breadcrumb>
                  <Breadcrumb.Section as={Link} to="/controlpanel">
                    Control Panel
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section active>
                    Asset Tagging Framework Manager
                  </Breadcrumb.Section>
                </Breadcrumb>
              </div>
              <div>
                <Button
                  color="green"
                  onClick={() => handleOpenManageFrameworkModal("create")}
                >
                  <Icon name="plus" />
                  New Framework
                </Button>
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
                      disabled={true}
                    />
                  </Grid.Column>
                  <Grid.Column width={5}>
                    <Input
                      icon="search"
                      placeholder="Search by Name"
                      onChange={(e) => {
                        setSearchString(e.target.value);
                        getFrameworksDebounced(e.target.value);
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
                  {frameworks.length > 0 &&
                    frameworks.map((f) => {
                      return (
                        <Table.Row key={f.uuid} className="word-break-all">
                          <Table.Cell>
                            <span>{f.name}</span>
                            {
                              f.isCampusDefault && (
                                <Label color="teal" size="tiny" className="!ml-3" basic>
                                  Campus Default
                                </Label>
                              )
                            }
                          </Table.Cell>
                          <Table.Cell>
                            <span>{truncateString(f.description, 75)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{f.enabled ? "Enabled" : "Disabled"}</span>
                          </Table.Cell>
                          <Table.Cell textAlign="right">
                            {!f.isCampusDefault && (
                              <Button
                                color="teal"
                                onClick={() => {
                                  setDefaultToSet(f.uuid);
                                  setShowConfirmSetOrgDefault(true);
                                }}
                              >
                                <Icon name="university" />
                                Set as Campus Default
                              </Button>
                            )}
                            <Button
                              color="blue"
                              onClick={() =>
                                handleOpenManageFrameworkModal("edit", f.uuid)
                              }
                            >
                              <Icon name="edit" />
                              Edit
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {frameworks.length === 0 && (
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
        </Grid.Column>
      </Grid.Row>
      <ManageFrameworkModal
        open={showManageFrameworkModal}
        mode={manageFrameworkMode}
        id={manageFrameworkId}
        onClose={() => handleCloseManageFrameworkModal()}
      />
      <ConfirmSetOrgDefault
        show={showConfirmSetOrgDefault}
        selectedUUID={defaultToSet}
        onClose={() => {
          setShowConfirmSetOrgDefault(false);
          setDefaultToSet("");
        }}
        onConfirm={() => setAsOrgDefault(defaultToSet)}
      />
    </Grid>
  );
};

export default AssetTagsManager;
