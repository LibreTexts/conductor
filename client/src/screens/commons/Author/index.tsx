import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon, Segment, Header, Breadcrumb, Popup } from "semantic-ui-react";
import useGlobalError from "../../../components/error/ErrorHooks";
import { Author, ProjectFileWProjectData } from "../../../types";
import api from "../../../api";
import VisualMode from "../../../components/commons/CommonsCatalog/VisualMode";
import AssetsTable from "../../../components/commons/CommonsCatalog/AssetsTable";
import { useTypedSelector } from "../../../state/hooks";
import InfiniteScroll from "react-infinite-scroll-component";

/**
 * Displays an Author's page in the Commons catalog, showing information about an author and their works.
 */
const CommonsAuthor = () => {
  const { id: authorID } = useParams<{ id: string }>();
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

  // Author data
  const [loadedData, setLoadedData] = useState<boolean>(false);
  const [author, setAuthor] = useState<Author>({
    firstName: "",
    lastName: "",
    email: "",
    primaryInstitution: "",
  });

  // Asset data
  const [itemizedMode, setItemizedMode] = useState<boolean>(false);
  const [loadingDisabled, setLoadingDisabled] = useState<boolean>(false);
  const [loadedAssets, setLoadedAssets] = useState<boolean>(false);
  const [assets, setAssets] = useState<
    ProjectFileWProjectData<"title" | "thumbnail" | "description" | "projectURL">[]
  >([]);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalAssets, setTotalAssets] = useState<number>(0);
  const [jumpToBottomClicked, setJumpToBottomClicked] =
    useState<boolean>(false);

  useEffect(() => {
    getAuthor();
  }, [authorID]);

  const getAuthor = async () => {
    try {
      if (!authorID) {
        throw new Error("No author ID provided.");
      }

      setLoadedData(false);
      const res = await api.getAuthor(authorID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.author) {
        throw new Error("Error processing server data.");
      }

      setAuthor(res.data.author);
      getAuthorAssets();
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoadedData(true);
    }
  };

  const getAuthorAssets = async (page: number = 1) => {
    try {
      if (!authorID) {
        throw new Error("No author ID provided.");
      }

      if (loadingDisabled) return;
      setLoadedAssets(false);

      const res = await api.getAuthorAssets(authorID, {
        page,
        limit: 10,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.assets) {
        throw new Error("Error processing server data.");
      }

      setAssets([...assets, ...res.data.assets]);
      setTotalAssets(res.data.total);
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoadedAssets(true);
    }
  };

  const onLoadMoreAssets = () => {
    const newPage = activePage + 1;
    setActivePage(newPage);
    getAuthorAssets(newPage);
  };

  /**
   * Update page title when data is available.
   */
  useEffect(() => {
    if (author.firstName && author.lastName) {
      document.title =
        `${
          org.shortName !== "LibreTexts"
            ? `${org.shortName} Commons`
            : "LibreCommons"
        } | ` +
        author.firstName +
        " " +
        author.lastName;
    }
  }, [author]);

  const authorFullName = useMemo(() => {
    if (!author || !author.firstName || !author.lastName)
      return "Unknown Author";
    return author.firstName + " " + author.lastName;
  }, [author]);

  const jumpToBottom = () => {
    setLoadingDisabled(true);
    setJumpToBottomClicked(true);
    window.scrollTo(0, document.body.scrollHeight);
  };

  return (
    <div className="commons-page-container">
      <Segment.Group raised>
        <Segment>
          <Breadcrumb>
            <Breadcrumb.Section as={Link} to="/catalog">
              <span>
                <span className="muted-text">You are on: </span>
                Catalog
              </span>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>{authorFullName}</Breadcrumb.Section>
          </Breadcrumb>
        </Segment>
        <Segment loading={!loadedData} className="">
          <div className="flex flex-row px-1">
            <div className="flex flex-col w-1/4 max-h-48 border shadow-md p-4 rounded-md mr-16">
              <Header as="h1" className="!mb-2 !ml-0.5">
                {authorFullName}
              </Header>
              <p>
                <Icon name="university" />
                {author.primaryInstitution}
              </p>
              <p>
                <Icon name="linkify" />
                <a href={author.url} target="_blank" rel="noreferrer">
                  {author.url}
                </a>
              </p>
            </div>
            <div className="flex flex-col w-3/4">
              <div className="flex flex-row justify-between items-start">
                <Header as="h2">Assets</Header>
                <div>
                  <Popup
                    trigger={
                      <button
                        onClick={() => {
                          jumpToBottomClicked
                            ? window.location.reload()
                            : jumpToBottom();
                        }}
                        className="bg-slate-100 text-black border border-slate-300 rounded-md mr-2 !pl-1.5 p-1 shadow-sm hover:shadow-md"
                        aria-label={
                          jumpToBottomClicked
                            ? "Refresh to continue browsing"
                            : "Jump to bottom"
                        }
                      >
                        {jumpToBottomClicked ? (
                          <Icon name="refresh" />
                        ) : (
                          <Icon name="arrow down" />
                        )}
                      </button>
                    }
                    content={
                      jumpToBottomClicked
                        ? "Refresh to continue browsing"
                        : "Jump to bottom"
                    }
                  />
                  <Popup
                    trigger={
                      <button
                        onClick={() => {
                          setItemizedMode(!itemizedMode);
                        }}
                        className="bg-slate-100 text-black border border-slate-300 rounded-md !pl-1.5 p-1 shadow-sm hover:shadow-md"
                        aria-label={
                          itemizedMode
                            ? "Switch to visual mode"
                            : "Switch to itemized mode"
                        }
                      >
                        {itemizedMode ? (
                          <Icon name="grid layout" />
                        ) : (
                          <Icon name="list layout" />
                        )}
                      </button>
                    }
                    content={
                      itemizedMode
                        ? "Switch to visual mode"
                        : "Switch to itemized mode"
                    }
                  />
                </div>
              </div>
              <div>
                <InfiniteScroll
                  dataLength={assets.length}
                  next={onLoadMoreAssets}
                  hasMore={assets.length < totalAssets}
                  loader={
                    <p className="text-center font-semibold mt-4">Loading...</p>
                  }
                  endMessage={
                    <p className="text-center mt-4 italic">End of Results</p>
                  }
                  height={itemizedMode ? 500 : 800}
                >
                  {itemizedMode ? (
                    <AssetsTable items={assets} loading={!loadedAssets} />
                  ) : (
                    <VisualMode
                      items={assets}
                      loading={!loadedAssets}
                      noResultsMessage="No assets found for this author."
                    />
                  )}
                </InfiniteScroll>
              </div>
            </div>
          </div>
        </Segment>
      </Segment.Group>
    </div>
  );
};

export default CommonsAuthor;
