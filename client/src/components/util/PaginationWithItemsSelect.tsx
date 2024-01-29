import { Divider, Dropdown } from "semantic-ui-react";
import ConductorPagination from "./ConductorPagination";
import { itemsPerPageOptions } from "./PaginationOptions";
import { capitalizeFirstLetter } from "./HelperFunctions";

type PaginationWithItemsSelectProps = {
  itemsPerPage: number;
  setItemsPerPageFn: (itemsPerPage: number) => void;
  activePage: number;
  setActivePageFn: (activePage: number) => void;
  totalPages: number;
  totalLength: number;
  sort?: boolean;
  sortOptions?: string[];
  activeSort?: string;
  setActiveSortFn?: (sort: string) => void;
};

export const PaginationWithItemsSelect: React.FC<
  PaginationWithItemsSelectProps
> = ({
  itemsPerPage,
  setItemsPerPageFn,
  activePage,
  setActivePageFn,
  totalPages,
  totalLength,
  sort = false,
  sortOptions = [],
  activeSort = "",
  setActiveSortFn = () => {},
}) => {
  return (
    <div className="flex-row-div">
      <div className="left-flex">
        {
          sort && (
            <div className="flex flex-row items-center border-r-2 mr-2">
            <span>Sort By</span>
            <Dropdown
              className="commons-content-pagemenu-dropdown"
              selection
              options={sortOptions.map((opt) => ({
                key: opt,
                text: capitalizeFirstLetter(opt),
                value: opt,
              }))}
              onChange={(_e, { value }) => {
                setActiveSortFn(value?.toString() ?? "");
              }}
              value={activeSort}
            />
            </div>
          )
        }
        <span>Displaying </span>
        <Dropdown
          className="commons-content-pagemenu-dropdown"
          selection
          options={itemsPerPageOptions}
          onChange={(_e, { value }) => {
            setItemsPerPageFn(parseInt(value?.toString() ?? "10") ?? 10);
          }}
          value={itemsPerPage}
        />
        <span>
          {" "}
          items per page of <strong>{totalLength}</strong> total results.
        </span>
      </div>
      <div className="right-flex">
        <ConductorPagination
          activePage={activePage}
          totalPages={totalPages}
          onPageChange={(e, data) =>
            setActivePageFn(parseInt(data.activePage?.toString() ?? "1") ?? 1)
          }
        />
      </div>
    </div>
  );
};
