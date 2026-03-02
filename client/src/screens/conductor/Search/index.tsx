import "./Search.css";
import "../../../components/projects/Projects.css";

import { Grid, Header, Segment } from "semantic-ui-react";
import { useState, useEffect, useMemo, lazy } from "react";
import { useDocumentTitle } from "usehooks-ts";
import useGlobalError from "../../../components/error/ErrorHooks";
import type { Homework, ProjectFile } from "../../../types";
import { downloadFile } from "../../../utils/assetHelpers";
import { useSearchParams } from "../../../hooks/search/useSearchParams";
import { useSearch } from "../../../hooks/search/useSearch";
import SearchSummaryHeader from "../../../components/Search/SearchSummaryHeader";
import SearchResultsSection from "../../../components/Search/SearchResultsSection";
import ProjectsTable from "../../../components/Search/ProjectsTable";
import BooksTable from "../../../components/Search/BooksTable";
import AssetsTable from "../../../components/Search/AssetsTable";
import HomeworkTable from "../../../components/Search/HomeworkTable";
import UsersTable from "../../../components/Search/UsersTable";
import { SORT_OPTIONS } from "./searchConstants";

const AlertModal = lazy(() => import("../../../components/alerts/AlertModal"));
const PreviewHomework = lazy(
  () => import("../../../components/Search/PreviewHomework")
);

const Search = () => {
  const { handleGlobalError } = useGlobalError();

  const params = useSearchParams();

  const projects = useSearch("projects", {
    searchQuery: params.searchQuery,
    page: params.projects.page,
    limit: params.projects.limit,
    sort: params.projects.sort,
  });

  const books = useSearch("books", {
    searchQuery: params.searchQuery,
    page: params.books.page,
    limit: params.books.limit,
    sort: params.books.sort,
  });

  const assets = useSearch("assets", {
    searchQuery: params.searchQuery,
    page: params.assets.page,
    limit: params.assets.limit,
  });

  const homework = useSearch("homework", {
    searchQuery: params.searchQuery,
    page: params.homework.page,
    limit: params.homework.limit,
    sort: params.homework.sort,
  });

  const users = useSearch("users", {
    searchQuery: params.searchQuery,
    page: params.users.page,
    limit: params.users.limit,
    sort: params.users.sort,
  });

  const [selectedHW, setSelectedHW] = useState<Homework | null>(null);
  const [showHwModal, setShowHwModal] = useState<boolean>(false);
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);

  // Total result of all items across search types
  const totalResults = useMemo(
    () =>
      projects.total +
      books.total +
      assets.total +
      homework.total +
      users.total,
    [projects.total, books.total, assets.total, homework.total, users.total]
  );

  useDocumentTitle(
    params.searchQuery
      ? `LibreTexts Conductor | Search | "${params.searchQuery}" | Results`
      : "LibreTexts Conductor | Search Results"
  );

  useEffect(() => {
    if (!params.searchQuery || params.searchQuery.length === 0) {
      handleGlobalError("Oops, please provide a valid search query.");
    }
  }, [params.searchQuery, handleGlobalError]);

  // Reset all pages to 1 when search query changes
  useEffect(() => {
    if (params.searchQuery) {
      params.projects.setPage(1);
      params.books.setPage(1);
      params.assets.setPage(1);
      params.homework.setPage(1);
      params.users.setPage(1);
    }
  }, [params.searchQuery]);

  const openHwModal = (hwItem: Homework) => {
    if (typeof hwItem === "object") {
      setSelectedHW(hwItem);
      setShowHwModal(true);
    }
  };

  const closeHwModal = () => {
    setSelectedHW(null);
    setShowHwModal(false);
  };

  const openCreateAlertModal = () => {
    setShowAlertModal(true);
  };

  const closeCreateAlertModal = () => {
    setShowAlertModal(false);
  };

  const handleDownloadFile = async (file: ProjectFile) => {
    const success = await downloadFile(file.projectID, file.fileID);
    if (!success) {
      handleGlobalError(
        "Oops, something went wrong while downloading this file."
      );
    }
  };

  return (
    <Grid className="component-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Search</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment>
            <SearchSummaryHeader
              query={params.searchQuery}
              totalResults={totalResults}
              onCreateAlert={openCreateAlertModal}
            />

            {/* Projects Section */}
            <SearchResultsSection
              title="Projects"
              loading={projects.isLoading}
              activePage={params.projects.page}
              totalPages={Math.ceil(projects.total / params.projects.limit)}
              limit={params.projects.limit}
              onPageChange={params.projects.setPage}
              onLimitChange={(limit) => {
                params.projects.setLimit(limit);
              }}
              sortOptions={SORT_OPTIONS.projects}
              activeSort={params.projects.sort}
              onSortChange={params.projects.setSort}
            >
              <ProjectsTable items={projects.data} attached />
            </SearchResultsSection>
            <SearchResultsSection
              title="Books"
              loading={books.isLoading}
              activePage={params.books.page}
              totalPages={Math.ceil(books.total / params.books.limit)}
              limit={params.books.limit}
              onPageChange={params.books.setPage}
              onLimitChange={(limit) => {
                params.books.setLimit(limit);
              }}
              sortOptions={SORT_OPTIONS.books}
              activeSort={params.books.sort}
              onSortChange={params.books.setSort}
            >
              <BooksTable items={books.data} attached />
            </SearchResultsSection>

            <SearchResultsSection
              title="Assets"
              loading={assets.isLoading}
              activePage={params.assets.page}
              totalPages={Math.ceil(assets.total / params.assets.limit)}
              limit={params.assets.limit}
              onPageChange={params.assets.setPage}
              onLimitChange={(limit) => {
                params.assets.setLimit(limit);
              }}
            >
              <AssetsTable
                items={assets.data}
                attached
                onDownloadFile={handleDownloadFile}
              />
            </SearchResultsSection>

            <SearchResultsSection
              title="Homework & Assessments"
              loading={homework.isLoading}
              activePage={params.homework.page}
              totalPages={Math.ceil(homework.total / params.homework.limit)}
              limit={params.homework.limit}
              onPageChange={params.homework.setPage}
              onLimitChange={(limit) => {
                params.homework.setLimit(limit);
              }}
              sortOptions={SORT_OPTIONS.homework}
              activeSort={params.homework.sort}
              onSortChange={params.homework.setSort}
            >
              <HomeworkTable
                items={homework.data}
                attached
                onItemClick={openHwModal}
              />
            </SearchResultsSection>

            <SearchResultsSection
              title="Users"
              loading={users.isLoading}
              activePage={params.users.page}
              totalPages={Math.ceil(users.total / params.users.limit)}
              limit={params.users.limit}
              onPageChange={params.users.setPage}
              onLimitChange={(limit) => {
                params.users.setLimit(limit);
              }}
              sortOptions={SORT_OPTIONS.users}
              activeSort={params.users.sort}
              onSortChange={params.users.setSort}
            >
              <UsersTable items={users.data} attached />
            </SearchResultsSection>
          </Segment>

          {selectedHW && (
            <PreviewHomework
              show={showHwModal}
              homework={selectedHW}
              onClose={closeHwModal}
            />
          )}

          <AlertModal
            open={showAlertModal}
            onClose={closeCreateAlertModal}
            mode="create"
            query={params.searchQuery}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default Search;
