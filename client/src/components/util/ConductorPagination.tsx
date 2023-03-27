//
// LibreTexts Conductor
// ConductorPagination.tsx
// A reusable, A11Y-forward extension of the Semantic UI
// pagination tool.
//

import { Pagination, PaginationProps } from "semantic-ui-react";

/**
 * Returns formatted text for search results
 * Generally used with @constant ConductorPagination
 * @param {number} resultsCount - Number of found results
 * @param {number} totalCount - Number of total possible results
 */
export const ResultsText = ({
  resultsCount,
  totalCount,
}: {
  resultsCount: number;
  totalCount: number;
}) => (
  <span>
    {" items per page of "}
    <strong>{resultsCount.toLocaleString()}</strong> results from{" "}
    {totalCount.toLocaleString()} available.
  </span>
);

interface ConductorPaginationProps extends PaginationProps {
  activePage: number;
  totalPages: number;
}

const ConductorPagination = ({
  activePage,
  totalPages,
  ...rest
}: ConductorPaginationProps) => {
  return (
    <Pagination
      activePage={activePage}
      totalPages={totalPages}
      firstItem={null}
      lastItem={null}
      prevItem={{
        "aria-label": "Previous page",
        content: "⟨",
      }}
      nextItem={{
        "aria-label": "Next page",
        content: "⟩",
      }}
      {...rest}
    />
  );
};

export default ConductorPagination;
