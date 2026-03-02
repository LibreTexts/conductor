import { Dropdown, Header, Placeholder, Segment } from "semantic-ui-react";
import ConductorPagination from "../util/ConductorPagination";
import { catalogItemsPerPageOptions } from "../util/PaginationOptions";

interface SearchResultsSectionProps {
  title: string;
  loading: boolean;
  activePage: number;
  totalPages: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  sortOptions?: readonly { readonly key: string; readonly text: string; readonly value: string }[];
  activeSort?: string;
  onSortChange?: (sort: any) => void;
  children: React.ReactNode;
}

const LoadingPlaceholder = () => (
  <Segment basic loading={true}>
    <Placeholder fluid>
      <Placeholder.Header>
        <Placeholder.Line />
      </Placeholder.Header>
      <Placeholder.Paragraph>
        <Placeholder.Line />
        <Placeholder.Line />
        <Placeholder.Line />
        <Placeholder.Line />
        <Placeholder.Line />
      </Placeholder.Paragraph>
    </Placeholder>
  </Segment>
);

const SearchResultsSection: React.FC<SearchResultsSectionProps> = ({
  title,
  loading,
  activePage,
  totalPages,
  limit,
  onPageChange,
  onLimitChange,
  sortOptions,
  activeSort,
  onSortChange,
  children,
}) => {
  return (
    <>
      <Header as="h3" dividing>
        {title}
      </Header>
      {!loading ? (
        <Segment basic>
          <Segment attached="top">
            <div className="flex-row-div">
              <div className="left-flex">
                <span>Displaying </span>
                <Dropdown
                  className="search-itemsperpage-dropdown"
                  selection
                  options={catalogItemsPerPageOptions}
                  onChange={(_e, { value }) => {
                    const newLimit = (value as number) ?? 12;
                    onLimitChange(newLimit);
                  }}
                  value={limit}
                  aria-label="Number of results to display per page"
                />
                <span> items per page.</span>
              </div>
              <div className="center-flex">
                <ConductorPagination
                  activePage={activePage}
                  totalPages={totalPages || 1}
                  firstItem={null}
                  lastItem={null}
                  onPageChange={(_e, data) => {
                    const newPage =
                      parseInt(data.activePage?.toString() || "") || 1;
                    onPageChange(newPage);
                  }}
                />
              </div>
              <div className="right-flex">
                {sortOptions && onSortChange && (
                  <Dropdown
                    placeholder="Sort by..."
                    floating
                    selection
                    button
                    options={sortOptions as any}
                    onChange={(_e, { value }) =>
                      onSortChange(value ?? sortOptions[0].value)
                    }
                    value={activeSort}
                    aria-label={`Sort ${title} Results by`}
                  />
                )}
              </div>
            </div>
          </Segment>
          {children}
        </Segment>
      ) : (
        <LoadingPlaceholder />
      )}
    </>
  );
};

export default SearchResultsSection;
