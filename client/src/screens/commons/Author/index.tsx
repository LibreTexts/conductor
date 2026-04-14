import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Icon, Popup } from "semantic-ui-react";
import useGlobalError from "../../../components/error/ErrorHooks";
import api from "../../../api";
import VisualMode from "../../../components/commons/CommonsCatalog/VisualMode";
import AssetsTable from "../../../components/commons/CommonsCatalog/AssetsTable";
import { useTypedSelector } from "../../../state/hooks";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Breadcrumb, Card, Heading, Spinner, Stack, Link } from "@libretexts/davis-react";
import { truncateString } from "../../../components/util/HelperFunctions";
import { IconLink } from "@tabler/icons-react";

const ASSETS_LIMIT = 10;

/**
 * Displays an Author's page in the Commons catalog, showing information about an author and their works.
 */
const CommonsAuthor = () => {
  const { id: authorID } = useParams<{ id: string }>();
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

  const [itemizedMode, setItemizedMode] = useState(false);
  const [jumpToBottomClicked, setJumpToBottomClicked] = useState(false);
  const [loadingDisabled, setLoadingDisabled] = useState(false);

  // Author data
  const {
    data: author,
    isLoading: authorLoading,
    error: authorError,
  } = useQuery({
    queryKey: ["author", authorID],
    queryFn: async () => {
      if (!authorID) throw new Error("No author ID provided.");
      const res = await api.getAuthor(authorID);
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.author) throw new Error("Error processing server data.");
      return res.data.author;
    },
    enabled: !!authorID,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  // Assets data
  const {
    data: assetsData,
    isFetching: assetsFetching,
    fetchNextPage,
    hasNextPage,
    error: assetsError,
  } = useInfiniteQuery({
    queryKey: ["author-assets", authorID],
    queryFn: async ({ pageParam = 1 }) => {
      if (!authorID) throw new Error("No author ID provided.");
      const res = await api.getAuthorAssets(authorID, {
        page: pageParam as number,
        limit: ASSETS_LIMIT,
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.assets) throw new Error("Error processing server data.");
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((p) => p.assets).length;
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled: !!authorID && !loadingDisabled,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (authorError) handleGlobalError(authorError);
  }, [authorError]);

  useEffect(() => {
    if (assetsError) handleGlobalError(assetsError);
  }, [assetsError]);

  useEffect(() => {
    if (author?.name) {
      document.title =
        `${org.shortName !== "LibreTexts" ? `${org.shortName} Commons` : "LibreCommons"} | ${author.name}`;
    }
  }, [author?.name, org.shortName]);

  const assets = assetsData?.pages.flatMap((p) => p.assets) ?? [];
  const totalAssets = assetsData?.pages[0]?.total ?? 0;
  const hasMore = (hasNextPage ?? false) && assets.length < totalAssets;

  const jumpToBottom = () => {
    setLoadingDisabled(true);
    setJumpToBottomClicked(true);
    window.scrollTo(0, document.body.scrollHeight);
  };

  return (
    <>
      <div className="px-6 py-3 border-b border-neutral-200">
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/catalog">
            Catalog
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>{author?.name}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* Main Content */}
      {authorLoading ? (
        <div className="flex justify-center items-center p-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-6 p-6">
          <Card padding="sm">
            <Stack direction="vertical" gap="md">
              {author?.pictureURL && (
                <img
                  src={author.pictureURL}
                  alt={author.name}
                  className={`w-24 h-24 object-cover mb-3 ${author.pictureCircle === "no" ? "rounded-md" : "rounded-full"}`}
                />
              )}
              <Heading level={1} className="!mb-2 !ml-0.5">
                {author?.name ?? ""}
              </Heading>
              {author?.nameTitle && (
                <p className="text-gray-600 text-sm mb-2">{author.nameTitle}</p>
              )}
              {author?.nameURL && (
                <Link
                  href={author.nameURL}
                  target="_blank"
                  rel="noreferrer"
                  external
                >
                  <IconLink className="inline mr-1" size={16}/>
                  {truncateString(author.nameURL || "", 35)}
                </Link>
              )}
              {author?.companyName && (
                <p>
                  <Icon name="university" />
                  {author.companyURL ? (
                    <a href={author.companyURL} target="_blank" rel="noreferrer">
                      {author.companyName}
                    </a>
                  ) : (
                    author.companyName
                  )}
                </p>
              )}
              {author?.programName && (
                <p>
                  <Icon name="graduation cap" />
                  {author.programURL ? (
                    <a href={author.programURL} target="_blank" rel="noreferrer">
                      {author.programName}
                    </a>
                  ) : (
                    author.programName
                  )}
                </p>
              )}
              {author?.note && (
                <p>
                  <Icon name="info circle" />
                  {author.noteURL ? (
                    <a href={author.noteURL} target="_blank" rel="noreferrer">
                      {author.note}
                    </a>
                  ) : (
                    author.note
                  )}
                </p>
              )}
              {author?.projects && author.projects.length > 0 && (
                <p>
                  <Icon name="wrench" className="mr-1" />
                  {author.projects.map((p, i) => (
                    <a
                      href={`/commons-project/${p.projectID}`}
                      key={p.projectID}
                      className="hover:underline cursor-pointer !text-blue-500"
                    >
                      {p.title}{i < author.projects.length - 1 ? ", " : ""}
                    </a>
                  ))}
                </p>
              )}
            </Stack>
          </Card>
          <Stack direction="vertical" gap="md">
            <div className="flex flex-row justify-between items-start">
              <Heading level={2}>Assets</Heading>
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
                      onClick={() => setItemizedMode(!itemizedMode)}
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
              <VisualMode
                items={assets}
                loading={assetsFetching}
                noResultsMessage="No assets found for this author."
              />
              {hasMore && (
                <div className="w-full mt-6 flex justify-center">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={assetsFetching}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-wait transition-colors font-semibold"
                    aria-label="Load more assets"
                  >
                    {assetsFetching ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
              {!hasMore && assets.length > 0 && (
                <div className="w-full mt-4">
                  <p className="text-center font-semibold">End of results</p>
                </div>
              )}
            </div>
          </Stack >
        </div >

      )}
    </>
  );
};

export default CommonsAuthor;
