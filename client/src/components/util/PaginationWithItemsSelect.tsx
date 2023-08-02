import { Dropdown } from "semantic-ui-react";
import ConductorPagination from "./ConductorPagination";
import { itemsPerPageOptions } from "./PaginationOptions";

type PaginationWithItemsSelectProps = {
  itemsPerPage: number;
  setItemsPerPageFn: (itemsPerPage: number) => void;
  activePage: number;
  setActivePageFn: (activePage: number) => void;
  totalPages: number;
  totalLength: number;
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
}) => {
  return (
    <div className="flex-row-div">
      <div className="left-flex">
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
