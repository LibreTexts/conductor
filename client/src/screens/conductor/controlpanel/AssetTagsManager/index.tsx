import { useState, useEffect } from "react";
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
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import useDebounce from "../../../../hooks/useDebounce";

const AssetTagsManager: React.FC<{}> = ({}) => {
  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [temprItems, setTemprItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortChoice, setSortChoice] = useState<string>("");
  const [searchString, setSearchString] = useState<string>("");

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
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Asset Tagging Framework Manager
                </Breadcrumb.Section>
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
                  {temprItems.length > 0 &&
                    temprItems.map((user) => {
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
                            <Button color="blue">
                              <Icon name="eye" />
                              View User
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {temprItems.length === 0 && (
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
    </Grid>
  );
};

export default AssetTagsManager;
