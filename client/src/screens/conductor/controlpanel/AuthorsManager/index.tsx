import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Icon,
  Dropdown,
  Input,
} from "semantic-ui-react";
import { Author } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import useDebounce from "../../../../hooks/useDebounce";
import api from "../../../../api";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useModals } from "../../../../context/ModalContext";
import Button from "../../../../components/NextGenComponents/Button";
import { truncateString } from "../../../../components/util/HelperFunctions";
import ManageAuthorModal from "../../../../components/controlpanel/AuthorsManager/ManageAuthorModal"
import GenerateTemplateJSONModal from "../../../../components/controlpanel/AuthorsManager/GenerateTemplateJSONModal"

const LIMIT = 25;

const AuthorsManager = () => {
  //Global State & Hooks
  useDocumentTitle("LibreTexts Conductor | Authors Manager");
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const { openModal, closeAllModals } = useModals();

  //UI
  const [sortChoice, setSortChoice] = useState<string>("nameKey");
  const [searchString, setSearchString] = useState<string>("");
  const [activeSearch, setActiveSearch] = useState<string>("");

  const sortOptions = [
    { key: "nameKey", text: "Sort by Name Key", value: "nameKey" },
    { key: "name", text: "Sort by Name", value: "name" },
    { key: "companyName", text: "Sort by Company Name", value: "companyName" },
  ];

  //Data
  const { data, isFetching, isInitialLoading, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ["authors", LIMIT, sortChoice, activeSearch],
      queryFn: async ({ pageParam = null }) => {
        const response = await api.getAuthors({
          limit: LIMIT,
          page: pageParam || 1,
          sort: sortChoice,
          query: activeSearch || undefined,
        });

        if (response.data.err) {
          handleGlobalError(
            response.data.errMsg || "Failed to fetch authors."
          );
          return {
            items: [],
            meta: { total_count: 0, has_more: false, next_page: null },
          };
        }
        return response.data;
      },
      getNextPageParam: (lastPage) => {
        const nextPage = lastPage?.meta?.has_more && lastPage.meta.next_page ? lastPage.meta.next_page : undefined;
        const parsed = parseInt(nextPage as string, 10);
        if (isNaN(parsed)) {
          return undefined;
        }
        return parsed;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    });

  const allData = data?.pages.flatMap((page) => page.items) || [];
  const lastPage = data?.pages[data.pages.length - 1];

  function handleOpenManageModal(authorID?: string) {
    openModal(
      <ManageAuthorModal show onClose={() => closeAllModals()} authorID={authorID} />
    );
  }

  function renderURLField(url?: string) {
    if (!url) return null;

    let parsedURL: URL;
    try {
      parsedURL = new URL(url);
    } catch (error) {
      return null;
    }

    const truncated = truncateString(parsedURL.toString(), 30);

    return parsedURL.hostname ? (
      <a href={parsedURL.toString()} target="_blank" rel="noopener noreferrer">
        {truncated} <Icon name="external alternate" />
      </a>
    ) : null;
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Authors Manager
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
                  <Breadcrumb.Section active>Authors Manager</Breadcrumb.Section>
                </Breadcrumb>
                <div className="flex gap-x-2">
                  <Button
                    color="blue"
                    onClick={() => openModal(<GenerateTemplateJSONModal onClose={() => closeAllModals()} />)}
                    icon="IconCode"
                  >
                    Generate Template JSON
                  </Button>
                  <Button
                    color="green"
                    onClick={() => handleOpenManageModal()}
                    icon="IconPlus"
                  >
                    Add Author
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
                      placeholder="Search by Name Key, Name, or Company"
                      onChange={(e) => {
                        setSearchString(e.target.value);
                        debounce((val: string) => setActiveSearch(val), 300)(e.target.value.trim());
                      }}
                      value={searchString}
                      fluid
                    />
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </Segment>
            <Segment>
              <SupportCenterTable<
                Author & { actions?: string }
              >
                loading={isInitialLoading}
                data={allData || []}
                onRowClick={(author) => {
                  handleOpenManageModal(author._id);
                }}
                columns={[
                  {
                    accessor: "nameKey",
                    title: "Name Key (Unique)",
                    copyButton: true,
                    render(record) {
                      return <span className="font-mono">{truncateString(record.nameKey, 30)}</span>;
                    }
                  },
                  {
                    accessor: "name",
                    title: "Name",
                    render(record, index) {
                      return (
                        <div className="flex items-center gap-x-2">
                          {record.pictureURL && (
                            <img
                              alt={record.name}
                              src={record.pictureURL}
                              className="inline-block size-8 rounded-full outline -outline-offset-1 outline-black/5"
                            />
                          )}
                          <p>{record.name}</p>
                        </div>
                      )
                    },
                  },
                  {
                    accessor: "nameTitle",
                    title: "Name Title",
                  },
                  {
                    accessor: "nameURL",
                    title: "Name URL",
                    render(record) {
                      return renderURLField(record.nameURL);
                    },
                  },
                  {
                    accessor: "companyName",
                    title: "Company Name",
                  },
                  {
                    accessor: "companyURL",
                    title: "Company URL",
                    render(record) {
                      return renderURLField(record.companyURL);
                    },
                  },
                  {
                    accessor: "programName",
                    title: "Program Name",
                  },
                  {
                    accessor: "programURL",
                    title: "Program URL",
                    render(record) {
                      return renderURLField(record.programURL);
                    },
                  },
                ]}
              />
              {lastPage?.meta?.has_more && (
                <div className="flex justify-center mt-4 w-full">
                  <Button
                    onClick={() => fetchNextPage()}
                    loading={isFetching || isInitialLoading}
                    variant="primary"
                    icon="IconDownload"
                  >
                    Load More
                  </Button>
                </div>
              )}
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid >
  );
};

export default AuthorsManager;
